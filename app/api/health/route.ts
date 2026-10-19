import { api } from '@/lib/http';
import { health } from '@/lib/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:Request) {return api(req,health);}
