
/**
 * Claim States API
 * PATCH - Update claim status with state tracking
 * Supports: DRAFT, UNDER_REVIEW, SUBMITTED, APPROVED, REJECTED, PAID, APPEALED
 * Includes customer notifications at each state change and timestamp tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { db } from '@/lib/db';
import { Errors, errorResponse, validateRequestBody } from '@/middleware/validation';
import { z } from 'zod';
import { logAction } from '@/lib/services/audit-service';
import { notifyCustomerObject } from '@/lib/services/notification-service';

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['UNDER_REVIEW', 'CANCELLED'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED', 'SUBMITTED'],
  REJECTED: ['APPEALED'],
  APPEALED: ['UNDER_REVIEW'],
  APPROVED: ['PAID'],
  PAID: [],
  CANCELLED: [],
};

const updateClaimStatusSchema = z.object({
  claimId: z.number().int().positive(),
  newStatus: z.enum(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'PAID', 'APPEALED', 'CANCELLED']),
  reason: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});

const NOTIFICATION_CONFIG: Record<string, { type: 'claim_update' | 'action_required' | 'payment_update' | 'warning'; title: string; message: string }> = {
  DRAFT: { type: 'claim_update', title: 'Claim Draft Created', message: 'A draft claim has been created for your review. Please review and submit when ready.' },
  SUBMITTED: { type: 'claim_update', title: 'Claim Submitted', message: 'Your claim has been submitted and is awaiting review.' },
  UNDER_REVIEW: { type: 'claim_update', title: 'Claim Under Review', message: 'Your claim is now being reviewed by our team.' },
  APPROVED: { type: 'claim_update', title: 'Claim Approved', message: 'Your claim has been approved. Payment will be processed shortly.' },
  REJECTED: { type: 'warning', title: 'Claim Rejected', message: 'Your claim has been rejected. You may appeal within 30 days.' },
  PAID: { type: 'payment_update', title: 'Claim Paid', message: 'Your claim has been paid. The amount has been transferred to your account.' },
  APPEALED: { type: 'action_required', title: 'Claim Appeal Submitted', message: 'Your appeal has been submitted and will be reviewed.' },
  CANCELLED: { type: 'claim_update', title: 'Claim Cancelled', message: 'Your claim has been cancelled.' },
};

export async function PATCH(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  const result = await validateRequestBody(request, updateClaimStatusSchema);
  if ('error' in result) return result.error;

  try {
    const { claimId, newStatus, reason, notes } = result.data;

    const claim = await db.parametricClaim.findFirst({
      where: { id: claimId, isDeleted: 0 },
      include: { status: true, customer: { include: { user: true } } },
    });

    if (!claim) return Errors.notFound('Claim');

    const currentStatus = claim.status?.statusCode;
    if (!currentStatus) {
      return errorResponse('Claim has no current status', 'INVALID_STATE', 400);
    }

    // Validate transition
    const allowedTransitions = VALID_TRANSITIONS[currentStatus];
    if (!allowedTransitions || !allowedTransitions.includes(newStatus)) {
      return errorResponse(
        `Invalid status transition: ${currentStatus} → ${newStatus}. Allowed: ${allowedTransitions?.join(', ') || 'none'}`,
        'INVALID_TRANSITION',
        400
      );
    }

    // Find the new status record
    const newStatusRecord = await db.enumParamClaimStatus.findFirst({
      where: { statusCode: newStatus, isCurrent: 1 },
    });

    if (!newStatusRecord) {
      return errorResponse(`Status code ${newStatus} not found in system`, 'CONFIG_ERROR', 500);
    }

    // Build timestamp tracking data
    const timestampData: Record<string, Date> = {};
    const now = new Date();
    if (newStatus === 'SUBMITTED') timestampData.submittedAt = now;
    if (newStatus === 'UNDER_REVIEW') timestampData.reviewedAt = now;
    if (newStatus === 'REJECTED') timestampData.rejectedAt = now;
    if (newStatus === 'APPEALED') timestampData.appealedAt = now;
    if (newStatus === 'PAID') timestampData.paidAt = now;

    // Update claim
    const updateData: Record<string, unknown> = {
      statusId: newStatusRecord.id,
      updatedAt: now,
      ...timestampData,
    };

    if (reason) updateData.cancellationReason = reason;
    if (notes) updateData.internalNotes = notes;

    await db.parametricClaim.updateMany({
      where: { id: claimId, version: claim.version },
      data: updateData,
    });

    // Send customer notification
    const notifConfig = NOTIFICATION_CONFIG[newStatus];
    if (notifConfig && claim.customerId) {
      await notifyCustomerObject({
        customerId: claim.customerId,
        type: notifConfig.type,
        title: notifConfig.title,
        message: `${notifConfig.message} Claim ID: ${claimId}.${reason ? ` Reason: ${reason}` : ''}`,
        metadata: { claimId, oldStatus: currentStatus, newStatus, reason },
      });
    }

    await logAction({
      entityType: 'ParametricClaim',
      entityId: claimId,
      action: `CLAIM_STATUS_${newStatus}`,
      actorId: auth.userIdNum,
      actorType: auth.role,
      metadata: { claimId, oldStatus: currentStatus, newStatus, reason, timestamps: timestampData },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json({
      claimId,
      previousStatus: currentStatus,
      newStatus,
      timestamps: Object.fromEntries(Object.entries(timestampData).map(([k, v]) => [k, v.toISOString()])),
      notificationSent: !!notifConfig,
    });
  } catch (error) {
    console.error('Failed to update claim status:', error);
    return Errors.internal();
  }
}


