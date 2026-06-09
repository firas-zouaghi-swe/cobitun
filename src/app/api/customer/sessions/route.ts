import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/services/authorization';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const authOrResp = await requireAuth(request);
  if ((authOrResp as NextResponse).status) return authOrResp as NextResponse;
  const auth = authOrResp as any;

  try {
    const sessions = await prisma.userSession.findMany({
      where: { userId: auth.userIdNum },
      select: { id: true, sessionId: true, ipAddress: true, userAgent: true, createdAt: true, lastActiveAt: true, revokedAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ sessions });
  } catch (err) {
    console.error('Failed to list sessions', err);
    return NextResponse.json({ error: 'Failed to list sessions' }, { status: 500 });
  }
}

