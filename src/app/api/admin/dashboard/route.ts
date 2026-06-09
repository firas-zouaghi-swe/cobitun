import { NextRequest, NextResponse } from 'next/server';
import { requireRole, Roles } from '@/lib/services/authorization';
import { db } from '@/lib/db';
import { FraudDetector } from '@/lib/fraud-detector';

export async function GET(request: NextRequest) {
  const authOrResp = await requireRole(request, Roles.ADMIN);
  if ((authOrResp as any).status) return authOrResp as NextResponse;
  try {
    // ==================== TRADITIONAL INSURANCE STATS ====================
    const totalUsers = await db.user.count({ where: { isDeleted: 0 } });
    const totalPolicies = await db.policy.count();
    const totalCategories = await db.category.count({ where: { isDeleted: 0 } });
    const totalQuestions = await db.customerQuestion.count({ where: { isDeleted: 0 } });
    const approvedHolders = await db.policyRecord.count({ where: { status: 'Approved' } });
    const pendingHolders = await db.policyRecord.count({ where: { status: 'Pending' } });
    const disapprovedHolders = await db.policyRecord.count({ where: { status: 'Disapproved' } });
    const totalPolicyHolders = await db.policyRecord.count();

    // ==================== PARAMETRIC INSURANCE STATS ====================
    const totalProviders = await db.cloudProvider.count({ where: { isDeleted: 0 } });
    const activeProviders = await db.cloudProvider.count({ where: { isActive: 1, isDeleted: 0 } });

    // Outage events
    const totalOutageEvents = await db.outageEvent.count({ where: { isDeleted: 0 } });
    const unprocessedOutages = await db.outageEvent.count({ where: { processed: 0, isDeleted: 0 } });

    // Merged incidents
    const totalMergedIncidents = await db.mergedIncident.count({ where: { isDeleted: 0 } });

    // Trigger events
    const totalTriggerEvents = await db.triggerEvent.count({ where: { isDeleted: 0 } });
    const recentTriggers = await db.triggerEvent.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
        isDeleted: 0,
      },
    });

    // Look up status IDs for parametric policy counts
    const pendingStatus = await db.enumParamPolicyStatus.findFirst({
      where: { statusCode: 'PENDING', isCurrent: 1 },
      select: { id: true },
    });
    const approvedStatus = await db.enumParamPolicyStatus.findFirst({
      where: { statusCode: 'APPROVED', isCurrent: 1 },
      select: { id: true },
    });

    // Parametric policies — use statusId FK
    const parametricPoliciesTotal = await db.parametricPolicy.count({ where: { isDeleted: 0 } });
    const parametricPoliciesApproved = approvedStatus
      ? await db.parametricPolicy.count({ where: { statusId: approvedStatus.id, isDeleted: 0 } })
      : 0;
    const parametricPoliciesPending = pendingStatus
      ? await db.parametricPolicy.count({ where: { statusId: pendingStatus.id, isDeleted: 0 } })
      : 0;

    // Look up status IDs for parametric claim counts
    const detectedStatus = await db.enumParamClaimStatus.findFirst({
      where: { statusCode: 'DETECTED', isCurrent: 1 },
      select: { id: true },
    });
    const paidStatus = await db.enumParamClaimStatus.findFirst({
      where: { statusCode: 'PAID', isCurrent: 1 },
      select: { id: true },
    });
    const disputedStatus = await db.enumParamClaimStatus.findFirst({
      where: { statusCode: 'DISPUTED', isCurrent: 1 },
      select: { id: true },
    });

    // Parametric claims — use statusId FK
    const parametricClaimsTotal = await db.parametricClaim.count({ where: { isDeleted: 0 } });
    const parametricClaimsDetected = detectedStatus
      ? await db.parametricClaim.count({ where: { statusId: detectedStatus.id, isDeleted: 0 } })
      : 0;
    const parametricClaimsPaid = paidStatus
      ? await db.parametricClaim.count({ where: { statusId: paidStatus.id, isDeleted: 0 } })
      : 0;
    const parametricClaimsDisputed = disputedStatus
      ? await db.parametricClaim.count({ where: { statusId: disputedStatus.id, isDeleted: 0 } })
      : 0;

    // Real financial aggregates from DB — use statusId
    const totalPayoutsAgg = paidStatus
      ? await db.parametricClaim.aggregate({
          where: { statusId: paidStatus.id, isDeleted: 0 },
          _sum: { payoutAmount: true },
        })
      : { _sum: { payoutAmount: null } };
    const totalPayoutsTnd = Number(totalPayoutsAgg._sum.payoutAmount ?? 0);

    const totalPremiumAgg = approvedStatus
      ? await db.parametricPolicy.aggregate({
          where: { statusId: approvedStatus.id, isDeleted: 0 },
          _sum: { commercialPremium: true },
        })
      : { _sum: { commercialPremium: null } };
    const totalPremiumTnd = Number(totalPremiumAgg._sum.commercialPremium ?? 0);

    // Fraud Detection Stats
    const detector = new FraudDetector(db);
    const fraudStats = await detector.getStats();

    return NextResponse.json({
      // Traditional
      totalUsers,
      totalPolicies,
      totalCategories,
      totalQuestions,
      totalPolicyHolders,
      approvedHolders,
      disapprovedHolders,
      pendingHolders,
      // Parametric
      activeProviders,
      totalProviders,
      totalOutageEvents,
      unprocessedOutages,
      totalMergedIncidents,
      totalTriggerEvents,
      recentTriggers,
      parametricPoliciesTotal,
      parametricPoliciesApproved,
      parametricPoliciesPending,
      parametricClaimsTotal,
      parametricClaimsDetected,
      parametricClaimsPaid,
      parametricClaimsDisputed,
      totalPayoutsTnd,
      totalPremiumTnd,
      // Fraud Detection
      totalChecked: fraudStats.totalChecked,
      fakeDetected: fraudStats.fakeDetected,
      needsReview: fraudStats.needsReview,
      avgRiskScore: fraudStats.avgRiskScore,
      suspiciousIps: fraudStats.suspiciousIps,
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


