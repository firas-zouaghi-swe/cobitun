
/**
 * Refunds API
 * GET  - List refunds / Get refund status
 * POST - Create a prorated refund
 * PATCH - Update refund status
 *
 * Uses PolicyCancellation model for refund tracking.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { db } from '@/lib/db';
import { Errors, errorResponse, validateRequestBody } from '@/middleware/validation';
import { z } from 'zod';
import { logAction } from '@/lib/services/audit-service';
import { notifyCustomer } from '@/lib/services/notification-service';

const createRefundSchema = z.object({
  policyId: z.number().int().positive(),
  amount: z.number().positive().optional(),
  reason: z.enum(['CANCELLATION', 'OVERPAYMENT', 'ADMIN_ADJUSTMENT', 'PARTIAL_CLAIM']),
  notes: z.string().max(1000).optional(),
});

const updateRefundSchema = z.object({
  status: z.enum(['PROCESSED', 'FAILED']),
  notes: z.string().max(1000).optional(),
});

function calculateProratedRefund(
  finalPremium: number,
  effectiveDate: Date,
  expiryDate: Date,
  cancellationDate: Date
): number {
  const totalDays = Math.max(1, Math.ceil((expiryDate.getTime() - effectiveDate.getTime()) / (1000 * 60 * 60 * 24)));
  const remainingDays = Math.max(0, Math.ceil((expiryDate.getTime() - cancellationDate.getTime()) / (1000 * 60 * 60 * 24)));
  const unusedRatio = remainingDays / totalDays;
  // Apply 10% cancellation fee
  const refundAmount = finalPremium * unusedRatio * 0.9;
  return Math.round(refundAmount * 100) / 100;
}

export async function GET(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  try {
    const url = new URL(request.url);
    const policyId = parseInt(url.searchParams.get('policyId') || '0', 10);
    const refundStatus = url.searchParams.get('status');
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));

    const where: Record<string, unknown> = { isDeleted: 0 };
    if (policyId) where.parametricPolicyId = policyId;
    if (refundStatus) where.refundStatus = refundStatus;

    const [refunds, total] = await Promise.all([
      db.policyCancellation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.policyCancellation.count({ where }),
    ]);

    return NextResponse.json({
      refunds: refunds.map((r) => ({
        id: r.id,
        policyId: r.parametricPolicyId,
        amount: Number(r.refundAmount),
        status: r.refundStatus,
        reason: r.cancellationReason,
        createdAt: r.createdAt.toISOString(),
        processedAt: r.refundProcessedAt?.toISOString() ?? null,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Failed to list refunds', error);
    return Errors.internal();
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  const result = await validateRequestBody(request, createRefundSchema);
  if ('error' in result) return result.error;

  try {
    const { policyId, amount, reason, notes } = result.data;

    const policy = await db.parametricPolicy.findFirst({
      where: { id: policyId, isDeleted: 0 },
      include: { customer: { include: { user: true } } },
    });

    if (!policy) return Errors.notFound('Policy');

    // Calculate prorated refund if amount not specified
    const refundAmount = amount ?? calculateProratedRefund(
      Number(policy.finalPremium),
      new Date(policy.effectiveDate!),
      new Date(policy.expiryDate!),
      new Date()
    );

    if (refundAmount <= 0) {
      return errorResponse('Refund amount is zero or negative', 'INVALID_REFUND', 400);
    }

    const refund = await db.policyCancellation.create({
      data: {
        parametricPolicyId: policyId,
        customerId: policy.customerId,
        cancellationReason: reason,
        cancellationCategory: 'ADMIN_CANCELLATION',
        refundAmount,
        refundStatus: 'PENDING',
        effectiveDate: new Date(),
        cancellationInitiatedBy: auth.userIdNum,
        remarks: notes || undefined,
      },
    });

    // Notify customer
    if (policy.customer?.user) {
      await notifyCustomer(
        policy.customer.user.id,
        `A refund of ${refundAmount} TND has been initiated for policy ${policy.policyNumber}. Reason: ${reason}.`,
        'payment_update',
        { parametricPolicyId: policyId }
      );
    }

    await logAction({
      entityType: 'PolicyCancellation',
      entityId: refund.id,
      action: 'CREATE_REFUND',
      actorId: auth.userIdNum,
      actorType: 'ADMIN',
      metadata: { policyId, amount: refundAmount, reason, notes },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json({
      message: 'Refund created',
      refundId: refund.id,
      policyId,
      amount: refundAmount,
      status: 'PENDING',
      reason,
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create refund', error);
    return Errors.internal();
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  const result = await validateRequestBody(request, updateRefundSchema);
  if ('error' in result) return result.error;

  try {
    const url = new URL(request.url);
    const refundId = parseInt(url.searchParams.get('refundId') || '0', 10);
    if (!refundId) return errorResponse('refundId query parameter required', 'VALIDATION_ERROR', 400);

    const refund = await db.policyCancellation.findFirst({
      where: { id: refundId },
    });

    if (!refund) return Errors.notFound('Refund');
    if (refund.refundStatus !== 'PENDING') {
      return errorResponse('Only PENDING refunds can be updated', 'INVALID_STATUS', 409);
    }

    await db.policyCancellation.update({
      where: { id: refundId },
      data: {
        refundStatus: result.data.status,
        refundProcessedAt: new Date(),
        updatedAt: new Date(),
        remarks: result.data.notes
          ? `${refund.remarks || ''} [${result.data.status}: ${result.data.notes}]`
          : `${refund.remarks || ''} [${result.data.status}]`,
      },
    });

    await logAction({
      entityType: 'PolicyCancellation',
      entityId: refundId,
      action: `REFUND_${result.data.status}`,
      actorId: auth.userIdNum,
      actorType: 'ADMIN',
      metadata: { status: result.data.status, notes: result.data.notes },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json({
      message: `Refund ${result.data.status.toLowerCase()}`,
      refundId,
      status: result.data.status,
    });
  } catch (error) {
    console.error('Failed to update refund', error);
    return Errors.internal();
  }
}

