
/**
 * IODA Auto-Claim DRAFT API
 * POST - IODA detection creates DRAFT claim (not submitted)
 *       Customer must confirm to file the claim
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { db } from '@/lib/db';
import { Errors, errorResponse, validateRequestBody } from '@/middleware/validation';
import { z } from 'zod';
import { logAction } from '@/lib/services/audit-service';
import { notifyCustomer } from '@/lib/services/notification-service';

const iodaDraftSchema = z.object({
  policyId: z.number().int().positive(),
  outageStart: z.string().datetime(),
  outageEnd: z.string().datetime().optional(),
  providerName: z.string().min(1).max(200),
  asn: z.string().max(50).optional(),
  outageType: z.string().max(100).optional(),
  exposureScore: z.number().min(0).max(100).optional(),
  description: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN' && auth.role !== 'SYSTEM') return Errors.forbidden();

  const result = await validateRequestBody(request, iodaDraftSchema);
  if ('error' in result) return result.error;

  try {
    const data = result.data;

    const policy = await db.parametricPolicy.findFirst({
      where: { id: data.policyId, isDeleted: 0 },
      include: { status: true, customer: { include: { user: true } }, cloudProvider: true },
    });

    if (!policy) return Errors.notFound('Policy');
    if (policy.status?.statusCode !== 'ACTIVE') {
      return errorResponse('Can only create draft claims for active policies', 'INVALID_STATUS', 409);
    }

    // Find DRAFT claim status
    const draftStatus = await db.enumParamClaimStatus.findFirst({ where: { statusCode: 'DRAFT' } });
    if (!draftStatus) return Errors.internal();

    // Calculate outage duration
    const outageStart = new Date(data.outageStart);
    const outageEnd = data.outageEnd ? new Date(data.outageEnd) : new Date();
    const durationMs = outageEnd.getTime() - outageStart.getTime();
    const durationHours = Math.max(0, durationMs / (1000 * 60 * 60));

    // Calculate payout amount based on policy hourly payout rate and duration
    const hourlyPayoutRate = Number(policy.hourlyPayoutRate || 0);
    const maxInsuredHours = Number(policy.maxInsuredHours || 0);
    const cappedHours = Math.min(durationHours, maxInsuredHours);
    const payoutAmount = Math.min(hourlyPayoutRate * cappedHours, Number(policy.maxPayoutAmount || 0));

    // Create DRAFT claim (not submitted - customer must confirm)
    const claim = await db.parametricClaim.create({
      data: {
        policyId: data.policyId,
        customerId: policy.customerId,
        claimNumber: `CLM-DRAFT-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        statusId: draftStatus.id,
        outageDurationHours: durationHours,
        hourlyPayoutRate: policy.hourlyPayoutRate,
        payoutAmount,
        payoutCalculationJson: JSON.stringify({
          durationHours,
          cappedHours,
          hourlyPayoutRate,
          maxInsuredHours,
          maxPayoutAmount: Number(policy.maxPayoutAmount || 0),
          iodaDetected: true,
          providerName: data.providerName,
          asn: data.asn,
          outageType: data.outageType,
          exposureScore: data.exposureScore,
          outageStart: data.outageStart,
          outageEnd: data.outageEnd,
        }),
        reviewNotes: data.description ?? `IODA-detected outage for ${data.providerName}`,
      },
    });

    // Notify customer about the detected outage (DRAFT - needs confirmation)
    if (policy.customer?.user) {
      await notifyCustomer(
        policy.customer.user.id,
        `We detected an outage affecting ${data.providerName}. A draft claim has been created for your policy ${policy.policyNumber}. Please review and confirm to file the claim.`,
        'action_required',
        { parametricPolicyId: data.policyId, parametricClaimId: claim.id }
      );
    }

    await logAction({
      entityType: 'ParametricClaim',
      entityId: claim.id,
      action: 'IODA_DRAFT_CREATED',
      actorId: auth.userIdNum,
      actorType: 'SYSTEM',
      metadata: { policyId: data.policyId, providerName: data.providerName, exposureScore: data.exposureScore },
      ipAddress: request.headers.get('x-forwarded-for') || 'system',
    });

    return NextResponse.json({
      message: 'DRAFT claim created. Customer must confirm to file.',
      claimId: claim.id,
      claimNumber: claim.claimNumber,
      status: 'DRAFT',
      requiresCustomerConfirmation: true,
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create IODA draft claim', error);
    return Errors.internal();
  }
}

