
/**
 * MFA Setup API
 * POST   - Enable MFA / Send initial verification code
 * DELETE - Disable MFA
 * GET    - Get MFA status
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { db } from '@/lib/db';
import { Errors, errorResponse } from '@/middleware/validation';
import { enableMfa, disableMfa, getMfaStatus, sendMfaOtp } from '@/lib/services/mfa-service';
import { logAction } from '@/lib/services/audit-service';

export async function GET(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();

  try {
    const status = await getMfaStatus(auth.userIdNum);
    return NextResponse.json(status);
  } catch (error) {
    return Errors.internal();
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();

  try {
    // Get user email
    const user = await db.user.findFirst({
      where: { id: auth.userIdNum, isDeleted: 0 },
      select: { email: true, mfaEnabled: true },
    });

    if (!user) return Errors.notFound('User');

    // Send OTP to verify MFA setup
    const result = await sendMfaOtp(auth.userIdNum, user.email);

    if (!result.success) {
      return errorResponse(result.message, 'MFA_SEND_FAILED', 400);
    }

    return NextResponse.json({
      message: result.message,
      expiresAt: result.expiresAt?.toISOString(),
      step: 'verify',
    });
  } catch (error) {
    return Errors.internal();
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();

  try {
    const result = await disableMfa(auth.userIdNum);

    if (!result.success) {
      return errorResponse(result.message, 'MFA_DISABLE_FAILED', 400);
    }

    await logAction({
      entityType: 'User',
      entityId: auth.userIdNum,
      action: 'DISABLE_MFA',
      actionCategory: 'AUTH',
      actorId: auth.userIdNum,
      actorType: auth.role,
      metadata: {},
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json({ message: result.message });
  } catch (error) {
    return Errors.internal();
  }
}

