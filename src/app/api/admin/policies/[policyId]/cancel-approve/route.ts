/**
 * Admin Policy Cancellation Approval Endpoint
 * PATCH /api/admin/policies/[policyId]/cancel-approve
 * 
 * Approve or deny a pending policy cancellation and process refund.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole, Roles } from '@/lib/services/authorization';
import { AuthInfo } from '@/lib/services/auth-helper';
import { logAction } from '@/lib/services/audit-service';
import { notifyCustomer } from '@/lib/services/notification-service';
import { z } from 'zod';

const cancelApprovalSchema = z.object({
  decision: z.enum(['APPROVED', 'DENIED']),
  approvedRefundAmount: z.number().min(0).optional(),
  refundReference: z.string().optional(),
  adminNotes: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ policyId: string }> }
) {
  try {
    const authOrResp = await requireRole(request, Roles.ADMIN);
    if (authOrResp instanceof NextResponse) return authOrResp;
    const auth = authOrResp;

    const { policyId } = await params;
    const body = await request.json();
    const parsed = cancelApprovalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid approval data' },
        { status: 400 }
      );
    }

    const { decision, approvedRefundAmount, refundReference, adminNotes } = parsed.data;
    const policyIdNum = parseInt(policyId, 10);
    if (isNaN(policyIdNum)) {
      return NextResponse.json({ error: 'Invalid policy ID' }, { status: 400 });
    }

    // Find the pending cancellation
    const cancellation = await db.policyCancellation.findFirst({
      where: {
        parametricPolicyId: policyIdNum,
        refundStatus: 'PENDING',
        isDeleted: 0,
      },
    });

    if (!cancellation) {
      return NextResponse.json(
        { error: 'No pending cancellation found for this policy' },
        { status: 404 }
      );
    }

    if (decision === 'APPROVED') {
      const finalRefundAmount = approvedRefundAmount ?? cancellation.refundAmount;

      // Look up CANCELLED status before transaction
      const cancelledStatus = await db.enumParamPolicyStatus.findFirst({
        where: { statusCode: 'CANCELLED', isCurrent: 1 },
      });

      // Update cancellation with approval and policy status atomically
      const updatedCancellation = await db.$transaction(async (tx) => {
        const updated = await tx.policyCancellation.update({
          where: { id: cancellation.id },
          data: {
            refundStatus: 'APPROVED',
            refundAmount: finalRefundAmount,
            refundProcessedBy: auth.userIdNum,
            refundProcessedAt: new Date(),
            remarks: adminNotes ?? null,
          },
        });

        if (cancelledStatus) {
          await tx.parametricPolicy.update({
            where: { id: policyIdNum },
            data: { statusId: cancelledStatus.id, updatedAt: new Date() },
          });
        }

        return updated;
      });

      // Audit log
      await logAction({
        entityType: 'PolicyCancellation',
        entityId: cancellation.id,
        actorId: auth.userIdNum,
        action: 'CANCELLATION_APPROVED',
        actionCategory: 'POLICY_MANAGEMENT',
        oldValues: { refundStatus: 'PENDING' },
        newValues: { refundStatus: 'APPROVED', refundAmount: finalRefundAmount },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
        requestPath: `/api/admin/policies/${policyId}/cancel-approve`,
      });

      // Notify customer
      await notifyCustomer(
        cancellation.customerId,
        `Your policy cancellation has been approved. Refund of ${finalRefundAmount.toFixed(3)} TND will be processed. Reference: ${refundReference || 'N/A'}`,
        'CANCELLATION_APPROVED',
        { parametricPolicyId: policyIdNum }
      );

      return NextResponse.json({
        message: 'Cancellation approved successfully',
        cancellation: {
          id: updatedCancellation.id,
          refundStatus: updatedCancellation.refundStatus,
          refundAmount: updatedCancellation.refundAmount,
          refundProcessedBy: updatedCancellation.refundProcessedBy,
          refundProcessedAt: updatedCancellation.refundProcessedAt,
        },
      });
    } else {
      // Deny cancellation - revert policy to ACTIVE

      // Look up ACTIVE status before transaction
      const activeStatus = await db.enumParamPolicyStatus.findFirst({
        where: { statusCode: 'ACTIVE', isCurrent: 1 },
      });

      const updatedCancellation = await db.$transaction(async (tx) => {
        const updated = await tx.policyCancellation.update({
          where: { id: cancellation.id },
          data: {
            refundStatus: 'DENIED',
            refundProcessedBy: auth.userIdNum,
            refundProcessedAt: new Date(),
            remarks: adminNotes ?? null,
          },
        });

        // Revert policy status to ACTIVE
        if (activeStatus) {
          await tx.parametricPolicy.update({
            where: { id: policyIdNum },
            data: { statusId: activeStatus.id, updatedAt: new Date() },
          });
        }

        return updated;
      });

      // Audit log
      await logAction({
        entityType: 'PolicyCancellation',
        entityId: cancellation.id,
        actorId: auth.userIdNum,
        action: 'CANCELLATION_DENIED',
        actionCategory: 'POLICY_MANAGEMENT',
        oldValues: { refundStatus: 'PENDING' },
        newValues: { refundStatus: 'DENIED', adminNotes },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
        requestPath: `/api/admin/policies/${policyId}/cancel-approve`,
      });

      // Notify customer
      await notifyCustomer(
        cancellation.customerId,
        `Your policy cancellation request has been denied. ${adminNotes ? `Reason: ${adminNotes}` : 'Please contact support for more information.'}`,
        'CANCELLATION_DENIED',
        { parametricPolicyId: policyIdNum }
      );

      return NextResponse.json({
        message: 'Cancellation denied',
        cancellation: {
          id: updatedCancellation.id,
          refundStatus: updatedCancellation.refundStatus,
          remarks: updatedCancellation.remarks,
        },
      });
    }
  } catch (error) {
    console.error('Cancellation approval error:', error);
    return NextResponse.json(
      { error: 'An error occurred while processing the cancellation approval' },
      { status: 500 }
    );
  }
}

