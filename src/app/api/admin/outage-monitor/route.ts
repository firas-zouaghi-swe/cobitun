import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole, Roles } from '@/lib/services/authorization';

export async function GET(request: NextRequest) {
  const authOrResp = await requireRole(request, Roles.ADMIN);
  if ((authOrResp as any).status) return authOrResp as NextResponse;
  try {
    const activeProviders = await db.cloudProvider.count({ where: { isActive: 1, isDeleted: 0 } });
    const unprocessedOutages = await db.outageEvent.count({ where: { processed: 0, isDeleted: 0 } });
    const totalOutageEvents = await db.outageEvent.count({ where: { isDeleted: 0 } });
    const totalTriggers = await db.triggerEvent.count({ where: { isDeleted: 0 } });
    const totalClaims = await db.workflowClaim.count({
      where: { isDeleted: 0, declarationOfLossPdfUrl: { not: null } },
    });

    // Real payouts from DB — look up PAID status
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

    // Recent triggers (last 24h)
    const recentTriggers = await db.triggerEvent.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
        isDeleted: 0,
      },
    });

    // Outage events on ASNs that have policies
    const outageEvents = await db.outageEvent.findMany({
      where: {
        isDeleted: 0,
        cloudProvider: {
          parametricPolicies: { some: { isDeleted: 0 } },
        },
      },
      include: {
        cloudProvider: {
          include: { slaTier: { select: { tierCode: true, tierName: true } } },
        },
      },
      orderBy: { eventStart: 'desc' },
      take: 50,
    });

    // Recent workflow claims with a filled declaration of loss
    const workflowClaims = await db.workflowClaim.findMany({
      where: {
        isDeleted: 0,
        declarationOfLossPdfUrl: { not: null },
      },
      include: {
        customer: { include: { user: { select: { firstName: true, lastName: true } } } },
        policyApplication: {
          select: {
            id: true,
            applicationNumber: true,
            status: { select: { statusCode: true, statusName: true } },
          },
        },
        status: { select: { statusCode: true, statusName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Recent triggers with SLA tier details
    const triggers = await db.triggerEvent.findMany({
      where: { isDeleted: 0 },
      include: {
        cloudProvider: true,
        slaTier: { select: { tierCode: true, tierName: true, mttrHours: true, thresholdHours: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Recent claims
    const recentClaims = await db.parametricClaim.findMany({
      where: { isDeleted: 0 },
      include: {
        customer: { include: { user: true } },
        policy: { include: { cloudProvider: { include: { slaTier: true } } } },
        status: { select: { statusCode: true, statusName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({
      stats: {
        activeProviders,
        unprocessedOutages,
        totalOutageEvents,
        recentTriggers,
        totalPayouts,
        totalTriggers,
        totalClaims,
      },
      outageEvents,
      triggers,
      recentClaims: workflowClaims,
    });
  } catch (error) {
    console.error('Outage monitor error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


