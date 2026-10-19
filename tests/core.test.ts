import {test} from 'node:test';
import assert from 'node:assert/strict';
import {youtubeUrl,qualityOptions,safeName,parseProgress,friendlyError} from '../lib/core';
import {guard,saveUnique,run,getJob,startJob,cancelJob} from '../lib/server';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
test('normalizes supported URLs and discards playlist and tracking parameters',()=>{
 for(const u of ['https://www.youtube.com/watch?v=BaW_jenozKc&list=other&t=12','https://youtu.be/BaW_jenozKc?si=abc','https://m.youtube.com/shorts/BaW_jenozKc','https://www.youtube.com/embed/BaW_jenozKc']) assert.equal(youtubeUrl(u),'https://www.youtube.com/watch?v=BaW_jenozKc');
});
test('rejects injection, lookalike domains, credentials and non-video links',()=>{
 for(const u of ['file:///etc/passwd','https://youtube.com.evil.test/watch?v=BaW_jenozKc','https://youtube.com@evil.test/watch?v=BaW_jenozKc','https://youtube.com:4430/watch?v=BaW_jenozKc','https://youtube.com/playlist?list=x','$(touch /tmp/bad)','https://youtu.be/notvalid']) assert.throws(()=>youtubeUrl(u));
});
test('quality list contains actual non-DRM video resolutions only',()=>assert.deepEqual(qualityOptions([{height:720,vcodec:'avc1'},{height:360,vcodec:'avc1'},{height:1080,vcodec:'avc1',has_drm:true},{height:480,vcodec:'none'},{height:720,vcodec:'vp9'}]),[360,720]));
test('safe filename cannot escape Downloads',()=>{assert.equal(safeName('../../bad/file:*?'),'badfile');assert.equal(safeName('...'),'YouTube video');});
test('parses real progress JSON and unknown totals',()=>{
 assert.deepEqual(parseProgress('CLIP_PROGRESS:{"downloaded_bytes":50,"total_bytes":100,"speed":42,"eta":2}'),{percent:50,speed:42,eta:2});
 assert.deepEqual(parseProgress('CLIP_PROGRESS:{"downloaded_bytes":50}'),{percent:null,speed:null,eta:null});
 assert.equal(parseProgress('unrelated output'),null);
});
test('blocks remote hosts and cross-origin mutations',()=>{
 assert.doesNotThrow(()=>guard(new Request('http://localhost:3000',{headers:{host:'localhost:3000',origin:'http://localhost:3000'}})));
 for(const headers of [{host:'evil.test'},{host:'localhost:3000',origin:'https://evil.test'},{host:'127.0.0.1:3000','sec-fetch-site':'cross-site'}])assert.throws(()=>guard(new Request('http://localhost:3000',{headers:new Headers(Object.entries(headers).filter((entry):entry is [string,string]=>typeof entry[1]==='string'))})));
});
test('friendly errors cover missing dependencies, disk, access and conversion',()=>{
 for(const message of ['ENOSPC','spawn ENOENT','Private video','HTTP Error 403','ffmpeg conversion failed']) assert.ok(friendlyError(message).length>20);
});
test('publishes files atomically without overwriting duplicates',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'clipsave-test-'));
 try{const src=path.join(dir,'source');await writeFile(src,'valid-test-bytes');const first=await saveUnique(src,'Lesson',dir);const second=await saveUnique(src,'Lesson',dir);assert.equal(first.filename,'Lesson.mp4');assert.equal(second.filename,'Lesson (1).mp4');assert.equal(await readFile(first.file,'utf8'),'valid-test-bytes');}finally{await rm(dir,{recursive:true,force:true});}
});
test('child process runner returns output and handles missing commands',async()=>{
 assert.equal((await run(process.execPath,['-e','console.log("ok")'])).trim(),'ok');await assert.rejects(run('clipsave-nonexistent-tool',[]));
});
test('cancellation terminates the active child and changes job state',async()=>{
 const job={id:'test',status:'downloading' as const,percent:0,speed:null,eta:null,message:'Downloading',created:Date.now(),listeners:new Set<()=>void>(),cancelled:false,child:undefined as import('node:child_process').ChildProcess|undefined};
 let notified=false;job.listeners.add(()=>{notified=true;});
 const pending=run(process.execPath,['-e','setInterval(()=>{},1000)'],{job});
 const rejected=assert.rejects(pending);
 await new Promise(resolve=>setTimeout(resolve,100));
 cancelJob(job);await rejected;
 assert.equal(job.cancelled,true);assert.equal(job.status,'cancelled');assert.equal(notified,true);
});
