import { api,body } from '@/lib/http';
import { startJob } from '@/lib/server';
export const runtime='nodejs';
export async function POST(req:Request) {return api(req,async()=>{const b=await body(req);return startJob(b.url,b.quality,b.canvas);});}
