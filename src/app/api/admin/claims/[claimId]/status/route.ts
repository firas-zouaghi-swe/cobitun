
/**
 * Admin Claim State Management API
 * PATCH - Update claim status (DRAFT → SUBMITTED, SUBMITTED → UNDER_REVIEW, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { db, safeTransaction } from '@/lib/db';
import { Errors, errorResponse, validateRequestBody } from '@/middleware/validation';
import { z } from 'zod';
import { logAction } from '@/lib/services/audit-service';
import { notifyCustomer } from '@/lib/services/notification-service';

const updateClaimStatusSchema = z.object({
  status: z.enum(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'PAID', 'APPEALED']),
  notes: z.string().max(1000).optional(),
});

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['UNDER_REVIEW', 'REJECTED'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED: ['PAID'],
  REJECTED: ['APPEALED'],
  APPEALED: ['UNDER_REVIEW', 'APPROVED', 'REJECTED'],
  PAID: [],
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ claimId: string }> }
) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN') return Errors.forbidden();

  const { claimId } = await params;
  const claimIdNum = parseInt(claimId, 10);
  if (isNaN(claimIdNum)) return Errors.notFound('Claim');

  const result = await validateRequestBody(request, updateClaimStatusSchema);
  if ('error' in result) return result.error;

  try {
    const claim = await db.parametricClaim.findFirst({
      where: { id: claimIdNum, isDeleted: 0 },
      include: { status: true, customer: { include: { user: true } }, policy: true },
    });

    if (!claim) return Errors.notFound('Claim');

    const currentStatus = claim.status?.statusCode;
    if (!currentStatus || !VALID_TRANSITIONS[currentStatus]?.includes(result.data.status)) {
      return errorResponse(`Invalid transition: ${currentStatus} → ${result.data.status}`, 'INVALID_TRANSITION', 409);
    }

    // Find target status
    const targetStatus = await db.enumParamClaimStatus.findFirst({ where: { statusCode: result.data.status, isCurrent: 1 } });
    if (!targetStatus) return Errors.internal();

    const timestampFields: Record<string, unknown> = { updatedAt: new Date() };
    if (result.data.status === 'SUBMITTED') timestampFields.submittedAt = new Date();
    if (result.data.status === 'UNDER_REVIEW') timestampFields.reviewedAt = new Date();

    await safeTransaction(async (tx) => {
      await tx.parametricClaim.update({
        where: { id: claimIdNum },
        data: {
          statusId: targetStatus.id,
          ...timestampFields,
        },
      });
    });

    // Notify customer at each state change
    if (claim.customer?.user) {
      const statusMessages: Record<string, string> = {
        DRAFT: 'Your claim has been saved as draft.',
        SUBMITTED: 'Your claim has been submitted and is being processed.',
        UNDER_REVIEW: 'Your claim is now under review by our team.',
        APPROVED: 'Your claim has been approved.',
        REJECTED: `Your claim has been rejected.${result.data.notes ? ' Reason: ' + result.data.notes : ''}`,
        PAID: 'Your claim payout has been processed.',
        APPEALED: 'Your claim appeal has been received and will be reviewed.',
      };

      await notifyCustomer(
        claim.customer.user.id,
        `Claim ${claim.claimNumber}: ${statusMessages[result.data.status] ?? 'Status updated.'}`,
        'claim_update',
        { parametricClaimId: claimIdNum, parametricPolicyId: claim.policyId }
      );
    }

    await logAction({
      entityType: 'ParametricClaim',
      entityId: claimIdNum,
      action: `CLAIM_${result.data.status}`,
      actorId: auth.userIdNum,
      actorType: 'ADMIN',
      metadata: { fromStatus: currentStatus, toStatus: result.data.status, notes: result.data.notes, claimNumber: claim.claimNumber },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json({
      message: `Claim status updated to ${result.data.status}`,
      claimId: claimIdNum,
      previousStatus: currentStatus,
      newStatus: result.data.status,
    });
  } catch (error) {
    console.error('Failed to update claim status', error);
    return Errors.internal();
  }
}

