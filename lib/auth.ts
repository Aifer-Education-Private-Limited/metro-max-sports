import 'server-only';
import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

export const ADMIN_COOKIE = 'sf_admin';
const MAX_AGE = 60 * 60 * 24 * 30;

const token = (key: string) => createHmac('sha256', key).update('sportsfest-admin-v1').digest('hex');
const adminKey = () => process.env.ADMIN_KEY || '';

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function checkAdminKey(key: string) {
  return !!adminKey() && safeEqual(token(String(key || '')), token(adminKey()));
}

export async function isAdmin() {
  if (!adminKey()) return false;
  const c = (await cookies()).get(ADMIN_COOKIE)?.value || '';
  return safeEqual(c, token(adminKey()));
}

export async function setAdminCookie(req: Request) {
  const secure = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : req.headers.get('x-forwarded-proto')?.split(',')[0].trim() === 'https';
  (await cookies()).set(ADMIN_COOKIE, token(adminKey()), {
    httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: MAX_AGE,
  });
}

export async function clearAdminCookie() {
  (await cookies()).delete(ADMIN_COOKIE);
}
