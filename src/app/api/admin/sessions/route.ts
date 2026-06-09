import { NextRequest, NextResponse } from 'next/server';
import { requireRole, Roles } from '@/lib/services/authorization';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const authOrResp = await requireRole(request, Roles.ADMIN);
  if ((authOrResp as NextResponse).status) return authOrResp as NextResponse;

  try {
    const sessions = await prisma.userSession.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        sessionId: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        lastActiveAt: true,
        revokedAt: true,
        expiresAt: true,
        user: {
          select: {
            username: true,
            email: true,
          },
        },
      },
    });

    const payload = sessions.map((session) => ({
      id: session.id,
      userId: session.userId,
      username: session.user?.username ?? null,
      email: session.user?.email ?? null,
      sessionId: session.sessionId,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      createdAt: session.createdAt.toISOString(),
      lastActiveAt: session.lastActiveAt?.toISOString() ?? null,
      expiresAt: session.expiresAt?.toISOString() ?? null,
      revokedAt: session.revokedAt?.toISOString() ?? null,
    }));

    return NextResponse.json({ sessions: payload });
  } catch (error) {
    console.error('Failed to list admin sessions', error);
    return NextResponse.json({ error: 'Failed to list sessions' }, { status: 500 });
  }
}


