import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthInfo, resolveCustomerId } from '@/lib/services/auth-helper';
import { logAction } from '@/lib/services/audit-service';
import { notifyCustomer, notifyAdmins } from '@/lib/services/notification-service';
import { z } from 'zod';

const cancelPolicySchema = z.object({
  reason: z.string().min(5, 'Cancellation reason must be at least 5 characters'),
  cancellationCategory: z.enum(['CUSTOMER_REQUEST', 'NON_PAYMENT', 'FRAUD', 'ADMIN_CANCELLATION']).default('CUSTOMER_REQUEST'),
  remarks: z.string().optional(),
});

/**
 * POST /api/customer/policies/[policyId]/cancel
 * Cancels an active parametric policy and initiates prorated refund
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ policyId: string }> }
) {
  try {
    const { policyId } = await params;
    const auth = await getAuthInfo(request);
    if (!auth) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const customerId = await resolveCustomerId(auth);
    if (!customerId) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = cancelPolicySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid cancellation data' },
        { status: 400 }
      );
    }

    const { reason, cancellationCategory, remarks } = parsed.data;
    const policyIdNum = parseInt(policyId, 10);
    if (isNaN(policyIdNum)) {
      return NextResponse.json({ error: 'Invalid policy ID' }, { status: 400 });
    }

    // Fetch policy with status and dates
    const policy = await db.parametricPolicy.findFirst({
      where: { id: policyIdNum, customerId, isDeleted: 0 },
      include: { status: true },
    });

    if (!policy) {
      return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
    }

    // Check if policy is active
    if (policy.status?.statusCode !== 'ACTIVE') {
      return NextResponse.json(
        { error: `Only active policies can be cancelled. Current status: ${policy.status?.statusName}` },
        { status: 400 }
      );
    }

    // Check for existing pending cancellation
    const existingCancellation = await db.policyCancellation.findFirst({
      where: { parametricPolicyId: policyIdNum, isDeleted: 0, refundStatus: 'PENDING' },
    });
    if (existingCancellation) {
      return NextResponse.json(
        { error: 'A pending cancellation already exists for this policy' },
        { status: 409 }
      );
    }

    // Calculate prorated refund
    const today = new Date();
    const effectiveDate = policy.effectiveDate || policy.createdAt;
    const expiryDate = policy.expiryDate;
    if (!effectiveDate || !expiryDate) {
      return NextResponse.json(
        { error: 'Cannot calculate refund: Policy dates are invalid' },
        { status: 400 }
      );
    }

    const totalDays = Math.max(1, Math.floor((new Date(expiryDate).getTime() - new Date(effectiveDate).getTime()) / (1000 * 60 * 60 * 24)));
    const remainingDays = Math.max(0, Math.floor((new Date(expiryDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    const premiumPaid = Number(policy.finalPremium || 0);
    const refundAmount = totalDays > 0 ? Math.round(premiumPaid * (remainingDays / totalDays) * 1000) / 1000 : 0;

    // Create cancellation record and update policy (transactional)
    const cancellation = await db.$transaction(async (tx) => {
      const cancellation = await tx.policyCancellation.create({
        data: {
          parametricPolicyId: policy.id,
          customerId,
          cancellationReason: reason,
          cancellationCategory,
          refundAmount,
          refundStatus: 'PENDING',
          effectiveDate: today,
          cancellationInitiatedBy: auth.userIdNum,
          remarks: remarks ?? null,
        },
      });

      // Update policy status to CANCELLED
      const cancelledStatus = await tx.enumParamPolicyStatus.findFirst({
        where: { statusCode: 'CANCELLED', isCurrent: 1 },
      });
      if (cancelledStatus) {
        await tx.parametricPolicy.update({
          where: { id: policy.id },
          data: { statusId: cancelledStatus.id, updatedAt: today },
        });
      }

      return cancellation;
    });

    // Audit log with full context
    await logAction({
      entityType: 'ParametricPolicy',
      entityId: policy.id,
      actorId: auth.userIdNum,
      action: 'POLICY_CANCELLED',
      actionCategory: 'POLICY_MANAGEMENT',
      oldValues: { status: 'ACTIVE' },
      newValues: { status: 'CANCELLED', cancellationReason: reason, refundAmount, cancellationId: cancellation.id },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      requestPath: `/api/customer/policies/${policyId}/cancel`,
      sessionId: auth.sessionId,
    });

    // Notify customer
    await notifyCustomer(
      auth.userIdNum,
      `Your policy ${policy.policyNumber || policy.id} has been cancelled. A prorated refund of ${refundAmount.toFixed(3)} TND is pending.`,
      'POLICY_CANCELLED',
      { parametricPolicyId: policy.id }
    );

    // Notify admins
    await notifyAdmins(
      `Policy ${policy.policyNumber || policy.id} cancelled by customer. Refund: ${refundAmount.toFixed(3)} TND`,
      'POLICY_CANCELLED',
      { parametricPolicyId: policy.id }
    );

    return NextResponse.json({
      message: 'Policy cancelled successfully',
      cancellation: {
        id: cancellation.id,
        policyId: policy.id,
        refundAmount: refundAmount.toFixed(3),
        refundStatus: cancellation.refundStatus,
        effectiveDate: cancellation.effectiveDate,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'An error occurred while cancelling the policy' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/customer/policies/[policyId]/cancel
 * Get cancellation details for a policy
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ policyId: string }> }
) {
  try {
    const { policyId } = await params;
    const auth = await getAuthInfo(request);
    if (!auth) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const customerId = await resolveCustomerId(auth);
    if (!customerId) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const policyIdNum = parseInt(policyId, 10);
    const policy = await db.parametricPolicy.findFirst({
      where: { id: policyIdNum, customerId, isDeleted: 0 },
      include: { status: true },
    });

    if (!policy) {
      return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
    }

    // Get cancellations for this policy
    const cancellations = await db.policyCancellation.findMany({
      where: { parametricPolicyId: policyIdNum, isDeleted: 0 },
      orderBy: { createdAt: 'desc' },
    });

    const activeCancellation = cancellations.find((c) => c.refundStatus === 'PENDING') || null;

    return NextResponse.json({
      policy: {
        id: policy.id,
        status: policy.status?.statusCode,
        effectiveDate: policy.effectiveDate,
        expiryDate: policy.expiryDate,
        premiumAmount: policy.finalPremium,
      },
      cancellation: activeCancellation,
      cancellations,
      canCancel: policy.status?.statusCode === 'ACTIVE',
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'An error occurred while fetching cancellation details' },
      { status: 500 }
    );
  }
}

