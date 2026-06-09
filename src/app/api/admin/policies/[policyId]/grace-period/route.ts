
/**
 * Admin Grace Period Management API
 * POST   - Place policy in grace period
 * PATCH  - Auto-cancel expired grace period policies
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { db } from '@/lib/db';
import { Errors, errorResponse, validateRequestBody } from '@/middleware/validation';
import { z } from 'zod';
import { logAction } from '@/lib/services/audit-service';
import { notifyCustomer } from '@/lib/services/notification-service';

const gracePeriodSchema = z.object({
  days: z.number().int().min(1).max(90).default(30),
  reason: z.string().max(500).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ policyId: string }> }
) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN') return Errors.forbidden();

  const { policyId } = await params;
  const policyIdNum = parseInt(policyId, 10);
  if (isNaN(policyIdNum)) return Errors.notFound('Policy');

  const result = await validateRequestBody(request, gracePeriodSchema);
  if ('error' in result) return result.error;

  try {
    const policy = await db.parametricPolicy.findFirst({
      where: { id: policyIdNum, isDeleted: 0 },
      include: { status: true, customer: { include: { user: true } } },
    });

    if (!policy) return Errors.notFound('Policy');
    if (!['ACTIVE', 'EXPIRED'].includes(policy.status?.statusCode ?? '')) {
      return errorResponse('Only ACTIVE or EXPIRED policies can enter grace period', 'INVALID_STATUS', 409);
    }

    // Find GRACE_PERIOD status
    const graceStatus = await db.enumParamPolicyStatus.findFirst({ where: { statusCode: 'GRACE_PERIOD' } });
    if (!graceStatus) return Errors.internal();

    const gracePeriodEnd = new Date(Date.now() + result.data.days * 24 * 60 * 60 * 1000);

    await db.parametricPolicy.updateMany({
      where: { id: policyIdNum, version: policy.version },
      data: {
        statusId: graceStatus.id,
        expiryDate: gracePeriodEnd,
        updatedAt: new Date(),
        updatedBy: auth.userIdNum,
        version: { increment: 1 },
      },
    });

    // Notify customer
    if (policy.customer?.user) {
      await notifyCustomer(
        policy.customer.user.id,
        `Your policy ${policy.policyNumber} has entered a ${result.data.days}-day grace period. Please renew before ${gracePeriodEnd.toLocaleDateString()}.`,
        'policy_update',
        { parametricPolicyId: policyIdNum }
      );
    }

    await logAction({
      entityType: 'ParametricPolicy',
      entityId: policyIdNum,
      action: 'GRACE_PERIOD',
      actorId: auth.userIdNum,
      actorType: 'ADMIN',
      metadata: { days: result.data.days, reason: result.data.reason, gracePeriodEnd: gracePeriodEnd.toISOString() },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json({
      message: 'Policy placed in grace period',
      policyId: policyIdNum,
      gracePeriodEnd: gracePeriodEnd.toISOString(),
    });
  } catch (error) {
    console.error('Failed to set grace period', error);
    return Errors.internal();
  }
}

