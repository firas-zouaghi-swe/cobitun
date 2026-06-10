
/**
 * Customer Claims API
 * GET - List customer claims (with status filtering)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { db } from '@/lib/db';
import { Errors } from '@/middleware/validation';

export async function GET(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'CUSTOMER') return Errors.forbidden();

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');

    const where: Record<string, unknown> = {
      customerId: auth.customerId,
      isDeleted: 0,
    };

    if (status) {
      const statusRecord = await db.enumParamClaimStatus.findFirst({
        where: { statusCode: status.toUpperCase(), isCurrent: 1 },
        select: { id: true },
      });
      if (statusRecord) where.statusId = statusRecord.id;
    }

    const claims = await db.parametricClaim.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        claimNumber: true,
        payoutAmount: true,
        outageDurationHours: true,
        createdAt: true,
        policyId: true,
        status: {
          select: { statusCode: true, statusName: true },
        },
        policy: {
          select: { cloudProvider: { select: { organisationName: true } } },
        },
      },
    });

    return NextResponse.json({
      claims: claims.map((c) => ({
        id: c.id,
        claimNumber: c.claimNumber,
        payoutAmount: c.payoutAmount,
        outageDurationHours: c.outageDurationHours,
        createdAt: c.createdAt.toISOString(),
        policyId: c.policyId,
        statusCode: c.status?.statusCode ?? null,
        statusName: c.status?.statusName ?? null,
        providerName: c.policy?.cloudProvider?.organisationName || 'Unknown',
      })),
    });
  } catch (error) {
    return Errors.internal();
  }
}

