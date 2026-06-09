
/**
 * Reinsurance Integration API
 * GET  - Get reinsurance status for claims
 * POST - Notify reinsurer, calculate ceded amounts, track claims
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { db } from '@/lib/db';
import { Errors, errorResponse, validateRequestBody } from '@/middleware/validation';
import { z } from 'zod';
import { logAction } from '@/lib/services/audit-service';

const notifyReinsurerSchema = z.object({
  claimId: z.number().int().positive(),
  treatyId: z.number().int().positive().optional(),
  notes: z.string().max(2000).optional(),
});

const calculateCededSchema = z.object({
  claimId: z.number().int().positive(),
  claimAmount: z.number().positive(),
});

export async function GET(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'summary';
    const claimId = parseInt(url.searchParams.get('claimId') || '0', 10);

    if (action === 'claim_tracking' && claimId) {
      return await getReinsuranceClaimTracking(claimId);
    }

    // Summary of reinsurance
    const treaties = await db.reinsuranceTreaty.findMany({
      where: { isDeleted: 0 },
      orderBy: { createdAt: 'desc' },
    });

    const parametricCeded = await db.parametricReinsuranceCeded.findMany({
      where: { isDeleted: 0 },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const cyberCeded = await db.cyberReinsuranceCeded.findMany({
      where: { isDeleted: 0 },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({
      treaties,
      parametricCeded,
      cyberCeded,
      summary: {
        totalTreaties: treaties.length,
        totalParametricCeded: parametricCeded.length,
        totalCyberCeded: cyberCeded.length,
      },
    });
  } catch (error) {
    console.error('Reinsurance API failed:', error);
    return Errors.internal();
  }
}

async function getReinsuranceClaimTracking(claimId: number) {
  const claim = await db.parametricClaim.findFirst({
    where: { id: claimId, isDeleted: 0 },
    include: { status: { select: { statusCode: true } } },
  });

  if (!claim) return Errors.notFound('Claim');

  // Find ceded records for this claim's policy
  const cededRecords = await db.parametricReinsuranceCeded.findMany({
    where: { parametricPolicyId: claim.policyId, isDeleted: 0 },
  });

  return NextResponse.json({
    claimId,
    claimNumber: claim.claimNumber,
    claimAmount: Number(claim.payoutAmount || 0),
    status: claim.status?.statusCode,
    reinsuranceCeded: cededRecords.map((c) => ({
      id: c.id,
      cededAmount: Number(c.cededPremium || 0),
      treatyId: c.treatyId,
      grossPremium: Number(c.grossPremium || 0),
      createdAt: c.createdAt?.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  try {
    const body = await request.json();
    const action = body.action as string;

    switch (action) {
      case 'notify':
        return await notifyReinsurer(request, body, auth);
      case 'calculate_ceded':
        return await calculateCededAmount(request, body, auth);
      case 'track_claim':
        return await trackReinsuranceClaim(request, body, auth);
      default:
        return errorResponse('Invalid action. Use: notify, calculate_ceded, track_claim', 'INVALID_ACTION', 400);
    }
  } catch (error) {
    console.error('Reinsurance action failed:', error);
    return Errors.internal();
  }
}

async function notifyReinsurer(request: NextRequest, body: Record<string, unknown>, auth: NonNullable<Awaited<ReturnType<typeof getAuthInfo>>>) {
  const result = await validateRequestBody(
    new NextRequest(request.url, { body: JSON.stringify(body), method: 'POST' }),
    notifyReinsurerSchema
  );
  if ('error' in result) return result.error;

  const { claimId, treatyId, notes } = result.data;

  const claim = await db.parametricClaim.findFirst({ where: { id: claimId, isDeleted: 0 } });
  if (!claim) return Errors.notFound('Claim');

  // Find applicable treaty
  let treaty;
  if (treatyId) {
    treaty = await db.reinsuranceTreaty.findFirst({ where: { id: treatyId, isDeleted: 0 } });
  } else {
    treaty = await db.reinsuranceTreaty.findFirst({
      where: { isDeleted: 0, treatyType: 'PROPORTIONAL' },
      orderBy: { retentionAmount: 'desc' },
    });
  }

  if (!treaty) {
    return errorResponse('No applicable reinsurance treaty found', 'NO_TREATY', 404);
  }

  // Log notification (in production, this would send to reinsurer system)
  await logAction({
    entityType: 'ReinsuranceTreaty',
    entityId: treaty.id,
    action: 'NOTIFY_REINSURER',
    actorId: auth.userIdNum,
    actorType: auth.role,
    metadata: { claimId, claimNumber: claim.claimNumber, claimAmount: Number(claim.payoutAmount || 0), treatyId: treaty.id, notes },
    ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
  });

  return NextResponse.json({
    message: 'Reinsurer notified successfully',
    claimId,
    treatyId: treaty.id,
    claimAmount: Number(claim.payoutAmount || 0),
    notificationDate: new Date().toISOString(),
  });
}

async function calculateCededAmount(request: NextRequest, body: Record<string, unknown>, auth: NonNullable<Awaited<ReturnType<typeof getAuthInfo>>>) {
  const result = await validateRequestBody(
    new NextRequest(request.url, { body: JSON.stringify(body), method: 'POST' }),
    calculateCededSchema
  );
  if ('error' in result) return result.error;

  const { claimId, claimAmount } = result.data;

  // Get the claim to find its policy
  const claim = await db.parametricClaim.findFirst({ where: { id: claimId, isDeleted: 0 } });
  if (!claim) return Errors.notFound('Claim');

  // Find applicable treaty
  const treaty = await db.reinsuranceTreaty.findFirst({
    where: { isDeleted: 0 },
    orderBy: { retentionAmount: 'desc' },
  });

  if (!treaty) {
    return NextResponse.json({
      claimId,
      claimAmount,
      cededAmount: 0,
      retainedAmount: claimAmount,
      message: 'No reinsurance treaty applicable',
    });
  }

  const retentionAmount = Number(treaty.retentionAmount || 0);
  const cessionPct = Number(treaty.cessionPct || 0) / 100;

  // Calculate ceded amount
  let cededAmount = 0;
  if (claimAmount > retentionAmount) {
    cededAmount = (claimAmount - retentionAmount) * cessionPct;
  }

  const retainedAmount = claimAmount - cededAmount;

  // Get policy for the ceded record
  const policy = await db.parametricPolicy.findFirst({ where: { id: claim.policyId, isDeleted: 0 } });

  // Create ceded record
  if (policy) {
    await db.parametricReinsuranceCeded.create({
      data: {
        parametricPolicyId: claim.policyId,
        treatyId: treaty.id,
        grossPremium: Number(policy.finalPremium || 0),
        cededPremium: cededAmount,
        netPremium: Number(policy.finalPremium || 0) - cededAmount,
        version: 1,
      },
    });
  }

  await logAction({
    entityType: 'ParametricReinsuranceCeded',
    entityId: 0,
    action: 'CALCULATE_CEDED',
    actorId: auth.userIdNum,
    actorType: auth.role,
    metadata: { claimId, claimAmount, cededAmount, retainedAmount, treatyId: treaty.id },
    ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
  });

  return NextResponse.json({
    claimId,
    claimAmount,
    cededAmount: Math.round(cededAmount * 100) / 100,
    retainedAmount: Math.round(retainedAmount * 100) / 100,
    treatyId: treaty.id,
    cessionRate: Number(treaty.cessionPct || 0),
    retentionAmount,
  });
}

async function trackReinsuranceClaim(request: NextRequest, body: Record<string, unknown>, auth: NonNullable<Awaited<ReturnType<typeof getAuthInfo>>>) {
  const { claimId } = body as { claimId: number };

  const claim = await db.parametricClaim.findFirst({ where: { id: claimId, isDeleted: 0 } });
  if (!claim) return Errors.notFound('Claim');

  // Update ceded record - no status field, just update timestamp
  await db.parametricReinsuranceCeded.updateMany({
    where: { parametricPolicyId: claim.policyId },
    data: { updatedAt: new Date() },
  });

  await logAction({
    entityType: 'ParametricReinsuranceCeded',
    entityId: claimId,
    action: 'TRACK_REINSURANCE_CLAIM',
    actorId: auth.userIdNum,
    actorType: auth.role,
    metadata: { claimId, claimNumber: claim.claimNumber },
    ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
  });

  return NextResponse.json({
    message: 'Reinsurance claim tracking updated',
    claimId,
    status: 'TRACKED',
  });
}

