import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { hashPassword, splitPasswordHash } from '@/lib/auth';
import { resetPasswordSchema } from '@/lib/validation';

/**
 * POST /api/auth/reset-password
 * Completes password reset
 */
export async function POST(request: NextRequest) {
  try {
    const validated = await (await import('@/lib/validation-middleware')).validateJsonBody(request, resetPasswordSchema);
    if ((validated as any).status) return validated as NextResponse;
    const { token, newPassword, confirmPassword } = validated as { token: string; newPassword: string; confirmPassword: string };

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 });
    }

    if (newPassword.length < 12) {
      return NextResponse.json(
        { error: 'Password must be at least 12 characters long' },
        { status: 400 }
      );
    }

    // Validate password strength (uppercase, lowercase, number, symbol)
    const passwordStrengthRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;
    if (!passwordStrengthRegex.test(newPassword)) {
      return NextResponse.json(
        { error: 'Password must contain uppercase, lowercase, number, and symbol' },
        { status: 400 }
      );
    }

    // Hash the token to find it
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find and validate reset token
    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        expiresAt: { gt: new Date() },
        usedAt: null
      }
    });

    if (!resetToken) {
      return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 });
    }

    // Get the user
    const user = await prisma.user.findUnique({
      where: { id: resetToken.userId }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Hash new password and store the hash consistently
    const newPasswordHash = await hashPassword(newPassword);
    const { passwordSalt: newSalt, passwordHash: newDerivedKey } = splitPasswordHash(newPasswordHash);

    // Update password, mark token as used, and invalidate all sessions (transactional)
    const result = await prisma.$transaction([
      // Update user password
      prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: newDerivedKey,
          passwordSalt: newSalt,
          passwordChangedAt: new Date(),
          failedLoginCount: 0,
          lockedUntil: null
        }
      }),
      // Mark token as used
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() }
      }),
      // Revoke all active sessions
      prisma.userSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() }
      })
    ]);

    // Log action to audit trail
    await prisma.auditLog.create({
      data: {
        entityType: 'User',
        entityId: user.id,
        action: 'PASSWORD_RESET_COMPLETED',
        actionCategory: 'AUTHENTICATION',
        metadataJson: JSON.stringify({ email: user.email })
      }
    });

    return NextResponse.json(
      { message: 'Password reset successfully. Please log in with your new password.' },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'An error occurred. Please try again later.' },
      { status: 500 }
    );
  }
}

