import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import { NextRequest } from 'next/server';
import { authConfigured, verifyPassword, createSession, verifySession, authenticated, SESSION_COOKIE, SECURE_SESSION_COOKIE, sameOrigin } from '../lib/auth';
import { proxy } from '../proxy';
import { POST as login } from '../app/api/auth/login/route';
import { POST as logout } from '../app/api/auth/logout/route';

// Ephemeral fixture values; no real environment file is read or printed.
const password = randomBytes(24).toString('base64url');
const salt = randomBytes(16).toString('hex');
process.env.APP_PASSWORD_HASH = `scrypt:${salt}:${scryptSync(password,salt,64).toString('hex')}`;
process.env.SESSION_SECRET = randomBytes(32).toString('hex');
delete process.env.APP_ORIGIN; delete process.env.VERCEL;
const url = 'https://clipsave.example.com';
function req(path:string,value:unknown,origin=url) {return new Request(url+path,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(value)});}

test('password verification is server-side, bounded, and rejects wrong values',()=>{
 assert.equal(authConfigured(),true);assert.equal(verifyPassword(password),true);assert.equal(verifyPassword('wrong'),false);assert.equal(verifyPassword(null),false);assert.equal(verifyPassword('x'.repeat(1025)),false);
});
test('sessions reject tampering, expiry, malformed values and password rotation',()=>{
 const now=Date.now();const token=createSession(now);
 assert.equal(verifySession(token,now),true);
 assert.equal(verifySession(token,now+9*60*60_000),false);
 assert.equal(verifySession(token+'x',now),false);
 assert.equal(verifySession('bad.value.extra',now),false);
 const old=process.env.APP_PASSWORD_HASH!;
 process.env.APP_PASSWORD_HASH=old.slice(0,-1)+(old.endsWith('a')?'b':'a');
 assert.equal(verifySession(token,now),false);process.env.APP_PASSWORD_HASH=old;
});
test('missing configuration fails closed',()=>{
 const old=process.env.SESSION_SECRET;delete process.env.SESSION_SECRET;
 assert.equal(authConfigured(),false);assert.equal(verifyPassword(password),false);assert.equal(verifySession('anything'),false);assert.throws(()=>createSession());process.env.SESSION_SECRET=old;
});
test('password gate protects both pages and API endpoints',()=>{
 assert.equal(proxy(new NextRequest(url+'/')).status,307);
 assert.equal(proxy(new NextRequest(url+'/api/health')).status,401);
 assert.equal(proxy(new NextRequest(url+'/login')).status,200);
 const headers={cookie:`${SECURE_SESSION_COOKIE}=${createSession()}`};
 assert.equal(proxy(new NextRequest(url+'/',{headers})).status,200);
 assert.equal(authenticated(new Request(url,{headers})),true);
 assert.equal(authenticated(new Request(url,{headers:{cookie:`${SESSION_COOKIE}=${createSession()}`}})),false);
});
test('login rejects cross-site requests and sets an HTTP-only secure cookie',async()=>{
 assert.equal(sameOrigin(req('/api/auth/login',{},'https://evil.test')),false);
 assert.equal((await login(req('/api/auth/login',{password},'https://evil.test'))).status,403);
 assert.equal((await login(req('/api/auth/login',{password:'wrong'}))).status,401);
 const response=await login(req('/api/auth/login',{password}));
 assert.equal(response.status,200);
 const cookie=response.headers.get('set-cookie')!;
 assert.ok(cookie.includes('HttpOnly'));assert.ok(cookie.includes('Secure'));assert.ok(cookie.includes('SameSite=strict'));assert.ok(cookie.startsWith(SECURE_SESSION_COOKIE+'='));
 const body=await response.text();assert.equal(body.includes(password),false);assert.equal(body.includes(process.env.APP_PASSWORD_HASH!),false);
});
test('logout expires session cookie and refuses cross-site requests',async()=>{
 assert.equal((await logout(req('/api/auth/logout',{},'https://evil.test'))).status,403);
 const response=await logout(req('/api/auth/logout',{}));assert.equal(response.status,200);assert.ok(response.headers.get('set-cookie')!.includes('Max-Age=0'));
});
test('repeated failed login attempts are throttled',async()=>{
 let response:Response|undefined;
 for(let i=0;i<11;i++) response=await login(req('/api/auth/login',{password:'incorrect'}));
 assert.equal(response!.status,429);
});
test('file download endpoint checks auth and streams only a completed job',async()=>{
 const { GET }=await import('../app/api/jobs/[id]/file/route');
 const { mkdtemp,writeFile,rm }=await import('node:fs/promises');
 const { tmpdir }=await import('node:os');
 const path=await import('node:path');
 const dir=await mkdtemp(path.join(tmpdir(),'clipsave-file-test-'));
 const id='completed-test-job';
 const context={params:Promise.resolve({id})};
 const requestUrl='http://localhost:3000/api/jobs/'+id+'/file';
 assert.equal((await GET(new Request(requestUrl),context)).status,401);
 try {
  const filename=path.join(dir,'test.mp4');await writeFile(filename,'owned-fixture');
  const globals=globalThis as typeof globalThis & {clipJobs:Map<string,unknown>};
  globals.clipJobs.set(id,{id,status:'complete',file:filename,filename:'Lesson ü.mp4',created:Date.now(),listeners:new Set(),cancelled:false});
  const headers={host:'localhost:3000',cookie:`${SESSION_COOKIE}=${createSession()}`};
  const response=await GET(new Request(requestUrl,{headers}),context);
  assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'video/mp4');assert.ok(response.headers.get('content-disposition')!.includes('filename*=UTF-8'));
  assert.equal(await response.text(),'owned-fixture');
  globals.clipJobs.delete(id);
 } finally {await rm(dir,{recursive:true,force:true});}
});
test('Vercel mode clearly disables download jobs instead of executing child processes',async()=>{
 const {api}=await import('../lib/http');const original=process.env.VERCEL;process.env.VERCEL='1';let called=false;
 try {
  const headers={cookie:`${SECURE_SESSION_COOKIE}=${createSession()}`};
  const response=await api(new Request('https://clipsave.example.com/api/jobs',{headers}),()=>{called=true;return {};});
  assert.equal(response.status,503);assert.equal(called,false);
 }finally{if(original===undefined)delete process.env.VERCEL;else process.env.VERCEL=original;}
});
