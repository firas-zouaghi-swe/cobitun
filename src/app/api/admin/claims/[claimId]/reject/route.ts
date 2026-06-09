import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole, Roles } from '@/lib/services/authorization';
import { AuthInfo } from '@/lib/services/auth-helper';
import { logAction } from '@/lib/services/audit-service';
import { notifyCustomer } from '@/lib/services/notification-service';

/**
 * PATCH /api/admin/claims/[claimId]/reject
 * Admin endpoint to reject a claim
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { claimId: string } }
) {
  try {
    const authOrResp = await requireRole(request, Roles.ADMIN);
    if ((authOrResp as any).status) return authOrResp as NextResponse;
    const auth = authOrResp as AuthInfo;

    const { claimId } = params;
    const { reason, category } = await request.json();

    // Validate input
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      );
    }

    const validCategories = [
      'FRAUD',
      'INSUFFICIENT_EVIDENCE',
      'NOT_COVERED',
      'POLICY_LIMIT_EXCEEDED',
      'EXCLUSION_APPLIED'
    ];

    if (!category || !validCategories.includes(category)) {
      return NextResponse.json(
        { error: `Invalid rejection category. Must be one of: ${validCategories.join(', ')}` },
        { status: 400 }
      );
    }

    const claimIdNum = parseInt(claimId);
    const adminIdNum = auth.userIdNum;

    // Check workflow claim first
    const workflowClaim = await db.workflowClaim.findUnique({
      where: { id: claimIdNum },
      include: {
        customer: true,
        status: true
      }
    });

    if (workflowClaim) {
      // Check if claim is in a state that can be rejected
      if (!['SUBMITTED', 'UNDER_REVIEW'].includes(workflowClaim.status?.statusCode || '')) {
        return NextResponse.json(
          {
            error: `Claim cannot be rejected. Current status: ${workflowClaim.status?.statusName}`
          },
          { status: 400 }
        );
      }

      // Create rejection record and update claim status (transactional)
      const result = await db.$transaction(async (tx) => {
        // Create rejection record
        const rejection = await tx.claimRejection.create({
          data: {
            workflowClaimId: workflowClaim.id,
            customerId: workflowClaim.customerId,
            rejectionReason: reason,
            rejectionCategory: category,
            rejectedBy: adminIdNum,
            rejectedAt: new Date(),
            appealDeadlineDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
          }
        });

        // Update claim status to REJECTED
        const rejectedStatus = await tx.enumWorkflowClaimStatus.findFirst({
          where: { statusCode: 'REJECTED' }
        });

        let updatedClaim = workflowClaim;
        if (rejectedStatus) {
          updatedClaim = await tx.workflowClaim.update({
            where: { id: workflowClaim.id },
            data: {
              statusId: rejectedStatus.id,
              updatedAt: new Date()
            },
            include: { status: true, customer: true }
          });
        }

        return { rejection, claim: updatedClaim };
      });

      // Notify customer about rejection
      await notifyCustomer(
        workflowClaim.customer?.userId ?? 0,
        `Your claim has been rejected. Category: ${category}. You have 30 days to appeal.`,
        'CLAIM_REJECTED',
        { parametricClaimId: workflowClaim.id }
      );

      // Audit log
      await logAction({
        entityType: 'WorkflowClaim',
        entityId: workflowClaim.id,
        actorId: adminIdNum,
        action: 'CLAIM_REJECTED',
        actionCategory: 'CLAIMS_MANAGEMENT',
        oldValues: { status: workflowClaim.status?.statusCode },
        newValues: { status: 'REJECTED', rejectionCategory: category, rejectionReason: reason },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
        requestPath: `/api/admin/claims/${claimId}/reject`,
      });

      return NextResponse.json({
        message: 'Claim rejected successfully',
        rejection: {
          id: result.rejection.id,
          claimId: workflowClaim.id,
          rejectionCategory: result.rejection.rejectionCategory,
          rejectionReason: result.rejection.rejectionReason,
          appealDeadlineDate: result.rejection.appealDeadlineDate,
          status: result.claim.status?.statusName,
        },
      });
    }

    // Check parametric claim
    const paramClaim = await db.parametricClaim.findUnique({
      where: { id: claimIdNum },
      include: { customer: true, status: true },
    });

    if (!paramClaim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    if (!['SUBMITTED', 'UNDER_REVIEW'].includes(paramClaim.status?.statusCode || '')) {
      return NextResponse.json(
        { error: `Claim cannot be rejected. Current status: ${paramClaim.status?.statusName}` },
        { status: 400 }
      );
    }

    const result = await db.$transaction(async (tx) => {
      const rejection = await tx.claimRejection.create({
        data: {
          paramClaimId: paramClaim.id,
          customerId: paramClaim.customerId,
          rejectionReason: reason,
          rejectionCategory: category,
          rejectedBy: adminIdNum,
          rejectedAt: new Date(),
          appealDeadlineDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      const rejectedStatus = await tx.enumParamClaimStatus.findFirst({
        where: { statusCode: 'REJECTED' },
      });

      let updatedClaim = paramClaim;
      if (rejectedStatus) {
        updatedClaim = await tx.parametricClaim.update({
          where: { id: paramClaim.id },
          data: { statusId: rejectedStatus.id, updatedAt: new Date() },
          include: { status: true, customer: true },
        });
      }

      return { rejection, claim: updatedClaim };
    });

    // Notify customer about rejection
    await notifyCustomer(
      paramClaim.customer?.userId ?? 0,
      `Your claim has been rejected. Category: ${category}. You have 30 days to appeal.`,
      'CLAIM_REJECTED',
      { parametricClaimId: paramClaim.id }
    );

    // Audit log
    await logAction({
      entityType: 'ParametricClaim',
      entityId: paramClaim.id,
      actorId: adminIdNum,
      action: 'CLAIM_REJECTED',
      actionCategory: 'CLAIMS_MANAGEMENT',
      oldValues: { status: paramClaim.status?.statusCode },
      newValues: { status: 'REJECTED', rejectionCategory: category, rejectionReason: reason },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      requestPath: `/api/admin/claims/${claimId}/reject`,
    });

    return NextResponse.json(
      {
        message: 'Claim rejected successfully',
        rejection: {
          id: result.rejection.id,
          claimId: paramClaim.id,
          rejectionCategory: result.rejection.rejectionCategory,
          rejectionReason: result.rejection.rejectionReason,
          appealDeadlineDate: result.rejection.appealDeadlineDate,
          status: result.claim.status?.statusName
        }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Claim rejection error:', error);
    return NextResponse.json(
      { error: 'An error occurred while rejecting the claim' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/claims/[claimId]/rejection
 * Get rejection details for a claim
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { claimId: string } }
) {
  try {
    const authOrResp = await requireRole(request, Roles.ADMIN);
    if ((authOrResp as any).status) return authOrResp as NextResponse;

    const { claimId } = params;
    const claimIdNum = parseInt(claimId);

    // Check workflow claim first
    const workflowClaim = await db.workflowClaim.findUnique({
      where: { id: claimIdNum },
      include: {
        rejections: {
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        status: true
      }
    });

    if (workflowClaim) {
      return NextResponse.json({
        claim: {
          id: workflowClaim.id,
          claimNumber: workflowClaim.claimNumber,
          status: workflowClaim.status?.statusName
        },
        rejection: workflowClaim.rejections[0] || null
      });
    }

    // Check parametric claim
    const paramClaim = await db.parametricClaim.findUnique({
      where: { id: claimIdNum },
      include: {
        rejections: {
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        status: true
      }
    });

    if (!paramClaim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    return NextResponse.json({
      claim: {
        id: paramClaim.id,
        claimNumber: paramClaim.claimNumber,
        status: paramClaim.status?.statusName
      },
      rejection: paramClaim.rejections[0] || null
    });
  } catch (error) {
    console.error('Get rejection error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching rejection details' },
      { status: 500 }
    );
  }
}

