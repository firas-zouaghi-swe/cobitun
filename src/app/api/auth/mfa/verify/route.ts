
/**
 * MFA Verify API
 * POST - Verify MFA OTP code (for setup confirmation or login verification)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { db } from '@/lib/db';
import { Errors, errorResponse, validateRequestBody } from '@/middleware/validation';
import { z } from 'zod';
import { verifyMfaOtp, enableMfa, sendMfaOtp } from '@/lib/services/mfa-service';
import { logAction } from '@/lib/services/audit-service';
import { createAuthResponse, isSecureRequest } from '@/lib/session';

const verifyMfaSchema = z.object({
  code: z.string().length(6, 'Code must be 6 digits').regex(/^\d{6}$/, 'Code must be numeric'),
  purpose: z.enum(['setup', 'login']).default('setup'),
  userId: z.preprocess((value) => {
    if (typeof value === 'string' && /^[0-9]+$/.test(value)) {
      return Number(value);
    }
    return value;
  }, z.number().int().positive().optional()), // Required for login MFA (no session yet)
});

export async function POST(request: NextRequest) {
  const result = await validateRequestBody(request, verifyMfaSchema, {
    sanitize: false, // Disable sanitization — code is a 6-digit OTP, no sanitization needed
  });
  if ('error' in result) return result.error;

  const { code, purpose, userId: bodyUserId } = result.data;

  // For login MFA, userId comes from request body (no session yet)
  // For setup MFA, userId comes from authenticated session
  let targetUserId: number;

  if (purpose === 'login' && bodyUserId) {
    // Verify pre-auth token for login MFA (prevents OTP brute-force)
    const { createHmac } = await import('crypto');
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');
    const mfaSecret = process.env.JWT_SECRET!;
    const expectedToken = createHmac('sha256', mfaSecret)
      .update(`mfa-pre-auth:${bodyUserId}`)
      .digest('hex');

    const preAuthToken = request.headers.get('x-pre-auth-token');
    if (!preAuthToken) {
      return errorResponse('Pre-authentication token required for MFA login', 'PRE_AUTH_REQUIRED', 401);
    }
    const bufA = Buffer.from(preAuthToken);
    const bufB = Buffer.from(expectedToken);
    if (bufA.length !== bufB.length || !bufA.equals(bufB)) {
      return errorResponse('Invalid pre-authentication token', 'INVALID_PRE_AUTH', 401);
    }

    targetUserId = bodyUserId;
  } else {
    const auth = await getAuthInfo(request);
    if (!auth) return Errors.unauthorized();
    targetUserId = auth.userIdNum;
  }

  try {
    // Verify the OTP code
    const verifyResult = await verifyMfaOtp(targetUserId, code);

    if (!verifyResult.valid) {
      return errorResponse(verifyResult.message, 'INVALID_MFA_CODE', 400);
    }

    if (purpose === 'setup') {
      // Enable MFA after successful verification
      const enableResult = await enableMfa(targetUserId);
      if (!enableResult.success) {
        return errorResponse(enableResult.message, 'MFA_ENABLE_FAILED', 500);
      }

      await logAction({
        entityType: 'User',
        entityId: targetUserId,
        action: 'ENABLE_MFA',
        actionCategory: 'AUTH',
        actorId: targetUserId,
        actorType: 'USER',
        metadata: { method: 'email_otp' },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      });

      return NextResponse.json({
        message: 'MFA enabled successfully',
        method: 'email_otp',
        enabled: true,
      });
    }

    if (purpose === 'login') {
      // Create full auth session after MFA verification
      const user = await db.user.findFirst({
        where: { id: targetUserId, isDeleted: 0, isActive: 1 },
        include: { role: true, customer: true },
      });

      if (!user) return Errors.notFound('User');

      // Non-blocking audit log — don't let audit failures break MFA login
      logAction({
        entityType: 'User',
        entityId: targetUserId,
        action: 'MFA_LOGIN_SUCCESS',
        actionCategory: 'AUTH',
        actorId: targetUserId,
        actorType: user.role?.roleCode || 'USER',
        metadata: { method: 'email_otp' },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      }).catch((err) => console.error('[MFA] Audit log failed:', err));

      return await createAuthResponse(
        {
          user: {
            id: user.id,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role.roleCode,
            roleId: user.roleId,
            customerId: user.customer?.id ?? undefined,
            mfaEnabled: user.mfaEnabled,
          },
        },
        {
          id: user.id,
          role: user.role.roleCode,
          email: user.email,
        },
        { secure: isSecureRequest(request) }
      );
    }

    return NextResponse.json({ message: verifyResult.message });
  } catch (error) {
    console.error('MFA verification failed:', error);
    return Errors.internal();
  }
}

