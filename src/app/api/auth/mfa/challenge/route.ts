
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
import { getMissingEnv } from '@/lib/env-check';

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
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Missing secret — cannot verify token. Return false so the caller
    // responds with a 401 instead of crashing with a 500.
    return false;
  }

  const expected = createHmac('sha256', secret).update(`mfa-pre-auth:${userId}`).digest('hex');
  try {
    const tokenBuf = Buffer.from(token, 'utf8');
    const expectedBuf = Buffer.from(expected, 'utf8');
    if (tokenBuf.length !== expectedBuf.length) return false;
    return tokenBuf.equals(expectedBuf);
  } catch (err) {
    return false;
  }
}

function resolvePreAuthToken(request: NextRequest, bodyToken?: string): string | null {
  if (bodyToken && typeof bodyToken === 'string' && bodyToken.trim().length > 0) {
    return bodyToken;
  }
  const headerToken = request.headers.get('x-pre-auth-token');
  return headerToken && headerToken.trim().length > 0 ? headerToken : null;
}

export async function POST(request: NextRequest) {
  // Fast-fail when critical environment variables are missing. This provides
  // a clear, actionable error instead of allowing a downstream exception
  // to surface as a generic 500.
  const missing = getMissingEnv(['JWT_SECRET']);
  if (missing.length) {
    return errorResponse(
      'Server misconfiguration: missing environment variables',
      'MISSING_ENV',
      500,
      missing.map((m) => ({ field: m, message: 'Missing required environment variable', code: 'MISSING_ENV' }))
    );
  }

  const result = await validateRequestBody(request, challengeSchema, {
    skipFields: ['password', 'passwordHash', 'passwordSalt', 'tokenHash', 'refreshTokenHash', 'preAuthToken'],
    sanitize: false, // Disable sanitization — preAuthToken is a hex HMAC that can trigger false-positive SQL/XSS detection
  });
  if ('error' in result) return result.error;

  try {
    const { userId, preAuthToken: bodyPreAuthToken } = result.data;
    const preAuthToken = resolvePreAuthToken(request, bodyPreAuthToken);

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
    if (!user.email || !user.email.trim()) {
      return errorResponse('User does not have a valid email address for MFA delivery', 'MFA_INVALID_EMAIL', 400);
    }

    // Send MFA OTP
    const sendResult = await sendMfaOtp(userId, user.email);

    if (!sendResult.success) {
      const status = sendResult.errorCode === 'EMAIL_DELIVERY_FAILED' ? 500 : 400;
      return errorResponse(sendResult.message, 'MFA_CHALLENGE_FAILED', status);
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
    }).catch((err) => {/* Ignore audit log errors */});

    return NextResponse.json({
      mfaRequired: true,
      method: 'email_otp',
      message: sendResult.message,
      expiresAt: sendResult.expiresAt?.toISOString(),
    });
  } catch (error) {
    return Errors.internal();
  }
}

