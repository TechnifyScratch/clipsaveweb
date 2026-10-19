import { api,body } from '@/lib/http';
import { getJob,openJob } from '@/lib/server';
export const runtime='nodejs';
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}) {return api(req,async()=>{const j=getJob((await params).id);if(!j) throw new Error('Download not found.');await openJob(j,(await body(req)).action);return {ok:true};});}
