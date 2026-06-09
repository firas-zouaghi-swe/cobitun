import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { disputeClaim, manuallyApproveClaim } from '@/lib/parametric-engine';
import { getAuthInfo, AuthInfo } from '@/lib/services/auth-helper';
import { requireRole, Roles } from '@/lib/services/authorization';
import { logAction } from '@/lib/services/audit-service';
import { notifyCustomer } from '@/lib/services/notification-service';

// Payable statuses: claim must be in one of these before it can be paid
const PAYABLE_STATUSES = ['APPROVED', 'UNDER_REVIEW'];
// Statuses that block rejection (already final)
const NON_REJECTABLE_STATUSES = ['PAID'];

function safeJsonParse(str: string | null, fallback: any = null) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

export async function GET(request: NextRequest) {
  const authOrResp = await requireRole(request, Roles.ADMIN);
  if ((authOrResp as any).status) return authOrResp as NextResponse;

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10')));
    const skip = (page - 1) * limit;

    const where = { isDeleted: 0 };

    const [claims, total] = await Promise.all([
      db.parametricClaim.findMany({
        where,
        skip,
        take: limit,
        include: {
          customer: { include: { user: true } },
          policy: {
            include: {
              cloudProvider: { include: { slaTier: true } },
              sector: { select: { sectorCode: true, sectorName: true } },
              businessModel: { select: { modelCode: true, modelName: true } },
            },
          },
          triggerEvent: {
            include: { slaTier: { select: { tierCode: true, tierName: true } } },
          },
          status: { select: { statusCode: true, statusName: true } },
          reviewedByUser: { select: { id: true, firstName: true, lastName: true } },
          paidByUser: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.parametricClaim.count({ where }),
    ]);

    // Parse payout calculation JSON for each claim
    const claimsWithParsedCalc = claims.map((claim) => ({
      ...claim,
      payoutCalculation: safeJsonParse(claim.payoutCalculationJson, {}),
    }));

    return NextResponse.json({
      claims: claimsWithParsedCalc,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Get parametric claims error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authOrResp = await requireRole(request, Roles.ADMIN);
    if ((authOrResp as any).status) return authOrResp as NextResponse;
    const auth = authOrResp as AuthInfo;

    const body = await request.json();
    const { claimId, action, adminComment } = body;

    if (!claimId || !action) {
      return NextResponse.json({ error: 'Claim ID and action are required' }, { status: 400 });
    }

    const claim = await db.parametricClaim.findUnique({
      where: { id: claimId },
      include: { status: true, customer: { include: { user: true } } },
    });
    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    switch (action) {
      case 'dispute': {
        if (!adminComment) {
          return NextResponse.json({ error: 'Admin comment is required for disputes' }, { status: 400 });
        }
        await disputeClaim(claimId, adminComment);
        // Set reviewedBy
        await db.parametricClaim.update({
          where: { id: claimId },
          data: { reviewedBy: auth.userIdNum, reviewedAt: new Date(), reviewNotes: adminComment, updatedBy: auth.userIdNum },
        });

        await notifyCustomer(
          claim.customer.userId,
          `Your claim ${claim.claimNumber} has been disputed.`,
          'action_required',
          { parametricClaimId: claimId }
        );
        break;
      }

      case 'approve': {
        await manuallyApproveClaim(claimId);
        // Set reviewedBy
        await db.parametricClaim.update({
          where: { id: claimId },
          data: { reviewedBy: auth.userIdNum, reviewedAt: new Date(), updatedBy: auth.userIdNum },
        });

        await notifyCustomer(
          claim.customer.userId,
          `Your claim ${claim.claimNumber} has been approved.`,
          'action_required',
          { parametricClaimId: claimId }
        );
        break;
      }

      case 'pay': {
        // Verify claim is in a payable status before paying
        const currentStatusCode = claim.status?.statusCode;
        if (!PAYABLE_STATUSES.includes(currentStatusCode || '')) {
          return NextResponse.json({ error: `Cannot pay claim in status '${currentStatusCode}'. Must be in: ${PAYABLE_STATUSES.join(', ')}` }, { status: 400 });
        }

        // Look up PAID status
        const paidStatus = await db.enumParamClaimStatus.findFirst({
          where: { statusCode: 'PAID', isCurrent: 1 },
          select: { id: true },
        });

        if (!paidStatus) {
          return NextResponse.json({ error: 'PAID status not found in system' }, { status: 500 });
        }

        await db.parametricClaim.update({
          where: { id: claimId },
          data: {
            statusId: paidStatus.id,
            paidBy: auth.userIdNum,
            paidAt: new Date(),
            payoutTransactionId: `PAY-${Date.now()}`,
            payoutMethod: 'BANK_TRANSFER',
            updatedBy: auth.userIdNum,
          },
        });

        await notifyCustomer(
          claim.customer.userId,
          `Your claim ${claim.claimNumber} has been paid.`,
          'info',
          { parametricClaimId: claimId }
        );
        break;
      }

      case 'reject': {
        // Verify claim is not already PAID before rejecting
        const currentStatusCode = claim.status?.statusCode;
        if (NON_REJECTABLE_STATUSES.includes(currentStatusCode || '')) {
          return NextResponse.json({ error: `Cannot reject claim in status '${currentStatusCode}'.` }, { status: 400 });
        }

        // Look up REJECTED status
        const rejectedStatus = await db.enumParamClaimStatus.findFirst({
          where: { statusCode: 'REJECTED', isCurrent: 1 },
          select: { id: true },
        });

        if (!rejectedStatus) {
          return NextResponse.json({ error: 'REJECTED status not found in system' }, { status: 500 });
        }

        await db.parametricClaim.update({
          where: { id: claimId },
          data: {
            statusId: rejectedStatus.id,
            adminOverride: 1,
            adminOverrideReason: adminComment || 'Rejected by admin',
            adminOverrideAt: new Date(),
            updatedBy: auth.userIdNum,
          },
        });

        await notifyCustomer(
          claim.customer.userId,
          `Your claim ${claim.claimNumber} has been rejected.`,
          'info',
          { parametricClaimId: claimId }
        );
        break;
      }

      default:
        return NextResponse.json({ error: 'Invalid action. Use: dispute, approve, pay, or reject' }, { status: 400 });
    }

    // Audit
    await logAction({
      entityType: 'ParametricClaim',
      entityId: claimId,
      actorId: auth.userIdNum,
      action: action.toUpperCase(),
      actionCategory: 'ADMIN',
      oldValues: { statusId: claim.statusId, statusCode: claim.status?.statusCode },
      newValues: { action, adminComment },
      requestPath: '/api/admin/parametric-claims',
    });

    // Fetch updated claim
    const updatedClaim = await db.parametricClaim.findUnique({
      where: { id: claimId },
      include: {
        customer: { include: { user: true } },
        policy: {
          include: {
            cloudProvider: { include: { slaTier: true } },
          },
        },
        triggerEvent: {
          include: { slaTier: { select: { tierCode: true, tierName: true } } },
        },
        status: { select: { statusCode: true, statusName: true } },
        reviewedByUser: { select: { id: true, firstName: true, lastName: true } },
        paidByUser: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return NextResponse.json({
      claim: updatedClaim
        ? { ...updatedClaim, payoutCalculation: safeJsonParse(updatedClaim.payoutCalculationJson, {}) }
        : null,
    });
  } catch (error) {
    console.error('Update parametric claim error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}



