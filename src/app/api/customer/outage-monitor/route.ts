import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthInfo, verifyCustomerOwnership, AuthInfo } from '@/lib/services/auth-helper';
import { requireAuth } from '@/lib/services/authorization';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerIdParam = searchParams.get('customerId');

    const parsedCustomerId = customerIdParam ? parseInt(customerIdParam, 10) : undefined;

    const authOrResp = await requireAuth(request);
    if ((authOrResp as any).status) return authOrResp as NextResponse;
    const auth = authOrResp as AuthInfo;

    const effectiveCustomerId = await verifyCustomerOwnership(auth, parsedCustomerId);
    if (!effectiveCustomerId) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    // v3: Look up APPROVED status ID
    const approvedStatus = await db.enumParamPolicyStatus.findFirst({
      where: { statusCode: 'APPROVED', isCurrent: 1 },
      select: { id: true },
    });

    if (!approvedStatus) {
      return NextResponse.json({ outages: [], triggers: [] });
    }

    // Get customer's active parametric policies
    const policies = await db.parametricPolicy.findMany({
      where: { customerId: effectiveCustomerId, statusId: approvedStatus.id, isDeleted: 0 },
      select: { cloudProviderId: true },
    });

    const providerIds = policies.map((p) => p.cloudProviderId);

    if (providerIds.length === 0) {
      return NextResponse.json({ outages: [], triggers: [] });
    }

    // Get recent outages (last 7 days) for customer's insured providers
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const outages = await db.outageEvent.findMany({
      where: {
        cloudProviderId: { in: providerIds },
        eventStart: { gte: sevenDaysAgo },
        isDeleted: 0,
      },
      include: {
        cloudProvider: {
          include: { slaTier: { select: { tierCode: true, tierName: true, mttrHours: true, thresholdHours: true } } },
        },
      },
      orderBy: { eventStart: 'desc' },
    });

    // v3: TriggerEvent has slaTierId (FK) — include SLA tier details
    const triggers = await db.triggerEvent.findMany({
      where: {
        cloudProviderId: { in: providerIds },
        isDeleted: 0,
      },
      include: {
        cloudProvider: { select: { organisationName: true } },
        slaTier: { select: { tierCode: true, tierName: true, mttrHours: true, thresholdHours: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({ outages, triggers });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

