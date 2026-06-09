import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, splitPasswordHash, verifyPassword } from '@/lib/auth';
import { requireAuth } from '@/lib/services/authorization';
import { validateJsonBody } from '@/lib/validation-middleware';
import { changePasswordSchema } from '@/lib/validation';

export async function POST(request: NextRequest) {
  try {
    const authOrResp = await requireAuth(request);
    if ((authOrResp as any).status) return authOrResp as NextResponse;

    const auth = authOrResp as { userIdNum: number; sessionId?: string };
    const validated = await validateJsonBody(request, changePasswordSchema);
    if ((validated as any).status) return validated as NextResponse;
    const { currentPassword, newPassword } = validated as { currentPassword: string; newPassword: string };
    const user = await db.user.findUnique({
      where: { id: auth.userIdNum },
      select: { id: true, passwordHash: true, passwordSalt: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Authenticated user not found' }, { status: 404 });
    }

    const stored = user.passwordSalt ? `${user.passwordSalt}:${user.passwordHash}` : user.passwordHash;
    const isCurrentValid = await verifyPassword(currentPassword, stored);

    if (!isCurrentValid) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
    }

    const hashedPassword = await hashPassword(newPassword);
    const { passwordSalt: newSalt, passwordHash: newDerivedKey } = splitPasswordHash(hashedPassword);

    const revokeWhere: Record<string, unknown> = {
      userId: auth.userIdNum,
      revokedAt: null,
    };
    if (auth.sessionId) {
      revokeWhere.sessionId = { not: auth.sessionId };
    }

    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: {
          passwordHash: newDerivedKey,
          passwordSalt: newSalt,
          passwordChangedAt: new Date(),
          failedLoginCount: 0,
          lockedUntil: null,
        },
      }),
      db.userSession.updateMany({
        where: revokeWhere,
        data: { revokedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ message: 'Password changed successfully' }, { status: 200 });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

