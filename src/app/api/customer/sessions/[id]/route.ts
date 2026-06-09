import { NextRequest, NextResponse } from 'next/server';
import { requireRole, Roles, isOwnerOrAdmin } from '@/lib/services/authorization';
import { prisma } from '@/lib/prisma';

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const authOrResp = await requireRole(request, [Roles.CUSTOMER, Roles.ADMIN]);
  if ((authOrResp as NextResponse).status) return authOrResp as NextResponse;
  const auth = authOrResp as any;

  const sessionIdNum = parseInt(params.id, 10);
  if (isNaN(sessionIdNum)) {
    return NextResponse.json({ error: 'Invalid session id' }, { status: 400 });
  }

  try {
    const session = await prisma.userSession.findUnique({ where: { id: sessionIdNum } });
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    // Ensure ownership or admin
    if (!isOwnerOrAdmin(auth, session.userId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.userSession.update({ where: { id: sessionIdNum }, data: { revokedAt: new Date() } });

    return NextResponse.json({ message: 'Session revoked' });
  } catch (err) {
    console.error('Failed to revoke session', err);
    return NextResponse.json({ error: 'Failed to revoke session' }, { status: 500 });
  }
}

