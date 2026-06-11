import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const providerCount = await db.cloudProvider.count({ where: { isActive: 1, isDeleted: 0 } });
    const unprocessedOutages = await db.outageEvent.count({ where: { processed: 0, isDeleted: 0 } });
    const totalClaims = await db.workflowClaim.count({
      where: { isDeleted: 0, declarationOfLossPdfUrl: { not: null } },
    });

    const paidStatus = await db.enumParamClaimStatus.findFirst({
      where: { statusCode: 'PAID', isCurrent: 1 },
      select: { id: true },
    });

    const totalPayoutsAgg = paidStatus
      ? await db.parametricClaim.aggregate({
          where: { statusId: paidStatus.id, isDeleted: 0 },
          _sum: { payoutAmount: true },
        })
      : { _sum: { payoutAmount: null } };

    const totalPayouts = totalPayoutsAgg._sum.payoutAmount || 0;

    return NextResponse.json({
      providerCount,
      unprocessedOutages,
      totalPayouts,
      totalClaims,
    });
  } catch (error) {
    console.error('Homepage summary error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
