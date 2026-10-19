import { api } from '@/lib/http';
import { getJob,publicJob } from '@/lib/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}) {return api(req,async()=>{const j=getJob((await params).id);if(!j) throw new Error('Download not found.');return publicJob(j);});}
