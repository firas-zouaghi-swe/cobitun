import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { REFRESH_COOKIE_NAME, REFRESH_MAX_AGE, IDLE_SESSION_MAX_AGE, isSecureRequest } from '@/lib/session';
import { JWT_COOKIE_NAME, JWT_MAX_AGE, createJwt } from '@/lib/jwt';
import { createHash, randomBytes } from 'crypto';

function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader
      .split(';')
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .map((cookie) => {
        const [name, ...rest] = cookie.split('=');
        return [name, rest.join('=')];
      })
  );
}

export async function POST(request: NextRequest) {
  try {
    const refreshToken =
      request.cookies.get(REFRESH_COOKIE_NAME)?.value ??
      parseCookies(request.headers.get('cookie'))[REFRESH_COOKIE_NAME] ??
      null;
    if (!refreshToken) return NextResponse.json({ error: 'Missing refresh token' }, { status: 401 });

    const refreshHash = createHash('sha256').update(refreshToken).digest('hex');

    const session = await prisma.userSession.findFirst({ where: { refreshTokenHash: refreshHash } });
    if (!session) return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 });
    if (session.revokedAt) return NextResponse.json({ error: 'Session revoked' }, { status: 401 });
    if (session.refreshTokenExpiresAt && session.refreshTokenExpiresAt.getTime() < Date.now()) {
      await prisma.userSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      return NextResponse.json({ error: 'Refresh token expired' }, { status: 401 });
    }

    if (session.expiresAt && session.expiresAt.getTime() < Date.now()) {
      await prisma.userSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }

    const lastActivity = session.lastActiveAt?.getTime() ?? session.createdAt.getTime();
    if (lastActivity + IDLE_SESSION_MAX_AGE * 1000 < Date.now()) {
      await prisma.userSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      return NextResponse.json({ error: 'Session idle timeout' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 401 });
    if (!user.isActive || user.isDeleted) {
      await prisma.userSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      return NextResponse.json({ error: 'Account is inactive or deleted' }, { status: 401 });
    }

    // Create new JWT (same sessionId)
    const jwt = createJwt({ sub: String(user.id), role: (await prisma.enumUserRole.findUnique({ where: { id: user.roleId } }))?.roleCode ?? 'CUSTOMER', sessionId: session.sessionId, email: user.email });

    // Rotate refresh token
    const newRefresh = randomBytes(64).toString('hex');
    const newHash = createHash('sha256').update(newRefresh).digest('hex');
    const newRefreshExpires = new Date(Date.now() + REFRESH_MAX_AGE * 1000);

    await prisma.userSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: newHash,
        refreshTokenExpiresAt: newRefreshExpires,
        lastActiveAt: new Date(),
      },
    });

    const secure = isSecureRequest(request);
    const response = NextResponse.json({ message: 'Refreshed' });
    response.cookies.set({ name: JWT_COOKIE_NAME, value: jwt, httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: JWT_MAX_AGE });
    response.cookies.set({ name: REFRESH_COOKIE_NAME, value: newRefresh, httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: REFRESH_MAX_AGE });

    return response;
  } catch (err) {
    console.error('Refresh token error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

