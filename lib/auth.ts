import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const SESSION_SECONDS = 60 * 60 * 8;
export const SESSION_COOKIE = 'clipsave-session';
export const SECURE_SESSION_COOKIE = '__Host-clipsave-session';
const HASH_PATTERN = /^scrypt:([a-f0-9]{32}):([a-f0-9]{128})$/;

export function authConfigured() {
  return HASH_PATTERN.test(process.env.APP_PASSWORD_HASH || '') && (process.env.SESSION_SECRET?.length || 0) >= 32;
}
export function verifyPassword(password: unknown) {
  if (!authConfigured() || typeof password !== 'string' || password.length > 1024) return false;
  const match = HASH_PATTERN.exec(process.env.APP_PASSWORD_HASH!)!;
  const derived = scryptSync(password, match[1], 64);
  return timingSafeEqual(derived, Buffer.from(match[2], 'hex'));
}
function sign(payload: string) {
  // Including the password hash invalidates existing sessions when the password changes.
  return createHmac('sha256', process.env.SESSION_SECRET!).update(`${process.env.APP_PASSWORD_HASH}:${payload}`).digest('base64url');
}
export function createSession(now = Date.now()) {
  if (!authConfigured()) throw new Error('Password protection is not configured.');
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(now / 1000) + SESSION_SECONDS, nonce: randomBytes(16).toString('hex') })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}
export function verifySession(token: string | undefined, now = Date.now()) {
  if (!authConfigured() || !token || token.length > 512) return false;
  const parts = token.split('.');
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]{43}$/.test(parts[1])) return false;
  const expected = Buffer.from(sign(parts[0]));
  const actual = Buffer.from(parts[1]);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
  try {
    const data = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    const current = Math.floor(now / 1000);
    return Number.isInteger(data.exp) && data.exp > current && data.exp <= current + SESSION_SECONDS;
  } catch { return false; }
}
export function secureRequest(req: Request) {
  return process.env.VERCEL === '1' || new URL(req.url).protocol === 'https:' || (process.env.APP_ORIGIN || process.env.RENDER_EXTERNAL_URL)?.startsWith('https://') === true;
}
export function sessionCookieName(req: Request) { return secureRequest(req) ? SECURE_SESSION_COOKIE : SESSION_COOKIE; }
export function cookieToken(req: Request) {
  const name = sessionCookieName(req);
  return req.headers.get('cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith(`${name}=`))?.slice(name.length + 1);
}
export function authenticated(req: Request) { return verifySession(cookieToken(req)); }
export function sameOrigin(req: Request) {
  // Vercel preserves the incoming Host; APP_ORIGIN pins a custom-domain deployment.
  const origin = req.headers.get('origin');
  const configured = process.env.APP_ORIGIN || process.env.RENDER_EXTERNAL_URL;
  const expected = configured ? new URL(configured).origin : new URL(req.url).origin;
  return origin === expected && req.headers.get('sec-fetch-site') !== 'cross-site';
}
