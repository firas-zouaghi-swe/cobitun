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

    // v3: Include sector name, business model name via joins
    // statusId → join EnumParamPolicyStatus to get statusCode/statusName
    const policies = await db.parametricPolicy.findMany({
      where: { customerId: effectiveCustomerId, isDeleted: 0 },
      include: {
        cloudProvider: {
          include: { slaTier: { select: { tierCode: true, tierName: true, mttrHours: true } } },
        },
        sector: { select: { id: true, sectorCode: true, sectorName: true } },
        businessModel: { select: { id: true, modelCode: true, modelName: true } },
        turnoverBand: { select: { id: true, bandCode: true, bandName: true } },
        resilienceProfile: { select: { id: true, profileCode: true, profileName: true } },
        status: { select: { id: true, statusCode: true, statusName: true, isTerminal: true, allowsClaims: true } },
        _count: { select: { claims: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ policies });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

