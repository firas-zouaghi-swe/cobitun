import { randomBytes, timingSafeEqual } from 'crypto';
import { NextRequest } from 'next/server';

// Ensure this module is only used on the server side
if (typeof window !== 'undefined') {
  throw new Error('csrf.ts is a server-side module and should not be imported on the client side');
}

export const CSRF_HEADER_NAME = 'x-csrf-token';
export const CSRF_COOKIE_NAME = 'XSRF-TOKEN';

export function createCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

export function verifyCsrfToken(request: NextRequest): boolean {
  const headerToken = request.headers.get(CSRF_HEADER_NAME);
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  if (!headerToken || !cookieToken) {
    return false;
  }

  const headerBuffer = Buffer.from(headerToken, 'utf8');
  const cookieBuffer = Buffer.from(cookieToken, 'utf8');
  if (headerBuffer.length !== cookieBuffer.length) {
    return false;
  }

  return timingSafeEqual(headerBuffer, cookieBuffer);
}

