import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {run,convertToMp4} from '../lib/server';
test('real FFmpeg converts VP9/Opus into verified H.264/AAC MP4 with Canvas preset',{skip:process.env.CLIPSAVE_MEDIA_TESTS!=='1'},async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'clipsave-media-'));
 try {
  const source=path.join(dir,'source.webm'),output=path.join(dir,'output.mp4');
  await run('ffmpeg',['-hide_banner','-v','error','-f','lavfi','-i','testsrc2=size=320x180:rate=24','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','2','-c:v','libvpx-vp9','-c:a','libopus',source]);
  const job={id:'test',status:'processing' as const,percent:0,speed:null,eta:null,message:'Processing',created:Date.now(),listeners:new Set<()=>void>(),cancelled:false};
  const video={url:'https://www.youtube.com/watch?v=aqz-KE-bpKQ',title:'Synthetic owned fixture',duration:2,thumbnail:'',channel:'Test',qualities:[],hasAudio:true};
  await convertToMp4(job,source,output,video,true);
  const info=JSON.parse(await run('ffprobe',['-v','error','-show_streams','-of','json',output]));
  assert.equal(info.streams[0].codec_name,'h264');assert.equal(info.streams[0].pix_fmt,'yuv420p');assert.equal(info.streams[1].codec_name,'aac');
  assert.ok(job.percent>0);
 } finally {await rm(dir,{recursive:true,force:true});}
});
