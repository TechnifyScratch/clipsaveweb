import { NextResponse } from 'next/server';
import { sameOrigin, secureRequest, sessionCookieName } from '@/lib/auth';
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Invalid request.' }, { status: 403 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName(req), '', { httpOnly: true, secure: secureRequest(req), sameSite: 'strict', path: '/', maxAge: 0 });
  return response;
}
