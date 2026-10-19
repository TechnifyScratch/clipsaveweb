import { NextRequest, NextResponse } from 'next/server';
import { authenticated } from './lib/auth';

export function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const isPublic = pathname === '/login' || pathname === '/api/auth/login';
  const response = isPublic || authenticated(req)
    ? NextResponse.next()
    : pathname.startsWith('/api/')
      ? NextResponse.json({ error: 'Please sign in to ClipSave.' }, { status: 401 })
      : NextResponse.redirect(new URL('/login', req.url));
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-Frame-Options', 'DENY');
  return response;
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
