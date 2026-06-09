
/**
 * Policy Renewal API (Admin)
 * GET  - List renewal-eligible policies
 * POST - Trigger renewal process for a policy
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { db } from '@/lib/db';
import { Errors, errorResponse, validateRequestBody } from '@/middleware/validation';
import { z } from 'zod';
import { logAction } from '@/lib/services/audit-service';
import { notifyCustomerObject } from '@/lib/services/notification-service';

const triggerRenewalSchema = z.object({
  policyId: z.number().int().positive(),
  newPremiumAmount: z.number().positive().optional(),
  newEndDate: z.string().datetime().optional(),
});

export async function GET(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));

    // Find policies expiring within 30 days
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const activeStatus = await db.enumParamPolicyStatus.findFirst({
      where: { statusCode: 'ACTIVE', isCurrent: 1 },
    });

    if (!activeStatus) {
      return NextResponse.json({ policies: [], pagination: { page, limit, total: 0, totalPages: 0 } });
    }

    const where = {
      statusId: activeStatus.id,
      isDeleted: 0,
      expiryDate: { lte: thirtyDaysFromNow, gte: now },
    };

    const [policies, total] = await Promise.all([
      db.parametricPolicy.findMany({
        where,
        orderBy: { expiryDate: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          customer: { select: { id: true, companyName: true, user: { select: { email: true } } } },
          cloudProvider: { select: { id: true, organisationName: true } },
          status: { select: { statusCode: true, statusName: true } },
        },
      }),
      db.parametricPolicy.count({ where }),
    ]);

    return NextResponse.json({
      policies: policies.map((p) => ({
        id: p.id,
        policyNumber: p.policyNumber,
        endDate: p.expiryDate?.toISOString(),
        premiumAmount: p.finalPremium,
        customer: p.customer,
        provider: p.cloudProvider,
        daysUntilExpiry: Math.ceil((p.expiryDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
        isRenewalEligible: true,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Failed to list renewal-eligible policies:', error);
    return Errors.internal();
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  const result = await validateRequestBody(request, triggerRenewalSchema);
  if ('error' in result) return result.error;

  try {
    const { policyId, newPremiumAmount, newEndDate } = result.data;

    const policy = await db.parametricPolicy.findFirst({
      where: { id: policyId, isDeleted: 0 },
      include: { customer: { include: { user: true } }, status: true },
    });

    if (!policy) return Errors.notFound('Policy');
    if (policy.status?.statusCode !== 'ACTIVE') {
      return errorResponse('Only active policies can be renewed', 'INVALID_STATE', 400);
    }

    // Check renewal eligibility - must be within 30 days of expiry
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    if (policy.expiryDate! > thirtyDaysFromNow) {
      return errorResponse('Policy is not yet eligible for renewal (more than 30 days until expiry)', 'NOT_ELIGIBLE', 400);
    }

    // Calculate renewal premium (default: same as current + 5% adjustment)
    const renewalPremium = newPremiumAmount || Number(policy.finalPremium) * 1.05;
    const renewalStartDate = new Date(policy.expiryDate!.getTime() + 1); // Day after current expiry
    const renewalEndDate = newEndDate
      ? new Date(newEndDate)
      : new Date(renewalStartDate.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year

    // Create renewal record
    const renewal = await db.parametricPolicyRenewal.create({
      data: {
        parentPolicyId: policyId,
        newPolicyId: null, // Will be set when customer accepts
        renewalNumber: `REN-${policy.policyNumber}-${Date.now()}`,
        renewalTermMonths: 12,
        previousPremium: Number(policy.finalPremium),
        newPremium: renewalPremium,
        premiumAdjustmentReason: `Auto-calculated renewal. Premium: ${renewalPremium.toFixed(2)} TND`,
        status: 'PENDING',
        quotedAt: new Date(),
        quotedBy: auth.userIdNum,
        version: 1,
      },
    });

    // Notify customer about renewal
    await notifyCustomerObject({
      customerId: policy.customerId,
      type: 'policy_update',
      title: 'Policy Renewal Available',
      message: `Your policy ${policy.policyNumber} is eligible for renewal. New premium: ${renewalPremium.toFixed(2)} TND. Please review and accept the renewal.`,
      metadata: { renewalId: renewal.id, policyId, renewalPremium },
    });

    await logAction({
      entityType: 'ParametricPolicyRenewal',
      entityId: renewal.id,
      action: 'INITIATE_RENEWAL',
      actorId: auth.userIdNum,
      actorType: auth.role,
      metadata: { policyId, renewalPremium, renewalEndDate: renewalEndDate.toISOString() },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json({
      renewal: {
        id: renewal.id,
        originalPolicyId: policyId,
        renewalPremium,
        renewalStartDate: renewalStartDate.toISOString(),
        renewalEndDate: renewalEndDate.toISOString(),
        status: 'PENDING',
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to trigger renewal:', error);
    return Errors.internal();
  }
}

