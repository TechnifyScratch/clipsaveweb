import { api,body } from '@/lib/http';
import { getVideo } from '@/lib/server';
export const runtime='nodejs';
export async function POST(req:Request) {return api(req,async()=>getVideo((await body(req)).url));}
