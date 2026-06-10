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

    // v3: statusId → join EnumParamClaimStatus
    // Include payoutCalculationJson in response
    const claims = await db.parametricClaim.findMany({
      where: { customerId: effectiveCustomerId, isDeleted: 0 },
      include: {
        policy: {
          include: {
            cloudProvider: { select: { id: true, organisationName: true } },
            sector: { select: { sectorName: true } },
            status: { select: { statusCode: true, statusName: true } },
          },
        },
        status: { select: { id: true, statusCode: true, statusName: true, allowsPayment: true, isTerminal: true } },
        reviewedByUser: { select: { id: true, firstName: true, lastName: true } },
        paidByUser: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ claims });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

