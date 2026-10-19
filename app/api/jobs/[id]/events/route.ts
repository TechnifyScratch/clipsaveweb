import { guard,getJob,publicJob } from '@/lib/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}) {
  try {guard(req);} catch {return new Response('Local requests only.',{status:403});}
  const job=getJob((await params).id);
  if(!job) return new Response('Download not found.',{status:404});
  let cleanup=()=>{};
  const stream=new ReadableStream({start(controller){
    let closed=false;
    const finish=()=>{if(closed)return;closed=true;clearInterval(timer);job.listeners.delete(send);req.signal.removeEventListener('abort',finish);try{controller.close();}catch{}};
    const send=()=>{if(closed)return;controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(publicJob(job))}\n\n`));if(['complete','error','cancelled'].includes(job.status))finish();};
    const timer=setInterval(()=>{if(!closed)controller.enqueue(new TextEncoder().encode(': heartbeat\n\n'));},15000);
    cleanup=finish;
    job.listeners.add(send);req.signal.addEventListener('abort',finish);send();
  },cancel(){cleanup();}});
  return new Response(stream,{headers:{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'}});
}
