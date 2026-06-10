import { NextRequest, NextResponse } from 'next/server';

// Ensure this module is only used on the server side
if (typeof window !== 'undefined') {
  throw new Error('session.ts is a server-side module and should not be imported on the client side');
}
import { createJwt, createSessionId, JWT_COOKIE_NAME, JWT_MAX_AGE } from './jwt';
import { createCsrfToken, CSRF_COOKIE_NAME } from './csrf';
import { prisma } from './prisma';
import { randomBytes, createHash } from 'crypto';

export interface AuthResponseOptions {
  secure?: boolean;
}

export function isSecureRequest(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== 'production') return false;

  const forwardedProto = request.headers.get('x-forwarded-proto') || request.headers.get('x-forwarded-protocol');
  const forwardedSsl = request.headers.get('x-forwarded-ssl');
  const urlScheme = request.headers.get('x-url-scheme');

  if (forwardedSsl) {
    return forwardedSsl.toLowerCase() === 'on';
  }

  if (forwardedProto) {
    return forwardedProto.toLowerCase().startsWith('https');
  }

  if (urlScheme) {
    return urlScheme.toLowerCase() === 'https';
  }

  if (request.nextUrl.protocol) {
    return request.nextUrl.protocol.toLowerCase() === 'https:';
  }

  // In production, assume HTTPS if the request did not explicitly indicate otherwise.
  return true;
}

export interface SessionUserPayload {
  id: number;
  role: string;
  email?: string | null;
}

export const REFRESH_COOKIE_NAME = 'cobitun_refresh';
export const REFRESH_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
export const IDLE_SESSION_MAX_AGE = 60 * 30; // 30 minutes
export const ABSOLUTE_SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours
export const MAX_CONCURRENT_SESSIONS = parseInt(process.env.MAX_CONCURRENT_SESSIONS || '3', 10);

export async function createAuthResponse(
  body: Record<string, unknown>,
  user: SessionUserPayload,
  options: AuthResponseOptions = {}
): Promise<NextResponse> {
  const sessionId = createSessionId();
  const jwt = createJwt({
    sub: String(user.id),
    role: user.role,
    sessionId,
    email: user.email ?? null,
  });
  const csrfToken = createCsrfToken();
  const now = Date.now();
  // Generate refresh token and hash it for storage
  const refreshToken = randomBytes(64).toString('hex');
  const refreshHash = createHash('sha256').update(refreshToken).digest('hex');
  const refreshExpires = new Date(now + REFRESH_MAX_AGE * 1000);
  const absoluteExpires = new Date(now + ABSOLUTE_SESSION_MAX_AGE * 1000);

  const cookieDomain = process.env.SESSION_COOKIE_DOMAIN;
  const secure = options.secure ?? process.env.NODE_ENV === 'production';
  const sameSite = secure ? 'none' : 'lax';
  const baseCookieOptions: { path: string; secure: boolean; sameSite: 'none' | 'lax'; domain?: string } = {
    path: '/',
    secure,
    sameSite,
  };
  if (cookieDomain) {
    baseCookieOptions.domain = cookieDomain;
  }

  // Persist session record with refresh token
  try {
    await prisma.userSession.create({
      data: {
        userId: user.id,
        sessionId,
        createdAt: new Date(now),
        lastActiveAt: new Date(now),
        expiresAt: absoluteExpires,
        refreshTokenHash: refreshHash,
        refreshTokenExpiresAt: refreshExpires,
      },
    });
  } catch (err) {
    throw new Error('Failed to create authenticated session');
  }


  // Enforce concurrent session limits: revoke oldest sessions if over limit
  try {
    const activeSessions = await prisma.userSession.findMany({
      where: {
        userId: user.id,
        revokedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (activeSessions.length > MAX_CONCURRENT_SESSIONS) {
      const toRevoke = activeSessions.slice(0, activeSessions.length - MAX_CONCURRENT_SESSIONS);
      const ids = toRevoke.map((s) => s.id);
      await prisma.userSession.updateMany({ where: { id: { in: ids } }, data: { revokedAt: new Date() } });
    }
  } catch (err) {
     }   // Failed to enforce concurrent session limits

  const response = NextResponse.json({ ...body, csrfToken });

  response.cookies.set({
    name: JWT_COOKIE_NAME,
    value: jwt,
    httpOnly: true,
    ...baseCookieOptions,
    maxAge: JWT_MAX_AGE,
  });
  response.cookies.set({
    name: CSRF_COOKIE_NAME,
    value: csrfToken,
    httpOnly: false,
    ...baseCookieOptions,
    maxAge: JWT_MAX_AGE,
  });

  // Set refresh token cookie (rotating, httpOnly)
  response.cookies.set({
    name: REFRESH_COOKIE_NAME,
    value: refreshToken,
    httpOnly: true,
    ...baseCookieOptions,
    maxAge: REFRESH_MAX_AGE,
  });

  return response;
}

export function clearAuthCookies(response: NextResponse, secure?: boolean) {
  const cookieDomain = process.env.SESSION_COOKIE_DOMAIN;
  const cookieOptions: { path: string; secure?: boolean; domain?: string } = {
    path: '/',
    secure,
  };
  if (cookieDomain) {
    cookieOptions.domain = cookieDomain;
  }

  response.cookies.delete({ name: JWT_COOKIE_NAME, ...cookieOptions });
  response.cookies.delete({ name: CSRF_COOKIE_NAME, ...cookieOptions });
  response.cookies.delete({ name: REFRESH_COOKIE_NAME, ...cookieOptions });
  return response;
}

