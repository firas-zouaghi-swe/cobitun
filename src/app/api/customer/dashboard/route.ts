import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthInfo, verifyCustomerOwnership, AuthInfo } from '@/lib/services/auth-helper';
import { requireAuth } from '@/lib/services/authorization';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerIdStr = searchParams.get('customerId');
    const isCustomerIdMissing = customerIdStr === null || customerIdStr === 'undefined' || customerIdStr === 'null';
    const requestedCustomerId = !isCustomerIdMissing && customerIdStr ? parseInt(customerIdStr, 10) : undefined;

    if (!isCustomerIdMissing && customerIdStr && isNaN(requestedCustomerId as number)) {
      return NextResponse.json({ error: 'Invalid Customer ID' }, { status: 400 });
    }

    const authOrResp = await requireAuth(request);
    if ((authOrResp as any).status) return authOrResp as NextResponse;
    const auth = authOrResp as AuthInfo;

    const effectiveCustomerId = await verifyCustomerOwnership(auth, requestedCustomerId);
    if (!effectiveCustomerId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const customer = await db.customer.findUnique({
      where: { id: effectiveCustomerId },
      include: { user: true, sector: true, businessModel: true },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const customerId = customer.id;

    // Legacy insurance stats
    const availablePolicies = await db.policy.count();
    const appliedPolicies = await db.policyRecord.count({
      where: { customerId: String(customerId) },
    });
    const totalCategories = await db.category.count();
    const totalQuestions = await db.customerQuestion.count({
      where: { customerId },
    });
    const approvedPolicies = await db.policyRecord.count({
      where: { customerId: String(customerId), status: 'Approved' },
    });
    const pendingPolicies = await db.policyRecord.count({
      where: { customerId: String(customerId), status: 'Pending' },
    });
    const disapprovedPolicies = await db.policyRecord.count({
      where: { customerId: String(customerId), status: 'Disapproved' },
    });

    // Look up status IDs for parametric queries
    const approvedParamStatus = await db.enumParamPolicyStatus.findFirst({
      where: { statusCode: 'APPROVED', isCurrent: 1 },
      select: { id: true },
    });
    const pendingParamStatus = await db.enumParamPolicyStatus.findFirst({
      where: { statusCode: 'PENDING', isCurrent: 1 },
      select: { id: true },
    });
    const paidClaimStatus = await db.enumParamClaimStatus.findFirst({
      where: { statusCode: 'PAID', isCurrent: 1 },
      select: { id: true },
    });

    const approvedStatusIds: number[] = [];
    if (approvedParamStatus) approvedStatusIds.push(approvedParamStatus.id);

    const pendingStatusIds: number[] = [];
    if (pendingParamStatus) pendingStatusIds.push(pendingParamStatus.id);

    // Parametric insurance stats
    const parametricPoliciesApproved = approvedParamStatus
      ? await db.parametricPolicy.count({
          where: { customerId, statusId: approvedParamStatus.id, isDeleted: 0 },
        })
      : 0;

    const parametricPoliciesTotal = await db.parametricPolicy.count({
      where: { customerId, isDeleted: 0 },
    });

    const parametricClaimsTotal = await db.parametricClaim.count({
      where: { customerId, isDeleted: 0 },
    });

    const parametricClaimsPaid = paidClaimStatus
      ? await db.parametricClaim.count({
          where: { customerId, statusId: paidClaimStatus.id, isDeleted: 0 },
        })
      : 0;

    const totalPayoutAmount = paidClaimStatus
      ? await db.parametricClaim.aggregate({
          where: { customerId, statusId: paidClaimStatus.id, isDeleted: 0 },
          _sum: { payoutAmount: true },
        })
      : { _sum: { payoutAmount: null } };

    // Active outages for customer's providers in last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const activeProviderIds = approvedParamStatus
      ? (await db.parametricPolicy.findMany({
          where: { customerId, statusId: approvedParamStatus.id, isDeleted: 0 },
          select: { cloudProviderId: true },
        })).map((p) => p.cloudProviderId)
      : [];

    const activeOutages = activeProviderIds.length > 0
      ? await db.outageEvent.count({
          where: {
            cloudProviderId: { in: activeProviderIds },
            eventStart: { gte: sevenDaysAgo },
          },
        })
      : 0;

    // Last claim info
    const lastClaim = await db.parametricClaim.findFirst({
      where: { customerId, isDeleted: 0 },
      orderBy: { createdAt: 'desc' },
      include: {
        policy: {
          include: {
            cloudProvider: { select: { organisationName: true } },
            status: { select: { statusCode: true, statusName: true } },
          },
        },
        status: { select: { statusCode: true, statusName: true } },
      },
    });

    const lastTriggerInfo = lastClaim
      ? {
          claimNumber: lastClaim.claimNumber,
          outageDurationHours: Number(lastClaim.outageDurationHours),
          payoutAmount: Number(lastClaim.payoutAmount),
          statusCode: lastClaim.status?.statusCode || null,
          statusName: lastClaim.status?.statusName || null,
          providerName: lastClaim.policy.cloudProvider.organisationName,
          date: lastClaim.createdAt,
        }
      : null;

    // Customer summary from trigger-maintained fields
    const hasParametricPolicies = parametricPoliciesTotal > 0;

    return NextResponse.json({
      // Customer profile
      customer: {
        id: customer.id,
        companyName: customer.companyName,
        sector: customer.sector ? { id: customer.sector.id, name: customer.sector.sectorName, code: customer.sector.sectorCode } : null,
        businessModel: customer.businessModel ? { id: customer.businessModel.id, name: customer.businessModel.modelName, code: customer.businessModel.modelCode } : null,
        totalPolicies: customer.totalPolicies,
        totalClaims: customer.totalClaims,
        totalPremiumPaid: Number(customer.totalPremiumPaid),
        totalPayoutsReceived: Number(customer.totalPayoutsReceived),
      },
      // Legacy insurance stats
      availablePolicies,
      appliedPolicies,
      totalCategories,
      totalQuestions,
      approvedPolicies,
      pendingPolicies,
      disapprovedPolicies,
      // Parametric stats
      parametricPoliciesApproved,
      parametricPoliciesTotal,
      parametricClaimsTotal,
      parametricClaimsPaid,
      totalPayoutAmount: totalPayoutAmount._sum.payoutAmount || 0,
      activeOutages,
      lastTriggerInfo,
      hasParametricPolicies,
    });
  } catch (error) {
    console.error('Customer dashboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

