import { guard } from './server';
import { friendlyError } from './core';
export async function api(req:Request,fn:()=>Promise<unknown>|unknown) {
  if(process.env.VERCEL==='1' && new URL(req.url).pathname!=='/api/health') return Response.json({error:'This deployment needs a video processor. See DEPLOYMENT.md for free hosting options.'},{status:503});
  if(process.env.VERCEL==='1') {const result=await fn();return Response.json(result);}
  try {guard(req);const result=await fn();return result instanceof Response?result:Response.json(result);}
  catch(e) {
    const message=e instanceof Error ? e.message : '';
    const safe=/^(Paste |Use a standard|That link|Choose an available|A download is already|Invalid preset|Live streams|No supported|This file|Finder actions|Invalid file|Download not found|Local requests)/.test(message);
    return Response.json({error:safe?message:friendlyError(message)},{status:message==='Local requests only.'?403:400});
  }
}
export async function body(req:Request) {
  if(!req.headers.get('content-type')?.includes('application/json')) throw new Error('Invalid preset.');
  const text=await req.text();
  if(text.length>4096) throw new Error('Paste a shorter YouTube link.');
  return JSON.parse(text);
}
