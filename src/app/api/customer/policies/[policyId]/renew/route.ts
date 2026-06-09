
/**
 * Customer Policy Renewal API
 * GET  - Check renewal eligibility
 * POST - Accept policy renewal
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { db } from '@/lib/db';
import { Errors, errorResponse } from '@/middleware/validation';
import { logAction } from '@/lib/services/audit-service';
import { notifyCustomer } from '@/lib/services/notification-service';
import { generatePolicyNumber } from '@/lib/parametric-engine';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ policyId: string }> }
) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'CUSTOMER') return Errors.forbidden();

  const { policyId } = await params;
  const policyIdNum = parseInt(policyId, 10);
  if (isNaN(policyIdNum)) return Errors.notFound('Policy');

  try {
    const policy = await db.parametricPolicy.findFirst({
      where: { id: policyIdNum, isDeleted: 0 },
      include: { status: true, customer: true, product: true },
    });

    if (!policy) return Errors.notFound('Policy');
    const customer = await db.customer.findUnique({ where: { userId: auth.userIdNum } });
    if (!customer) return Errors.forbidden();
    if (policy.customerId !== customer.id) return Errors.forbidden();

    const now = new Date();
    const expiryDate = policy.expiryDate ? new Date(policy.expiryDate) : null;
    const daysUntilExpiry = expiryDate ? Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

    const isEligible = policy.status?.statusCode === 'ACTIVE' && daysUntilExpiry !== null && daysUntilExpiry <= 30 && daysUntilExpiry > 0;

    // Calculate renewal premium (same rate, adjusted for inflation/changes)
    const renewalPremium = policy.finalPremium;
    const renewalRate = policy.premiumRatePct;

    return NextResponse.json({
      policyId: policy.id,
      policyNumber: policy.policyNumber,
      status: policy.status?.statusCode,
      expiryDate: policy.expiryDate?.toISOString() ?? null,
      daysUntilExpiry,
      isEligibleForRenewal: isEligible,
      renewalPremium,
      renewalRate,
      product: policy.product?.productName ?? null,
    });
  } catch (error) {
    console.error('Failed to check renewal eligibility', error);
    return Errors.internal();
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ policyId: string }> }
) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'CUSTOMER') return Errors.forbidden();

  const { policyId } = await params;
  const policyIdNum = parseInt(policyId, 10);
  if (isNaN(policyIdNum)) return Errors.notFound('Policy');

  try {
    const policy = await db.parametricPolicy.findFirst({
      where: { id: policyIdNum, isDeleted: 0 },
      include: { status: true, customer: { include: { user: true } }, product: true },
    });

    if (!policy) return Errors.notFound('Policy');
    const customer = await db.customer.findUnique({ where: { userId: auth.userIdNum } });
    if (!customer) return Errors.forbidden();
    if (policy.customerId !== customer.id) return Errors.forbidden();

    const now = new Date();
    const expiryDate = policy.expiryDate ? new Date(policy.expiryDate) : null;
    const daysUntilExpiry = expiryDate ? Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

    const isEligible = policy.status?.statusCode === 'ACTIVE' && daysUntilExpiry !== null && daysUntilExpiry <= 30 && daysUntilExpiry > 0;
    if (!isEligible) {
      return errorResponse('Policy is not eligible for renewal', 'NOT_ELIGIBLE', 400);
    }

    // Create renewal policy
    const newPolicyNumber = await generatePolicyNumber();
    const newExpiryDate = new Date(expiryDate!.getTime() + 365 * 24 * 60 * 60 * 1000); // +1 year

    const newPolicy = await db.parametricPolicy.create({
      data: {
        policyNumber: newPolicyNumber,
        customerId: policy.customerId,
        cloudProviderId: policy.cloudProviderId,
        productId: policy.productId,
        sectorId: policy.sectorId,
        businessModelId: policy.businessModelId,
        turnoverBandId: policy.turnoverBandId,
        resilienceProfileId: policy.resilienceProfileId,
        annualTurnoverTnd: policy.annualTurnoverTnd,
        hourlyRevenue: policy.hourlyRevenue,
        basePremium: policy.basePremium,
        commercialPremium: policy.commercialPremium,
        providerAdjustedPremium: policy.providerAdjustedPremium,
        finalPremium: policy.finalPremium,
        premiumRatePct: policy.premiumRatePct,
        maxInsuredHours: policy.maxInsuredHours,
        hourlyPayoutRate: policy.hourlyPayoutRate,
        maxPayoutAmount: policy.maxPayoutAmount,
        payoutFunctionConfigId: policy.payoutFunctionConfigId,
        sectorFactorAtCreation: policy.sectorFactorAtCreation,
        businessModelFactorAtCreation: policy.businessModelFactorAtCreation,
        turnoverBandFactorAtCreation: policy.turnoverBandFactorAtCreation,
        resilienceFactorAtCreation: policy.resilienceFactorAtCreation,
        providerFactorAtCreation: policy.providerFactorAtCreation,
        loadingFactorAtCreation: policy.loadingFactorAtCreation,
        underwritingDecision: 'AUTO_APPROVED',
        underwritingNotes: 'Renewal of policy ' + policy.policyNumber,
        effectiveDate: expiryDate,
        expiryDate: newExpiryDate,
        createdBy: auth.userIdNum,
      },
    });

    // Create renewal record
    await db.parametricPolicyRenewal.create({
      data: {
        parentPolicyId: policyIdNum,
        newPolicyId: newPolicy.id,
        renewalNumber: `REN-${Date.now()}`,
        previousPremium: policy.finalPremium,
        newPremium: policy.finalPremium,
        status: 'ACCEPTED',
        quotedBy: auth.userIdNum,
        quotedAt: new Date(),
        acceptedAt: new Date(),
      },
    });

    // Notify customer
    if (policy.customer?.user) {
      await notifyCustomer(policy.customer.user.id, `Your policy ${policy.policyNumber} has been renewed. New policy: ${newPolicyNumber}`, 'policy_update', { parametricPolicyId: newPolicy.id });
    }

    await logAction({
      entityType: 'ParametricPolicy',
      entityId: policyIdNum,
      action: 'RENEW',
      actorId: auth.userIdNum,
      actorType: 'CUSTOMER',
      metadata: { oldPolicyNumber: policy.policyNumber, newPolicyNumber, newPolicyId: newPolicy.id },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json({
      message: 'Policy renewed successfully',
      oldPolicyId: policyIdNum,
      newPolicyId: newPolicy.id,
      newPolicyNumber,
      effectiveDate: expiryDate?.toISOString(),
      expiryDate: newExpiryDate.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to renew policy', error);
    return Errors.internal();
  }
}

