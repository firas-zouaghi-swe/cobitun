import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthInfo, resolveCustomerId } from '@/lib/services/auth-helper';
import { logAction } from '@/lib/services/audit-service';
import { notifyCustomer, notifyAdmins } from '@/lib/services/notification-service';

/**
 * POST /api/customer/claims/[claimId]/appeal
 * Creates an appeal for a rejected claim (within 30 days of rejection)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ claimId: string }> }
) {
  try {
    const auth = await getAuthInfo(request);
    if (!auth) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { claimId } = await params;
    const { appealReason, supportingDocumentUrl } = await request.json();

    if (!appealReason || typeof appealReason !== 'string' || appealReason.trim().length === 0) {
      return NextResponse.json(
        { error: 'Appeal reason is required' },
        { status: 400 }
      );
    }

    const claimIdNum = parseInt(claimId);

    // Check if it's a workflow claim or parametric claim
    const workflowClaim = await db.workflowClaim.findUnique({
      where: { id: claimIdNum },
      include: {
        customer: true,
        status: true,
        rejections: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (workflowClaim) {
      // Verify claim belongs to the requesting user
      const customer = await db.customer.findFirst({
        where: {
          id: workflowClaim.customerId,
          user: { id: auth.userIdNum }
        }
      });

      if (!customer) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      // Check if claim is rejected
      if (workflowClaim.status?.statusCode !== 'REJECTED') {
        return NextResponse.json(
          { error: `Only rejected claims can be appealed. Current status: ${workflowClaim.status?.statusName}` },
          { status: 400 }
        );
      }

      // Check if rejection exists and appeal is within 30 days
      const rejection = workflowClaim.rejections[0];
      if (!rejection) {
        return NextResponse.json({ error: 'Rejection record not found' }, { status: 404 });
      }

      const daysSinceRejection = Math.floor(
        (Date.now() - rejection.rejectedAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceRejection > 30) {
        return NextResponse.json(
          { error: `Appeal deadline has passed. Rejections can be appealed within 30 days.` },
          { status: 400 }
        );
      }

      // Create appeal record (transactional)
      const appeal = await db.$transaction(async (tx) => {
        // Create appeal
        const appeal = await tx.claimAppeal.create({
          data: {
            workflowClaimId: workflowClaim.id,
            customerId: customer.id,
            appealReason,
            supportingDocumentUrl,
            appealStatus: 'SUBMITTED'
          }
        });

        // Update claim status to APPEALED
        const appealedStatus = await tx.enumWorkflowClaimStatus.findFirst({
          where: { statusCode: 'APPEALED' }
        });

        if (appealedStatus) {
          await tx.workflowClaim.update({
            where: { id: workflowClaim.id },
            data: { statusId: appealedStatus.id }
          });
        }

        return appeal;
      });

      // Audit log
      await logAction({
        entityType: 'WorkflowClaim',
        entityId: workflowClaim.id,
        actorId: auth.userIdNum,
        action: 'CLAIM_APPEAL_SUBMITTED',
        actionCategory: 'CLAIMS_MANAGEMENT',
        oldValues: { status: 'REJECTED' },
        newValues: { status: 'APPEALED', appealReason },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
        requestPath: `/api/customer/claims/${claimId}/appeal`,
        sessionId: auth.sessionId,
      });

      // Notify customer
      await notifyCustomer(auth.userIdNum, 'Your appeal has been submitted and will be reviewed.', 'CLAIM_APPEALED');
      // Notify admins
      await notifyAdmins(`New appeal submitted for workflow claim ${workflowClaim.id}`, 'CLAIM_APPEALED');

      return NextResponse.json({
        message: 'Appeal submitted successfully',
        appeal: {
          id: appeal.id,
          claimId: workflowClaim.id,
          appealStatus: appeal.appealStatus,
          appealDeadlineDate: new Date(rejection.rejectedAt.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
      }, { status: 201 });
    }

    // Check parametric claim
    const paramClaim = await db.parametricClaim.findUnique({
      where: { id: claimIdNum },
      include: {
        customer: true,
        status: true,
        rejections: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!paramClaim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    // Verify claim belongs to the requesting user
    const customer = await db.customer.findFirst({
      where: {
        id: paramClaim.customerId,
        user: { id: auth.userIdNum }
      }
    });

    if (!customer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check if claim is rejected
    if (paramClaim.status?.statusCode !== 'REJECTED') {
      return NextResponse.json(
        { error: `Only rejected claims can be appealed. Current status: ${paramClaim.status?.statusName}` },
        { status: 400 }
      );
    }

    // Check if rejection exists and appeal is within 30 days
    const rejection = paramClaim.rejections[0];
    if (!rejection) {
      return NextResponse.json({ error: 'Rejection record not found' }, { status: 404 });
    }

    const daysSinceRejection = Math.floor(
      (Date.now() - rejection.rejectedAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceRejection > 30) {
      return NextResponse.json(
        { error: `Appeal deadline has passed. Rejections can be appealed within 30 days.` },
        { status: 400 }
      );
    }

    // Create appeal record (transactional)
    const appeal = await db.$transaction(async (tx) => {
      // Create appeal
      const appeal = await tx.claimAppeal.create({
        data: {
          paramClaimId: paramClaim.id,
          customerId: customer.id,
          appealReason,
          supportingDocumentUrl,
          appealStatus: 'SUBMITTED'
        }
      });

      // Update claim status to APPEALED
      const appealedStatus = await tx.enumParamClaimStatus.findFirst({
        where: { statusCode: 'APPEALED' }
      });

      if (appealedStatus) {
        await tx.parametricClaim.update({
          where: { id: paramClaim.id },
          data: { statusId: appealedStatus.id }
        });
      }

      return appeal;
    });

    // Audit log
    await logAction({
      entityType: 'ParametricClaim',
      entityId: paramClaim.id,
      actorId: auth.userIdNum,
      action: 'CLAIM_APPEAL_SUBMITTED',
      actionCategory: 'CLAIMS_MANAGEMENT',
      oldValues: { status: 'REJECTED' },
      newValues: { status: 'APPEALED', appealReason },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      requestPath: `/api/customer/claims/${claimId}/appeal`,
      sessionId: auth.sessionId,
    });

    // Notify customer
    await notifyCustomer(auth.userIdNum, 'Your appeal has been submitted and will be reviewed.', 'CLAIM_APPEALED', { parametricClaimId: paramClaim.id });
    // Notify admins
    await notifyAdmins(`New appeal submitted for parametric claim ${paramClaim.id}`, 'CLAIM_APPEALED', { parametricClaimId: paramClaim.id });

    return NextResponse.json({
      message: 'Appeal submitted successfully',
      appeal: {
        id: appeal.id,
        claimId: paramClaim.id,
        appealStatus: appeal.appealStatus,
        appealDeadlineDate: new Date(rejection.rejectedAt.getTime() + 30 * 24 * 60 * 60 * 1000),
      },
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'An error occurred while submitting the appeal' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/customer/claims/[claimId]/appeal
 * Get appeal details for a claim
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ claimId: string }> }
) {
  try {
    const auth = await getAuthInfo(request);
    if (!auth) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { claimId } = await params;

    const claimIdNum = parseInt(claimId);

    // Check workflow claim first
    const workflowClaim = await db.workflowClaim.findUnique({
      where: { id: claimIdNum },
      include: {
        customer: true,
        status: true,
        appeals: {
          orderBy: { createdAt: 'desc' }
        },
        rejections: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (workflowClaim) {
      const customer = await db.customer.findFirst({
        where: {
          id: workflowClaim.customerId,
          user: { id: auth.userIdNum }
        }
      });

      if (!customer) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      return NextResponse.json({
        claim: {
          id: workflowClaim.id,
          status: workflowClaim.status?.statusCode,
          claimNumber: workflowClaim.claimNumber
        },
        appeals: workflowClaim.appeals,
        rejection: workflowClaim.rejections[0],
        canAppeal: workflowClaim.status?.statusCode === 'REJECTED'
      });
    }

    // Check parametric claim
    const paramClaim = await db.parametricClaim.findUnique({
      where: { id: claimIdNum },
      include: {
        customer: true,
        status: true,
        appeals: {
          orderBy: { createdAt: 'desc' }
        },
        rejections: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!paramClaim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    const customer = await db.customer.findFirst({
      where: {
        id: paramClaim.customerId,
        user: { id: auth.userIdNum }
      }
    });

    if (!customer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json({
      claim: {
        id: paramClaim.id,
        status: paramClaim.status?.statusCode,
        claimNumber: paramClaim.claimNumber
      },
      appeals: paramClaim.appeals,
      rejection: paramClaim.rejections[0],
      canAppeal: paramClaim.status?.statusCode === 'REJECTED'
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'An error occurred while fetching appeal details' },
      { status: 500 }
    );
  }
}

