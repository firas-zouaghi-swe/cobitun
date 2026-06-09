
/**
 * MFA Challenge API
 * POST - Send MFA challenge code during login flow
 * Called after successful password authentication when MFA is enabled
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { db } from '@/lib/db';
import { Errors, errorResponse, validateRequestBody } from '@/middleware/validation';
import { z } from 'zod';
import { sendMfaOtp, isMfaRequired } from '@/lib/services/mfa-service';
import { logAction } from '@/lib/services/audit-service';
import { createHmac } from 'crypto';

const challengeSchema = z.object({
  userId: z.preprocess((value) => {
    if (typeof value === 'string' && /^[0-9]+$/.test(value)) {
      return Number(value);
    }
    return value;
  }, z.number().int().positive()),
  // Pre-auth token: proves the user passed password check
  // This is a HMAC of the userId to prevent arbitrary OTP requests
  preAuthToken: z.string().optional(),
});

// Verify pre-auth token (HMAC of userId proving password was verified)
function verifyPreAuthToken(userId: number, token: string): boolean {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');
  const secret = process.env.JWT_SECRET!;
  const expected = createHmac('sha256', secret).update(`mfa-pre-auth:${userId}`).digest('hex');
  const tokenBuf = Buffer.from(token, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');
  return tokenBuf.length === expectedBuf.length && tokenBuf.equals(expectedBuf);
}

function resolvePreAuthToken(request: NextRequest, bodyToken?: string): string | null {
  if (bodyToken && typeof bodyToken === 'string' && bodyToken.trim().length > 0) {
    return bodyToken;
  }
  const headerToken = request.headers.get('x-pre-auth-token');
  return headerToken && headerToken.trim().length > 0 ? headerToken : null;
}

export async function POST(request: NextRequest) {
  const result = await validateRequestBody(request, challengeSchema, {
    skipFields: ['password', 'passwordHash', 'passwordSalt', 'tokenHash', 'refreshTokenHash', 'preAuthToken'],
    sanitize: false, // Disable sanitization — preAuthToken is a hex HMAC that can trigger false-positive SQL/XSS detection
  });
  if ('error' in result) return result.error;

  try {
    const { userId, preAuthToken: bodyPreAuthToken } = result.data;
    const preAuthToken = resolvePreAuthToken(request, bodyPreAuthToken);

    console.info('[MFA] challenge request', {
      userId,
      tokenSource: bodyPreAuthToken ? 'body' : request.headers.get('x-pre-auth-token') ? 'header' : 'none',
    });

    // Verify pre-auth token to prevent arbitrary OTP requests
    if (!preAuthToken || !verifyPreAuthToken(userId, preAuthToken)) {
      return errorResponse('Invalid or missing pre-authentication token', 'PRE_AUTH_REQUIRED', 401);
    }

    // Check if MFA is required for this user
    const required = await isMfaRequired(userId);
    if (!required) {
      return NextResponse.json({ mfaRequired: false, message: 'MFA not required for this user' });
    }

    // Get user email
    const user = await db.user.findFirst({
      where: { id: userId, isDeleted: 0, isActive: 1 },
      select: { email: true },
    });

    if (!user) return Errors.notFound('User');

    // Send MFA OTP
    const sendResult = await sendMfaOtp(userId, user.email);

    if (!sendResult.success) {
      return errorResponse(sendResult.message, 'MFA_CHALLENGE_FAILED', 400);
    }

    // Non-blocking audit log — don't let audit failures break MFA flow
    logAction({
      entityType: 'User',
      entityId: userId,
      action: 'MFA_CHALLENGE_SENT',
      actionCategory: 'AUTH',
      actorId: userId,
      actorType: 'SYSTEM',
      metadata: { method: 'email_otp' },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    }).catch((err) => console.error('[MFA] Audit log failed:', err));

    return NextResponse.json({
      mfaRequired: true,
      method: 'email_otp',
      message: sendResult.message,
      expiresAt: sendResult.expiresAt?.toISOString(),
    });
  } catch (error) {
    console.error('MFA challenge failed:', error);
    return Errors.internal();
  }
}

