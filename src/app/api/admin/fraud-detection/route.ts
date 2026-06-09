// (Removed duplicated placeholder handlers; the full implementation follows below.)

/**
 * Fraud Detection API for Admin Panel
 * GET  - List flagged accounts with scores, verdicts, recommendations
 * POST - Scan all users or a specific user
 * POST /action - Take admin actions on flagged accounts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { db } from '@/lib/db';
import { Errors, errorResponse, validateRequestBody } from '@/middleware/validation';
import { z } from 'zod';
import { logAction } from '@/lib/services/audit-service';
import { Roles } from '@/lib/services/authorization';

const flagClaimSchema = z.object({
  claimId: z.number().int().positive(),
  reason: z.string().min(1).max(500),
  riskFactors: z.array(z.string()).optional(),
  manualReviewRequired: z.boolean().default(true),
});

const getRecommendation = (score: number): string => {
  if (score >= 80) return 'STRONG DELETE — Highly suspicious, immediate deletion recommended';
  if (score >= 60) return 'DELETE — High confidence fake, consider deletion';
  if (score >= 45) return 'REVIEW — Suspicious, manual verification needed';
  if (score >= 30) return 'MONITOR — Some risk, monitor activity';
  return 'LEGITIMATE — No action needed';
};

interface FraudRiskScore {
  claimId: number;
  riskScore: number; // 0-100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  factors: { name: string; weight: number; description: string }[];
  recommendation: string;
  requiresManualReview: boolean;
}

/**
 * Calculate fraud risk score for a claim
 * This is a placeholder for AI/ML scoring - uses rule-based heuristics
 */
async function calculateFraudRiskScore(claimId: number): Promise<FraudRiskScore> {
  const claim = await db.parametricClaim.findFirst({
    where: { id: claimId, isDeleted: 0 },
    include: {
      customer: { include: { user: true } },
      status: { select: { statusCode: true } },
    },
  });

  if (!claim) {
    throw new Error('Claim not found');
  }

  let riskScore = 0;
  const factors: { name: string; weight: number; description: string }[] = [];

  // Factor 1: Multiple claims from same customer in short period
  const recentClaims = await db.parametricClaim.count({
    where: {
      customerId: claim.customerId,
      isDeleted: 0,
      createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    },
  });

  if (recentClaims > 3) {
    riskScore += 25;
    factors.push({ name: 'frequent_claims', weight: 25, description: `${recentClaims} claims in last 90 days` });
  } else if (recentClaims > 1) {
    riskScore += 10;
    factors.push({ name: 'multiple_claims', weight: 10, description: `${recentClaims} claims in last 90 days` });
  }

  // Factor 2: High claim amount relative to premium
  const policy = await db.parametricPolicy.findFirst({
    where: { id: claim.policyId, isDeleted: 0 },
  });

  if (policy && Number(claim.payoutAmount) > Number(policy.finalPremium) * 5) {
    riskScore += 20;
    factors.push({ name: 'high_claim_ratio', weight: 20, description: 'Claim amount exceeds 5x premium' });
  } else if (policy && Number(claim.payoutAmount) > Number(policy.finalPremium) * 2) {
    riskScore += 10;
    factors.push({ name: 'elevated_claim_ratio', weight: 10, description: 'Claim amount exceeds 2x premium' });
  }

  // Factor 3: Claim filed very soon after policy start
  if (policy && policy.effectiveDate && claim.createdAt) {
    const daysSinceStart = (claim.createdAt.getTime() - new Date(policy.effectiveDate).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceStart < 7) {
      riskScore += 20;
      factors.push({ name: 'early_claim', weight: 20, description: `Claim filed ${Math.floor(daysSinceStart)} days after policy start` });
    } else if (daysSinceStart < 30) {
      riskScore += 10;
      factors.push({ name: 'quick_claim', weight: 10, description: `Claim filed ${Math.floor(daysSinceStart)} days after policy start` });
    }
  }

  // Factor 4: Duplicate/similar claims
  const similarClaims = await db.parametricClaim.count({
    where: {
      customerId: claim.customerId,
      isDeleted: 0,
      policyId: claim.policyId,
      id: { not: claimId },
      createdAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
    },
  });

  if (similarClaims > 0) {
    riskScore += 15;
    factors.push({ name: 'similar_claims', weight: 15, description: `${similarClaims} similar claims from same customer` });
  }

  // Factor 5: New customer (less than 30 days)
  if (claim.customer?.user?.createdAt) {
    const customerAge = (Date.now() - new Date(claim.customer.user.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (customerAge < 30) {
      riskScore += 10;
      factors.push({ name: 'new_customer', weight: 10, description: `Customer registered ${Math.floor(customerAge)} days ago` });
    }
  }

  // Cap at 100
  riskScore = Math.min(100, riskScore);

  let riskLevel: FraudRiskScore['riskLevel'];
  let recommendation: string;
  let requiresManualReview: boolean;

  if (riskScore >= 70) {
    riskLevel = 'CRITICAL';
    recommendation = 'Immediate manual review required. Consider holding payout pending investigation.';
    requiresManualReview = true;
  } else if (riskScore >= 50) {
    riskLevel = 'HIGH';
    recommendation = 'Manual review recommended before approval.';
    requiresManualReview = true;
  } else if (riskScore >= 30) {
    riskLevel = 'MEDIUM';
    recommendation = 'Proceed with standard review. Flag for enhanced monitoring.';
    requiresManualReview = false;
  } else {
    riskLevel = 'LOW';
    recommendation = 'Low risk. Proceed with standard processing.';
    requiresManualReview = false;
  }

  return {
    claimId,
    riskScore,
    riskLevel,
    factors,
    recommendation,
    requiresManualReview,
  };
}

export async function GET(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== Roles.ADMIN && auth.role !== Roles.SUPER_ADMIN) return Errors.forbidden();

  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const filter = url.searchParams.get('filter') || 'all';
    const search = url.searchParams.get('search') || '';

    // Calculate pagination
    const offset = (page - 1) * limit;
    
    // Build where clause based on filter
    let fraudWhere: any = {};
    if (filter !== 'all') {
      fraudWhere.verdict = filter.toUpperCase();
    }

    // Build search conditions
    let searchWhere: any = {};
    if (search) {
      searchWhere = {
        OR: [
          { user: { username: { contains: search, mode: 'insensitive' } } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
          { user: { firstName: { contains: search, mode: 'insensitive' } } },
          { user: { lastName: { contains: search, mode: 'insensitive' } } },
          { companyName: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    // Only customers are real user accounts in this app.
    const baseWhere: any = {
      isDeleted: 0,
      user: { isDeleted: 0 },
      ...searchWhere,
    };
    const includeFraudResults = filter !== 'all';

    // Get customers with their latest fraud results via the linked user account.
    let customers: any[] = [];
    try {
      const whereClause = includeFraudResults
        ? { ...baseWhere, user: { ...baseWhere.user, fraudResults: { some: fraudWhere } } }
        : baseWhere;

      customers = await db.customer.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              firstName: true,
              lastName: true,
              createdAt: true,
              fraudResults: includeFraudResults
                ? { where: fraudWhere, orderBy: { createdAt: 'desc' }, take: 1 }
                : { orderBy: { createdAt: 'desc' }, take: 1 },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      });
    } catch (dbError) {
      console.error('Database query error:', dbError);
      customers = [];
    }

    // Get total count for pagination
    let total = 0;
    try {
      const countWhere = includeFraudResults
        ? { ...baseWhere, user: { ...baseWhere.user, fraudResults: { some: fraudWhere } } }
        : baseWhere;
      total = await db.customer.count({ where: countWhere });
    } catch (countErr) {
      console.error('Total count query failed:', countErr);
      total = 0;
    }

    // Get stats
    let stats = {
      totalChecked: 0,
      fakeDetected: 0,
      needsReview: 0,
      avgRiskScore: 0,
      suspiciousIps: 0,
    };
    try {
      const mod = await import('@/lib/fraud-detector');
      const FraudDetectorCtor = mod.FraudDetector;
      stats = await new FraudDetectorCtor(db).getStats();
    } catch (statsError) {
      console.error('Stats query / FraudDetector load error:', statsError);
      // Use default stats instead of failing
    }

    // Format response
    const responseUsers = customers
      .filter((customer: any) => customer.user)
      .map((customer: any) => {
        const user = customer.user;
        const fraudResult = (user.fraudResults || [])[0] || {};
        return {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          companyName: customer.companyName,
          fraudScore: fraudResult.finalScore || 0,
          ruleScore: fraudResult.ruleScore || 0,
          llmScore: fraudResult.llmScore || 0,
          verdict: fraudResult.verdict || 'LEGITIMATE',
          riskFlags: fraudResult.ruleFlags ? JSON.parse(fraudResult.ruleFlags) : [],
          llmReasoning: fraudResult.llmReasoning || '',
          scannedAt: fraudResult.createdAt || null,
          adminAction: fraudResult.humanLabel || undefined,
          adminRecommendation: getRecommendation(fraudResult.finalScore || 0),
          createdAt: user.createdAt || new Date().toISOString(),
        };
      });

    const response = {
      users: responseUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Failed to fetch fraud detection data:', error);
    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json(
        { error: 'Internal server error', message: error?.message ?? String(error), stack: error?.stack ?? null },
        { status: 500 }
      );
    }
    return Errors.internal();
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== Roles.ADMIN && auth.role !== Roles.SUPER_ADMIN) return Errors.forbidden();

  try {
    const body = await request.json();
    const action = body.action;
    
    if (action === 'scan-all' || action === 'scan-user') {
      try {
        const mod = await import('@/lib/fraud-detector');
        const detector = new mod.FraudDetector(db);

        if (action === 'scan-all') {
          // Scan all unscanned users in batches
          const { scanned, fakes, reviews } = await detector.scanAllUnscanned(10);
        
        await logAction({
          entityType: 'System',
          entityId: 0,
          action: 'BATCH_SCAN',
          actorId: auth.userIdNum,
          actorType: auth.role,
          metadata: { scanned, fakes, reviews },
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        });

        return NextResponse.json({
          message: `Scanned ${scanned} users. Found ${fakes} fakes and ${reviews} reviews.`,
          scanned,
          fakes,
          reviews,
        });
        } else if (action === 'scan-user' && body.userId) {
        // Scan a specific user
        const user = await db.user.findUnique({
          where: { id: body.userId },
          include: { customer: true },
        });

        if (!user || !user.customer) {
          return errorResponse('User not found', 'NOT_FOUND', 404);
        }

        const result = await detector.detect({
          user,
          customer: user.customer,
          ip: user.lastLoginIp || '0.0.0.0',
          userAgent: 'manual_admin_scan',
        });

        await logAction({
          entityType: 'User',
          entityId: user.id,
          action: 'MANUAL_SCAN',
          actorId: auth.userIdNum,
          actorType: auth.role,
          metadata: { verdict: result.verdict, score: result.finalScore },
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        });

        return NextResponse.json({
          message: 'User scanned successfully',
          userId: user.id,
          verdict: result.verdict,
          score: result.finalScore,
        });
        }
      } catch (detectorLoadErr) {
        console.error('FraudDetector load/scan error:', detectorLoadErr);
        return Errors.internal('Fraud detector unavailable');
      }
    } else {
      // Legacy claim flagging functionality
      const result = await validateRequestBody(request, flagClaimSchema);
      if ('error' in result) return result.error;

      const { claimId, reason, riskFactors, manualReviewRequired } = result.data;

      const claim = await db.parametricClaim.findFirst({
        where: { id: claimId, isDeleted: 0 },
        include: { customer: { select: { userId: true } } },
      });

      if (!claim) return Errors.notFound('Claim');

      // Create fraud detection result with manual flag - requires userId, not claimId
      await db.fraudDetectionResult.create({
        data: {
          userId: claim.customer.userId,
          ruleScore: 100,
          ruleFlags: JSON.stringify(riskFactors || ['manual_flag']),
          llmScore: 0,
          finalScore: 100,
          verdict: 'REVIEW',
          modelUsed: 'manual-flag',
          latencyMs: 0,
        },
      });

      // If manual review required, update claim status
      if (manualReviewRequired) {
        const underReviewStatus = await db.enumParamClaimStatus.findFirst({
          where: { statusCode: 'UNDER_REVIEW', isCurrent: 1 },
        });

        if (underReviewStatus) {
          await db.parametricClaim.updateMany({
            where: { id: claimId, version: claim.version },
            data: {
              statusId: underReviewStatus.id,
              reviewNotes: `FRAUD FLAG: ${reason}`,
              updatedAt: new Date(),
            },
          });
        }
      }

      await logAction({
        entityType: 'ParametricClaim',
        entityId: claimId,
        action: 'FLAG_FRAUD',
        actorId: auth.userIdNum,
        actorType: auth.role,
        metadata: { reason, riskFactors, manualReviewRequired },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      });

      return NextResponse.json({
        message: 'Claim flagged for fraud review',
        claimId,
        manualReviewRequired,
      });
    }
  } catch (error: any) {
    console.error('Failed to process fraud scan:', error);
    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json(
        { error: 'Internal server error', message: error?.message ?? String(error), stack: error?.stack ?? null },
        { status: 500 }
      );
    }
    return Errors.internal();
  }
}

