
/**
 * Admin Policy Suspension API
 * POST   - Suspend a policy (payment failure, admin decision)
 * PATCH  - Reinstate a suspended policy
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { db } from '@/lib/db';
import { Errors, errorResponse, validateRequestBody } from '@/middleware/validation';
import { z } from 'zod';
import { logAction } from '@/lib/services/audit-service';
import { notifyCustomer } from '@/lib/services/notification-service';

const suspendSchema = z.object({
  reason: z.enum(['NON_PAYMENT', 'FRAUD_SUSPECTED', 'ADMIN_DECISION', 'DOCUMENTATION_REQUIRED']),
  notes: z.string().max(1000).optional(),
});

const reinstateSchema = z.object({
  notes: z.string().max(1000).optional(),
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

  const result = await validateRequestBody(request, suspendSchema);
  if ('error' in result) return result.error;

  try {
    const policy = await db.parametricPolicy.findFirst({
      where: { id: policyIdNum, isDeleted: 0 },
      include: { status: true, customer: { include: { user: true } } },
    });

    if (!policy) return Errors.notFound('Policy');
    if (policy.status?.statusCode !== 'ACTIVE') {
      return errorResponse('Only ACTIVE policies can be suspended', 'INVALID_STATUS', 409);
    }

    // Find SUSPENDED status enum
    const suspendedStatus = await db.enumParamPolicyStatus.findFirst({
      where: { statusCode: 'SUSPENDED' },
    });
    if (!suspendedStatus) return Errors.internal();

    // Update policy with optimistic locking
    const updated = await db.parametricPolicy.updateMany({
      where: { id: policyIdNum, version: policy.version },
      data: {
        statusId: suspendedStatus.id,
        cancellationReason: `SUSPENDED: ${result.data.reason}${result.data.notes ? ' - ' + result.data.notes : ''}`,
        updatedAt: new Date(),
        updatedBy: auth.userIdNum,
        version: { increment: 1 },
      },
    });

    if (updated.count === 0) {
      return errorResponse('Policy was modified by another operation. Please retry.', 'CONCURRENT_MODIFICATION', 409);
    }

    // Create notification for customer
    if (policy.customer?.user) {
      await notifyCustomer(
        policy.customer.user.id,
        `Your policy ${policy.policyNumber} has been suspended. Reason: ${result.data.reason}. Please contact support.`,
        'policy_update',
        { parametricPolicyId: policyIdNum }
      );
    }

    // Audit log
    await logAction({
      entityType: 'ParametricPolicy',
      entityId: policyIdNum,
      action: 'SUSPEND',
      actorId: auth.userIdNum,
      actorType: 'ADMIN',
      metadata: { reason: result.data.reason, notes: result.data.notes, policyNumber: policy.policyNumber },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    });

    return NextResponse.json({
      message: 'Policy suspended successfully',
      policyId: policyIdNum,
      policyNumber: policy.policyNumber,
      status: 'SUSPENDED',
      reason: result.data.reason,
    });
  } catch (error) {
    console.error('Failed to suspend policy', error);
    return Errors.internal();
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ policyId: string }> }
) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN') return Errors.forbidden();

  const { policyId } = await params;
  const policyIdNum = parseInt(policyId, 10);
  if (isNaN(policyIdNum)) return Errors.notFound('Policy');

  const result = await validateRequestBody(request, reinstateSchema);
  if ('error' in result) return result.error;

  try {
    const policy = await db.parametricPolicy.findFirst({
      where: { id: policyIdNum, isDeleted: 0 },
      include: { status: true, customer: { include: { user: true } } },
    });

    if (!policy) return Errors.notFound('Policy');
    if (policy.status?.statusCode !== 'SUSPENDED') {
      return errorResponse('Only SUSPENDED policies can be reinstated', 'INVALID_STATUS', 409);
    }

    // Find ACTIVE status enum
    const activeStatus = await db.enumParamPolicyStatus.findFirst({
      where: { statusCode: 'ACTIVE' },
    });
    if (!activeStatus) return Errors.internal();

    // Update policy with optimistic locking
    const updated = await db.parametricPolicy.updateMany({
      where: { id: policyIdNum, version: policy.version },
      data: {
        statusId: activeStatus.id,
        cancellationReason: null,
        updatedAt: new Date(),
        updatedBy: auth.userIdNum,
        version: { increment: 1 },
      },
    });

    if (updated.count === 0) {
      return errorResponse('Policy was modified by another operation. Please retry.', 'CONCURRENT_MODIFICATION', 409);
    }

    // Create notification for customer
    if (policy.customer?.user) {
      await notifyCustomer(
        policy.customer.user.id,
        `Your policy ${policy.policyNumber} has been reinstated and is now active.`,
        'policy_update',
        { parametricPolicyId: policyIdNum }
      );
    }

    // Audit log
    await logAction({
      entityType: 'ParametricPolicy',
      entityId: policyIdNum,
      action: 'REINSTATE',
      actorId: auth.userIdNum,
      actorType: 'ADMIN',
      metadata: { notes: result.data.notes, policyNumber: policy.policyNumber },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    });

    return NextResponse.json({
      message: 'Policy reinstated successfully',
      policyId: policyIdNum,
      policyNumber: policy.policyNumber,
      status: 'ACTIVE',
    });
  } catch (error) {
    console.error('Failed to reinstate policy', error);
    return Errors.internal();
  }
}

