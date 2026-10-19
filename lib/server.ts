import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline';
import { mkdir, mkdtemp, readdir, rm, stat, link } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { friendlyError, parseProgress, qualityOptions, safeName, youtubeUrl, type Format } from './core';

export type Video = {url: string; title: string; duration: number; thumbnail: string; channel: string; qualities: number[]; hasAudio: boolean};
export type Job = {id: string; status: 'queued'|'downloading'|'processing'|'complete'|'error'|'cancelled'; percent: number|null; speed: number|null; eta: number|null; message: string; filename?: string; size?: number; file?: string; remote?: boolean; created: number};
type InternalJob = Job & {child?: ChildProcess; listeners: Set<() => void>; cancelled: boolean};
const globals = globalThis as typeof globalThis & { clipExitInstalled?: boolean; clipJobs?: Map<string, InternalJob>; clipMetadata?: Map<string,{video: Video; expires: number}> };
const jobs = globals.clipJobs ??= new Map();
const metadata = globals.clipMetadata ??= new Map();
if(!globals.clipExitInstalled) {
  globals.clipExitInstalled=true;
  process.once('exit',()=>{for(const job of jobs.values()) if(job.child) terminate(job.child,'SIGKILL');});
}
export const downloadDir = () => process.env.DOWNLOAD_DIR ? path.resolve(process.env.DOWNLOAD_DIR) : path.join(homedir(), 'Downloads');
export const remoteMode = () => process.env.RENDER === 'true' || process.platform !== 'darwin' || Boolean(process.env.APP_ORIGIN && !/^https?:\/\/(localhost|127\.0\.0\.1)(:|$)/.test(process.env.APP_ORIGIN));
export function guard(req: Request) {
  const host = req.headers.get('host');
  const allowed = new Set(['http://localhost:3000', 'http://127.0.0.1:3000']);
  const configured = process.env.APP_ORIGIN || process.env.RENDER_EXTERNAL_URL;
  if (configured) allowed.add(new URL(configured).origin);
  if (!host || ![...allowed].some(value => new URL(value).host === host)) throw new Error('Local requests only.');
  const origin = req.headers.get('origin');
  if (origin && !allowed.has(origin)) throw new Error('Local requests only.');
  if (req.headers.get('sec-fetch-site') === 'cross-site') throw new Error('Local requests only.');
}

function terminate(child: ChildProcess, signal: NodeJS.Signals = 'SIGTERM') {
  try {if(process.platform !== 'win32' && child.pid) process.kill(-child.pid,signal); else child.kill(signal);} catch { /* Already exited. */ }
}
export function run(command: string, args: string[], options: {job?: InternalJob; onLine?: (line:string)=>void; timeout?: number} = {}): Promise<string> {
  return new Promise((resolve,reject) => {
    const child = spawn(command,args,{shell:false,detached:process.platform !== 'win32',stdio:['ignore','pipe','pipe'], env:{...process.env, PATH:`/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || ''}`}});
    if (options.job) options.job.child = child;
    let out = '', err = '', oversized = false;
    const timer = setTimeout(() => {terminate(child,'SIGKILL'); reject(new Error('Connection timed out.'));},options.timeout ?? 120_000);
    for (const stream of [child.stdout,child.stderr]) {
      createInterface({input:stream}).on('line',line => {
        options.onLine?.(line);
        if (stream === child.stdout) {out += line + '\n'; if(out.length > 24_000_000) {oversized=true; terminate(child);}}
        else err = (err + line + '\n').slice(-16_000);
      });
    }
    child.once('error',e => {clearTimeout(timer); reject(e);});
    child.once('close',code => {clearTimeout(timer); if(options.job?.child === child) options.job.child = undefined; code === 0 && !oversized ? resolve(out) : reject(new Error(err || 'Download interrupted.'));});
  });
}
export async function health() {
  if(process.env.VERCEL === '1') return {ok:false,mode:'vercel',checks:[],message:'Vercel can host the password-protected interface, but cannot run this downloader. Deploy the complete app on a Node host with yt-dlp and FFmpeg.'};
  const checks = await Promise.all(['yt-dlp','ffmpeg','ffprobe'].map(async tool => {
    try { await run(tool,[tool === 'yt-dlp' ? '--version' : '-version'],{timeout:30000}); return {tool,ok:true}; } catch {return {tool,ok:false};}
  }));
  return {ok:checks.every(c=>c.ok),mode:remoteMode()?'remote':'local',checks};
}
const baseArgs = ['--js-runtimes',`node:${process.execPath}`,'--ignore-config','--no-playlist','--no-warnings','--socket-timeout','20','--retries','2'];
export async function getVideo(input: unknown): Promise<Video> {
  const url = youtubeUrl(input);
  const cached = metadata.get(url);
  if(cached && cached.expires > Date.now()) return cached.video;
  const info = JSON.parse(await run('yt-dlp',[...baseArgs,'--skip-download','--dump-single-json','--',url]));
  if(info.is_live) throw new Error('Live streams are not supported. Wait until the broadcast has finished.');
  const formats: Format[] = info.formats ?? [];
  if(!formats.some(f=>f.vcodec && f.vcodec !== 'none' && !f.has_drm)) throw new Error('No supported video formats are available.');
  const thumbnail = typeof info.thumbnail === 'string' && /^https:\/\/(?:i\d?\.ytimg\.com|img\.youtube\.com)\//.test(info.thumbnail) ? info.thumbnail : '';
  const video: Video = {url,title:info.title || 'YouTube video',duration:info.duration || 0,thumbnail,channel:info.channel || info.uploader || 'YouTube',qualities:qualityOptions(formats),hasAudio:formats.some(f=>f.acodec && f.acodec !== 'none' && !f.has_drm)};
  if(metadata.size > 100) metadata.clear();
  metadata.set(url,{video,expires:Date.now()+5*60_000});
  return video;
}
export function publicJob(job: InternalJob): Job {
  const {id,status,percent,speed,eta,message,filename,size,created} = job;
  return {id,status,percent,speed,eta,message,filename,size,created,remote:remoteMode()};
}
export function getJob(id:string) {return jobs.get(id);}
function update(job:InternalJob,patch: Partial<Job>) {Object.assign(job,patch); for(const fn of job.listeners) fn();}
export function cancelJob(job: InternalJob) {
  if(['complete','error','cancelled'].includes(job.status)) return;
  job.cancelled=true; if(job.child) terminate(job.child);
  const child=job.child; const timer=setTimeout(()=>{if(child) terminate(child,'SIGKILL');},2000); timer.unref();
  update(job,{status:'cancelled',message:'Download cancelled.',speed:null,eta:null});
}
export async function saveUnique(source:string,title:string, directory=downloadDir()) {
  await mkdir(directory,{recursive:true});
  for(let i=0;i<10000;i++) {
    const filename=`${safeName(title)}${i ? ` (${i})` : ''}.mp4`;
    const file=path.join(directory,filename);
    try {await link(source,file); return {file,filename,size:(await stat(file)).size};}
    catch(e) {if((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;}
  }
  throw new Error('Too many duplicate filenames.');
}
export async function startJob(input:unknown,quality:unknown,canvas:unknown) {
  if([...jobs.values()].some(j=>!['complete','error','cancelled'].includes(j.status))) throw new Error('A download is already running. Finish or cancel it first.');
  // Reserve before asynchronous metadata lookup so concurrent requests cannot both start.
  const job:InternalJob={id:randomUUID(),status:'queued',percent:0,speed:null,eta:null,message:'Preparing your download…',created:Date.now(),listeners:new Set(),cancelled:false};
  jobs.set(job.id,job);
  try {
    const video=await getVideo(input);
    if(quality !== 'best' && (typeof quality !== 'number' || !video.qualities.includes(quality))) throw new Error('Choose an available video quality.');
    if(typeof canvas !== 'boolean') throw new Error('Invalid preset.');
    void download(job,video,quality as number|'best',canvas);
    for(const [id,j] of jobs) if(Date.now()-j.created > 24*60*60_000 && ['complete','error','cancelled'].includes(j.status)) jobs.delete(id);
    return publicJob(job);
  } catch(e) {jobs.delete(job.id); throw e;}
}
async function download(job:InternalJob,video:Video,quality:number|'best',canvas:boolean) {
  let dir:string|undefined;
  try {
    // Stage on the same volume as Downloads, enabling atomic, non-overwriting publication.
    await mkdir(downloadDir(),{recursive:true});
    dir=await mkdtemp(path.join(downloadDir(),'.clipsave-'));
    if(job.cancelled) return;
    const cap=quality === 'best' ? (canvas ? 1080 : undefined) : (canvas ? Math.min(quality,1080) : quality);
    const filter=cap ? `[height<=${cap}]` : '';
    update(job,{status:'downloading',message:'Downloading video and audio…'});
    await run('yt-dlp',[...baseArgs,'--newline','--progress','--progress-template','download:CLIP_PROGRESS:%(progress)j','-f',`bv*${filter}+ba/b${filter}`,'-S','vcodec:h264,acodec:aac','--merge-output-format','mkv','-o',path.join(dir,'source.%(ext)s'),'--',video.url],{job,timeout:6*60*60_000,onLine:line=>{
      if(job.cancelled) return;
      const p=parseProgress(line); if(p) update(job,{...p,message:'Downloading video and audio…'});
      if(line.includes('[Merger]')) update(job,{status:'processing',message:'Merging video and audio…',percent:null,speed:null,eta:null});
    }});
    if(job.cancelled) return;
    const source=(await readdir(dir)).find(f=>/^source\.(mkv|mp4|webm|mov|flv|3gp)$/.test(f));
    if(!source) throw new Error('Unsupported format.');
    const sourcePath=path.join(dir,source);
    const output=path.join(dir,'finished.mp4');
    await convertToMp4(job,sourcePath,output,video,canvas);
    if(job.cancelled) return;
    const saved=await saveUnique(output,video.title);
    if(job.cancelled) {await rm(saved.file,{force:true}); return;}
    job.file=saved.file;
    if(process.env.EPHEMERAL_DOWNLOADS === 'true') {
      const expiry=setTimeout(()=>{void rm(saved.file,{force:true}).catch(()=>{});jobs.delete(job.id);},60*60_000);
      expiry.unref();
    }
    update(job,{...saved,status:'complete',message:'Saved to your Downloads folder.',percent:100});
  } catch(e) {if(!job.cancelled) update(job,{status:'error',message:friendlyError(String(e)),speed:null,eta:null});}
  finally {if(dir) await rm(dir,{recursive:true,force:true}).catch(()=>{});}
}
export async function openJob(job:InternalJob,action:unknown) {
  if(job.status!=='complete'||!job.file) throw new Error('This file is not ready.');
  if(process.platform!=='darwin') throw new Error('Finder actions are available on macOS.');
  if(action!=='open' && action!=='reveal') throw new Error('Invalid file action.');
  await run('/usr/bin/open',action==='reveal'?['-R',job.file]:[job.file],{timeout:10000});
}

export async function convertToMp4(job:InternalJob,sourcePath:string,output:string,video:Video,canvas:boolean) {
    const probe=JSON.parse(await run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',sourcePath],{job}));
    if(job.cancelled) return;
    const v=probe.streams.find((s:{codec_type:string})=>s.codec_type==='video');
    const a=probe.streams.find((s:{codec_type:string})=>s.codec_type==='audio');
    if(!v || (video.hasAudio && !a)) throw new Error('Video or audio format is missing.');
    const copyVideo=v.codec_name==='h264' && v.pix_fmt==='yuv420p' && (!canvas || (v.height<=1080 && (Number(v.bit_rate)||Number(probe.format.bit_rate)||Infinity)<=5_000_000));
    update(job,{status:'processing',message:copyVideo ? 'Preparing your compatible MP4…' : 'Converting to H.264 MP4…',percent:0,speed:null,eta:null});
    await run('ffmpeg',['-hide_banner','-nostdin','-v','error','-i',sourcePath,'-map','0:v:0','-map','0:a:0?','-c:v',copyVideo?'copy':'libx264',...(!copyVideo?['-preset','fast','-crf',canvas?'24':'20','-pix_fmt','yuv420p',...(canvas?['-vf','scale=w=min(1920\\,iw):h=min(1080\\,ih):force_original_aspect_ratio=decrease:force_divisible_by=2','-maxrate','4M','-bufsize','8M']:[])]:[]),'-c:a',a?.codec_name==='aac' && !canvas?'copy':'aac',...(a?.codec_name!=='aac'||canvas?['-b:a','128k']:[]),'-movflags','+faststart','-progress','pipe:1','-n',output],{job,timeout:6*60*60_000,onLine:line=>{
      if(job.cancelled) return;
      if(line.startsWith('out_time_us=') && video.duration) update(job,{percent:Math.min(99,Number(line.split('=')[1])/1e6/video.duration*100)});
    }});
    if(job.cancelled) return;
    const verified=JSON.parse(await run('ffprobe',['-v','error','-show_streams','-of','json',output],{job}));
    if(job.cancelled) return;
    if(!verified.streams.some((s:{codec_type:string;codec_name:string})=>s.codec_type==='video'&&s.codec_name==='h264') || (a && !verified.streams.some((s:{codec_type:string;codec_name:string})=>s.codec_type==='audio'&&s.codec_name==='aac'))) throw new Error('MP4 compatibility conversion failed.');
}
