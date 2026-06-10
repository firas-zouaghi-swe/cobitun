import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthInfo, verifyCustomerOwnership, AuthInfo } from '@/lib/services/auth-helper';
import { requireAuth } from '@/lib/services/authorization';

function safeJsonParse(str: string | null, fallback: any = null) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

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

    // v3: statusId ? join EnumCyberPolicyStatus
    // Include renewal info (isRenewal, parentPolicyId, renewalCount)
    const policies = await db.cyberPolicy.findMany({
      where: { customerId: effectiveCustomerId, isDeleted: 0 },
      include: {
        product: {
          include: {
            category: true,
            coverageGrants: { where: { isActive: 1, isDeleted: 0 }, orderBy: { coverageCode: 'asc' } },
            exclusions: { where: { isActive: 1, isDeleted: 0 }, orderBy: { exclusionCode: 'asc' } },
          },
        },
        application: {
          include: {
            securityPosture: { select: { postureCode: true, postureName: true, riskMultiplier: true } },
            status: { select: { statusCode: true, statusName: true } },
          },
        },
        status: { select: { id: true, statusCode: true, statusName: true, isTerminal: true, allowsClaims: true } },
        claims: {
          where: { isDeleted: 0 },
          include: {
            incidentType: { select: { typeCode: true, typeName: true } },
            status: { select: { statusCode: true, statusName: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        parentPolicy: { select: { id: true, policyNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Parse JSON fields for easier consumption
    const parsed = policies.map((policy) => ({
      ...policy,
      selectedCoverages: safeJsonParse(policy.selectedCoveragesJson, []),
      endorsements: safeJsonParse(policy.endorsementsJson, []),
      exclusions: safeJsonParse(policy.exclusionsJson, []),
      product: {
        ...policy.product,
        coverageGrants: policy.product.coverageGrants.map((cg) => ({
          ...cg,
          exclusions: safeJsonParse(cg.exclusionsJson, []),
        })),
      },
      // v3: Include renewal info
      isRenewal: policy.isRenewal === 1,
      parentPolicyId: policy.parentPolicyId,
      renewalCount: policy.renewalCount,
      parentPolicyNumber: policy.parentPolicy?.policyNumber || null,
      // Status from enum table
      statusCode: policy.status?.statusCode || null,
      statusName: policy.status?.statusName || null,
    }));

    return NextResponse.json({ policies: parsed });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

