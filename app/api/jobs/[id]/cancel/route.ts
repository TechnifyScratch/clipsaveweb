import { api } from '@/lib/http';
import { getJob,cancelJob,publicJob } from '@/lib/server';
export const runtime='nodejs';
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}) {return api(req,async()=>{const j=getJob((await params).id);if(!j) throw new Error('Download not found.');cancelJob(j);return publicJob(j);});}
