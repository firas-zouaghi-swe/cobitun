/**
 * Admin Appeal Review Endpoint
 * PATCH /api/admin/claims/[claimId]/appeal-review
 * 
 * Allows admins to approve or deny a claim appeal.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole, Roles } from '@/lib/services/authorization';
import { AuthInfo } from '@/lib/services/auth-helper';
import { logAction } from '@/lib/services/audit-service';
import { notifyCustomer } from '@/lib/services/notification-service';
import { z } from 'zod';

const appealReviewSchema = z.object({
  decision: z.enum(['APPROVED', 'DENIED']),
  reviewNotes: z.string().min(5, 'Review notes must be at least 5 characters'),
  revisedPayoutAmount: z.number().positive().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ claimId: string }> }
) {
  try {
    const authOrResp = await requireRole(request, Roles.ADMIN);
    if ((authOrResp as any).status) return authOrResp as NextResponse;
    const auth = authOrResp as AuthInfo;

    const { claimId } = await params;
    const body = await request.json();
    const parsed = appealReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid review data' },
        { status: 400 }
      );
    }

    const { decision, reviewNotes, revisedPayoutAmount } = parsed.data;
    const claimIdNum = parseInt(claimId, 10);
    if (isNaN(claimIdNum)) {
      return NextResponse.json({ error: 'Invalid claim ID' }, { status: 400 });
    }

    // Update the appeal and claim status atomically
    const updatedAppeal = await db.$transaction(async (tx) => {
      const appeal = await tx.claimAppeal.findFirst({
        where: {
          OR: [
            { workflowClaimId: claimIdNum },
            { paramClaimId: claimIdNum },
          ],
          appealStatus: 'SUBMITTED',
          isDeleted: 0,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!appeal) return null;

      const updated = await tx.claimAppeal.update({
        where: { id: appeal.id },
        data: {
          appealStatus: decision,
          reviewedBy: auth.userIdNum,
          reviewedAt: new Date(),
          reviewNotes,
          appealDecisionAmount: revisedPayoutAmount ?? null,
        },
      });

      const isWorkflowClaim = !!appeal.workflowClaimId;
      const statusModel = isWorkflowClaim ? 'enumWorkflowClaimStatus' : 'enumParamClaimStatus';
      const claimModel = isWorkflowClaim ? 'workflowClaim' : 'parametricClaim';
      const claimIdField = isWorkflowClaim ? appeal.workflowClaimId : appeal.paramClaimId;

      if (decision === 'APPROVED') {
        const approvedStatus = await (tx as any)[statusModel].findFirst({
          where: { statusCode: 'APPROVED', isCurrent: 1 },
        });
        if (approvedStatus && claimIdField) {
          await (tx as any)[claimModel].update({
            where: { id: claimIdField },
            data: { statusId: approvedStatus.id, updatedAt: new Date() },
          });
        }
      } else {
        const rejectedStatus = await (tx as any)[statusModel].findFirst({
          where: { statusCode: 'REJECTED', isCurrent: 1 },
        });
        if (rejectedStatus && claimIdField) {
          await (tx as any)[claimModel].update({
            where: { id: claimIdField },
            data: { statusId: rejectedStatus.id, updatedAt: new Date() },
          });
        }
      }

      return updated;
    });

    if (!updatedAppeal) {
      return NextResponse.json(
        { error: 'No pending appeal found for this claim' },
        { status: 404 }
      );
    }

    const isWorkflowClaim = !!((await db.claimAppeal.findFirst({ where: { id: updatedAppeal.id } }))?.workflowClaimId);
    const entityType = isWorkflowClaim ? 'WorkflowClaim' : 'ParametricClaim';

    // Audit log
    await logAction({
      entityType,
      entityId: claimIdNum,
      actorId: auth.userIdNum,
      action: decision === 'APPROVED' ? 'CLAIM_APPEAL_APPROVED' : 'CLAIM_APPEAL_DENIED',
      actionCategory: 'CLAIMS_MANAGEMENT',
      oldValues: { appealStatus: 'SUBMITTED' },
      newValues: { appealStatus: decision, reviewNotes, revisedPayoutAmount },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      requestPath: `/api/admin/claims/${claimId}/appeal-review`,
    });

    // Notify customer
    const message = decision === 'APPROVED'
      ? 'Your appeal has been approved. Your claim will be re-processed.'
      : 'Your appeal has been denied. The original rejection stands.';
    await notifyCustomer(
      updatedAppeal.customerId,
      message,
      decision === 'APPROVED' ? 'CLAIM_APPEAL_APPROVED' : 'CLAIM_APPEAL_DENIED',
      { parametricClaimId: claimIdNum }
    );

    return NextResponse.json({
      message: `Appeal ${decision.toLowerCase()} successfully`,
      appeal: {
        id: updatedAppeal.id,
        appealStatus: updatedAppeal.appealStatus,
        reviewedBy: updatedAppeal.reviewedBy,
        reviewedAt: updatedAppeal.reviewedAt,
        reviewNotes: updatedAppeal.reviewNotes,
        revisedPayoutAmount: updatedAppeal.appealDecisionAmount,
      },
    });
  } catch (error) {
    console.error('Appeal review error:', error);
    return NextResponse.json(
      { error: 'An error occurred while reviewing the appeal' },
      { status: 500 }
    );
  }
}

