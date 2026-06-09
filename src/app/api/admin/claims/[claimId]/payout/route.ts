/**
 * Admin Payout Processing Endpoint
 * POST /api/admin/claims/[claimId]/payout
 * PATCH /api/admin/claims/[claimId]/payout
 * 
 * Process payouts for approved claims with financial safety controls.
 * Payout is tracked directly on ParametricClaim / WorkflowClaim via
 * paidBy, paidAt, payoutTransactionId, payoutMethod, payoutAmount.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, safeTransaction } from '@/lib/db';
import { requireRole, Roles } from '@/lib/services/authorization';
import { AuthInfo } from '@/lib/services/auth-helper';
import { logAction } from '@/lib/services/audit-service';
import { notifyCustomer } from '@/lib/services/notification-service';
import { z } from 'zod';

const initiatePayoutSchema = z.object({
  payoutAmount: z.number().positive('Payout amount must be positive'),
  payoutMethod: z.enum(['BANK_TRANSFER', 'MOBILE_MONEY', 'CHECK', 'CASH']),
  payoutReference: z.string().min(3, 'Payout reference is required'),
  bankAccountLast4: z.string().optional(),
  notes: z.string().optional(),
});

const updatePayoutSchema = z.object({
  status: z.enum(['PROCESSING', 'COMPLETED', 'FAILED', 'REVERSED']),
  transactionReference: z.string().optional(),
  failureReason: z.string().optional(),
  completedAt: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * POST /api/admin/claims/[claimId]/payout
 * Initiate a payout for an approved claim
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ claimId: string }> }
) {
  try {
    const authOrResp = await requireRole(request, Roles.ADMIN);
    if ((authOrResp as any).status) return authOrResp as NextResponse;
    const auth = authOrResp as AuthInfo;

    const { claimId } = await params;
    const body = await request.json();
    const parsed = initiatePayoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid payout data' },
        { status: 400 }
      );
    }

    const { payoutAmount, payoutMethod, payoutReference, bankAccountLast4, notes } = parsed.data;
    const claimIdNum = parseInt(claimId, 10);
    if (isNaN(claimIdNum)) {
      return NextResponse.json({ error: 'Invalid claim ID' }, { status: 400 });
    }

    // Check if claim exists and determine type
    const isWorkflow = (await db.workflowClaim.findUnique({ where: { id: claimIdNum } })) !== null;

    // Look up PAID status before transaction
    const statusModel = isWorkflow ? 'enumWorkflowClaimStatus' : 'enumParamClaimStatus';
    const claimModel = isWorkflow ? 'workflowClaim' : 'parametricClaim';
    const paidStatus = await (db as any)[statusModel].findFirst({
      where: { statusCode: 'PAID', isCurrent: 1 },
    });

    // Use safeTransaction to prevent double-payout race condition:
    // check + update must be atomic so two concurrent requests cannot both pass the guard.
    let claim: any;
    try {
      claim = await safeTransaction(async (tx) => {
        const c = isWorkflow
          ? await (tx as any).workflowClaim.findUnique({ where: { id: claimIdNum }, include: { status: true, customer: { include: { user: true } } } })
          : await (tx as any).parametricClaim.findUnique({ where: { id: claimIdNum }, include: { status: true, customer: { include: { user: true } } } });

        if (!c) throw new Error('Claim not found');

        // Verify claim is in APPROVED status
        if (c.status?.statusCode !== 'APPROVED') {
          throw new Error(`Payouts can only be initiated for approved claims. Current status: ${c.status?.statusCode}`);
        }

        // Check for existing payout (if already paid) — inside tx to prevent race
        if (c.paidAt || c.payoutTransactionId) {
          throw new Error('ALREADY_PAID');
        }

        // Record payout on the claim and update status atomically
        await (tx as any)[claimModel].update({
          where: { id: claimIdNum },
          data: {
            payoutAmount,
            payoutMethod,
            payoutTransactionId: payoutReference,
            paidBy: auth.userIdNum,
            paidAt: new Date(),
            ...(paidStatus ? { statusId: paidStatus.id } : {}),
            updatedAt: new Date(),
          },
        });

        return c;
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'ALREADY_PAID') {
        return NextResponse.json(
          { error: 'A payout already exists for this claim' },
          { status: 409 }
        );
      }
      if (error instanceof Error && error.message === 'Claim not found') {
        return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
      }
      if (error instanceof Error && error.message.startsWith('Payouts can only be initiated')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }

    // Audit log
    await logAction({
      entityType: isWorkflow ? 'WorkflowClaim' : 'ParametricClaim',
      entityId: claimIdNum,
      actorId: auth.userIdNum,
      action: 'PAYOUT_INITIATED',
      actionCategory: 'FINANCIAL_OPERATIONS',
      oldValues: { status: 'APPROVED' },
      newValues: { status: 'PAID', payoutAmount, payoutMethod, payoutReference },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      requestPath: `/api/admin/claims/${claimId}/payout`,
    });

    // Notify customer
    await notifyCustomer(
      claim.customer?.user?.id ?? claim.customerId,
      `A payout of ${payoutAmount} TND has been initiated for your claim. Reference: ${payoutReference}`,
      'PAYOUT_INITIATED',
      { parametricClaimId: isWorkflow ? undefined : claimIdNum, cyberClaimId: isWorkflow ? claimIdNum : undefined }
    );

    return NextResponse.json({
      message: 'Payout initiated successfully',
      payout: {
        claimId: claimIdNum,
        payoutAmount,
        payoutMethod,
        payoutReference,
        payoutStatus: 'PENDING',
        initiatedBy: auth.userIdNum,
        createdAt: new Date().toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Payout initiation error:', error);
    return NextResponse.json(
      { error: 'An error occurred while initiating the payout' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/claims/[claimId]/payout
 * Update payout status (mark as completed, failed, or reversed)
 */
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
    const parsed = updatePayoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid update data' },
        { status: 400 }
      );
    }

    const { status, transactionReference, failureReason, completedAt, notes } = parsed.data;
    const claimIdNum = parseInt(claimId, 10);
    if (isNaN(claimIdNum)) {
      return NextResponse.json({ error: 'Invalid claim ID' }, { status: 400 });
    }

    // Find the claim with payout info
    const isWorkflow = (await db.workflowClaim.findUnique({ where: { id: claimIdNum } })) !== null;
    const claimModel = isWorkflow ? 'workflowClaim' : 'parametricClaim';
    const claim = isWorkflow
      ? await db.workflowClaim.findUnique({ where: { id: claimIdNum }, include: { status: true, customer: { include: { user: true } } } })
      : await db.parametricClaim.findUnique({ where: { id: claimIdNum }, include: { status: true, customer: { include: { user: true } } } });

    if (!claim) {
      return NextResponse.json({ error: 'No payout found for this claim' }, { status: 404 });
    }

    // Current payout state inferred from claim fields
    const currentPayoutStatus = claim.paidAt ? 'COMPLETED' : claim.payoutTransactionId ? 'PROCESSING' : 'PENDING';

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      PENDING: ['PROCESSING', 'FAILED'],
      PROCESSING: ['COMPLETED', 'FAILED'],
      COMPLETED: ['REVERSED'],
      FAILED: ['PENDING'],
      REVERSED: [],
    };

    if (!validTransitions[currentPayoutStatus]?.includes(status)) {
      return NextResponse.json(
        { error: `Cannot transition payout from ${currentPayoutStatus} to ${status}` },
        { status: 400 }
      );
    }

    // Update payout on the claim
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (status === 'COMPLETED') {
      updateData.paidAt = completedAt ? new Date(completedAt) : new Date();
      if (transactionReference) updateData.payoutTransactionId = transactionReference;
      updateData.paidBy = auth.userIdNum;
    } else if (status === 'PROCESSING') {
      if (transactionReference) updateData.payoutTransactionId = transactionReference;
    } else if (status === 'FAILED') {
      updateData.paidAt = null;
      updateData.payoutTransactionId = null;
      updateData.paidBy = null;
    } else if (status === 'REVERSED') {
      updateData.paidAt = null;
      updateData.payoutTransactionId = null;
      updateData.paidBy = null;
    }

    await (db as any)[claimModel].update({
      where: { id: claimIdNum },
      data: updateData,
    });

    // If payout failed or reversed, update claim status back
    if (status === 'FAILED' || status === 'REVERSED') {
      const statusModel = isWorkflow ? 'enumWorkflowClaimStatus' : 'enumParamClaimStatus';
      const targetStatus = status === 'FAILED' ? 'APPROVED' : 'PAID';
      const revertStatus = await (db as any)[statusModel].findFirst({
        where: { statusCode: targetStatus, isCurrent: 1 },
      });
      if (revertStatus) {
        await (db as any)[claimModel].update({
          where: { id: claimIdNum },
          data: { statusId: revertStatus.id, updatedAt: new Date() },
        });
      }
    }

    // Audit log
    await logAction({
      entityType: isWorkflow ? 'WorkflowClaim' : 'ParametricClaim',
      entityId: claimIdNum,
      actorId: auth.userIdNum,
      action: `PAYOUT_${status}`,
      actionCategory: 'FINANCIAL_OPERATIONS',
      oldValues: { payoutStatus: currentPayoutStatus },
      newValues: { payoutStatus: status, transactionReference, failureReason },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      requestPath: `/api/admin/claims/${claimId}/payout`,
    });

    // Notify customer
    const customerMessage = status === 'COMPLETED'
      ? `Your payout of ${claim.payoutAmount} TND has been completed. Reference: ${transactionReference || claim.payoutTransactionId}`
      : status === 'FAILED'
        ? `Your payout of ${claim.payoutAmount} TND has failed. Reason: ${failureReason || 'Processing error'}. Please contact support.`
        : `Your payout of ${claim.payoutAmount} TND has been reversed. Please contact support.`;
    await notifyCustomer(
      claim.customer?.user?.id ?? claim.customerId,
      customerMessage,
      `PAYOUT_${status}`,
      { parametricClaimId: isWorkflow ? undefined : claimIdNum, cyberClaimId: isWorkflow ? claimIdNum : undefined }
    );

    return NextResponse.json({
      message: `Payout ${status.toLowerCase()} successfully`,
      payout: {
        claimId: claimIdNum,
        payoutStatus: status,
        transactionReference: transactionReference ?? claim.payoutTransactionId,
        completedAt: status === 'COMPLETED' ? (completedAt ? new Date(completedAt) : new Date()).toISOString() : null,
        processedBy: auth.userIdNum,
      },
    });
  } catch (error) {
    console.error('Payout update error:', error);
    return NextResponse.json(
      { error: 'An error occurred while updating the payout' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/claims/[claimId]/payout
 * Get payout details for a claim
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ claimId: string }> }
) {
  try {
    const authOrResp = await requireRole(request, Roles.ADMIN);
    if ((authOrResp as any).status) return authOrResp as NextResponse;

    const { claimId } = await params;
    const claimIdNum = parseInt(claimId, 10);
    if (isNaN(claimIdNum)) {
      return NextResponse.json({ error: 'Invalid claim ID' }, { status: 400 });
    }

    const isWorkflow = (await db.workflowClaim.findUnique({ where: { id: claimIdNum } })) !== null;
    const claim = isWorkflow
      ? await db.workflowClaim.findUnique({ where: { id: claimIdNum } })
      : await db.parametricClaim.findUnique({ where: { id: claimIdNum } });

    if (!claim || !claim.payoutTransactionId) {
      return NextResponse.json({ payout: null });
    }

    return NextResponse.json({
      payout: {
        claimId: claimIdNum,
        payoutAmount: claim.payoutAmount,
        payoutMethod: claim.payoutMethod,
        payoutReference: claim.payoutTransactionId,
        paidBy: claim.paidBy,
        paidAt: claim.paidAt?.toISOString() ?? null,
        payoutStatus: claim.paidAt ? 'COMPLETED' : 'PROCESSING',
      },
    });
  } catch (error) {
    console.error('Get payout error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching payout details' },
      { status: 500 }
    );
  }
}
