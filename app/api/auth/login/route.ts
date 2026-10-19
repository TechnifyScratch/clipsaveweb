import { NextResponse } from 'next/server';
import { authConfigured, createSession, sameOrigin, secureRequest, sessionCookieName, SESSION_SECONDS, verifyPassword } from '@/lib/auth';
export const runtime = 'nodejs';

// Best-effort per-instance rate limit; a strong password remains mandatory.
const attempts = new Map<string, { count: number; expires: number }>();
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Use the sign-in form on this website.' }, { status: 403 });
  if (!authConfigured()) return NextResponse.json({ error: 'Set up your private password in the environment first. See DEPLOYMENT.md.' }, { status: 503 });
  const ip = process.env.VERCEL === '1' ? req.headers.get('x-vercel-forwarded-for') || 'unknown' : 'local';
  const now = Date.now();
  for (const [key, value] of attempts) if (value.expires <= now) attempts.delete(key);
  if (attempts.size > 1000) return NextResponse.json({ error: 'Too many sign-in attempts. Try again later.' }, { status: 429 });
  const bucket = attempts.get(ip) || { count: 0, expires: now + 15 * 60_000 };
  if (bucket.count >= 10) return NextResponse.json({ error: 'Too many sign-in attempts. Try again in 15 minutes.' }, { status: 429 });
  bucket.count++; attempts.set(ip, bucket);
  if (!req.headers.get('content-type')?.includes('application/json')) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  try {
    const raw = await req.text();
    if (raw.length > 2048) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    const { password } = JSON.parse(raw);
    if (!verifyPassword(password)) return NextResponse.json({ error: 'That password isn’t correct.' }, { status: 401 });
    const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
    response.cookies.set(sessionCookieName(req), createSession(), { httpOnly: true, secure: secureRequest(req), sameSite: 'strict', path: '/', maxAge: SESSION_SECONDS });
    return response;
  } catch { return NextResponse.json({ error: 'Unable to sign in. Please try again.' }, { status: 400 }); }
}
