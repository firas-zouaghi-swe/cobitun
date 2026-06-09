import { NextRequest, NextResponse } from 'next/server';
import { clearAuthCookies, isSecureRequest } from '@/lib/session';
import { verifyJwt, JWT_COOKIE_NAME } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ message: 'Logged out' });

  // Try to revoke session record if present
  try {
    const token = request.cookies.get(JWT_COOKIE_NAME)?.value ?? null;
    const payload = token ? verifyJwt(token) : null;
    if (payload?.sessionId) {
      await prisma.userSession.updateMany({
        where: { sessionId: payload.sessionId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  } catch (err) {
    console.error('Failed to revoke session on logout', err);
  }

  const secure = isSecureRequest(request);
  clearAuthCookies(response, secure);
  return response;
}

