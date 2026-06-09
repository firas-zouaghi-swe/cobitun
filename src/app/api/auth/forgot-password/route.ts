import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { forgotPasswordSchema } from '@/lib/validation';
import { sendPasswordResetEmail } from '@/lib/services/email-service';

/**
 * POST /api/auth/forgot-password
 * Initiates password reset process
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Email is required' },
        { status: 400 }
      );
    }

    const email = parsed.data.email.trim();
    const normalizedEmail = email.toLowerCase();

    // Find user by email case-insensitively using lower() because Prisma client does not support `mode: 'insensitive'` here.
    const users = await prisma.$queryRaw<
      Array<{ id: number; email: string }>
    >`SELECT id, email FROM users WHERE lower(email) = lower(${normalizedEmail}) LIMIT 1`;
    const user = users[0] ?? null;

    // Security: Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json(
        { message: 'If an account exists with this email, a reset link has been sent' },
        { status: 200 }
      );
    }

    // Check if user already has an active reset token
    const existingToken = await prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        expiresAt: { gt: new Date() },
        usedAt: null
      }
    });

    // Clean up old tokens (optional, keep the latest one)
    if (existingToken) {
      // Token already exists and hasn't expired, return success
      return NextResponse.json(
        { message: 'If an account exists with this email, a reset link has been sent' },
        { status: 200 }
      );
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry

    // Create password reset token record
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt
      }
    });

    await sendPasswordResetEmail(user.email, resetToken);
    console.log(`Password reset sent to ${user.email}`);

    // Log action to audit trail
    await prisma.auditLog.create({
      data: {
        entityType: 'User',
        entityId: user.id,
        action: 'PASSWORD_RESET_REQUESTED',
        actionCategory: 'AUTHENTICATION',
        metadataJson: JSON.stringify({ email: user.email })
      }
    });

    return NextResponse.json(
      { message: 'If an account exists with this email, a reset link has been sent' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'An error occurred. Please try again later.' },
      { status: 500 }
    );
  }
}

