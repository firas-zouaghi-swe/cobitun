
/**
 * Duplicate Claim Detection API
 * GET - Check for duplicate/similar claims
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { db } from '@/lib/db';
import { Errors } from '@/middleware/validation';

export async function GET(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  try {
    const url = new URL(request.url);
    const claimId = parseInt(url.searchParams.get('claimId') || '0', 10);
    const policyId = parseInt(url.searchParams.get('policyId') || '0', 10);
    const providerName = url.searchParams.get('providerName');

    if (!claimId && !policyId) {
      return NextResponse.json({ error: 'claimId or policyId required' }, { status: 400 });
    }

    let targetClaim: Record<string, unknown> | null = null;

    if (claimId) {
      targetClaim = await db.parametricClaim.findFirst({
        where: { id: claimId, isDeleted: 0 },
        include: {
          status: true,
          policy: { include: { cloudProvider: true } },
          triggerEvent: { include: { mergedIncident: true } },
        },
      }) as Record<string, unknown> | null;
    }

    // Find similar claims based on policy, provider, and outage time window
    const where: Record<string, unknown> = { isDeleted: 0 };

    if (policyId) {
      where.policyId = policyId;
    } else if (targetClaim) {
      where.policyId = (targetClaim as any).policyId;
    }

    if (providerName) {
      where.policy = { cloudProvider: { organisationName: providerName } };
    } else if (targetClaim) {
      const targetProviderName = (targetClaim as any).policy?.cloudProvider?.organisationName;
      if (targetProviderName) {
        where.policy = { cloudProvider: { organisationName: targetProviderName } };
      }
    }

    // Exclude the claim itself
    if (claimId) {
      where.id = { not: claimId };
    }

    const similarClaims = await db.parametricClaim.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        status: { select: { statusCode: true, statusName: true } },
        customer: { select: { id: true, companyName: true } },
        policy: { include: { cloudProvider: true } },
        triggerEvent: { include: { mergedIncident: true } },
      },
    });

    // Score similarity based on time overlap
    const scored = similarClaims.map((claim) => {
      let similarityScore = 0;
      const reasons: string[] = [];

      if (targetClaim) {
        // Same policy
        if (claim.policyId === (targetClaim as any).policyId) {
          similarityScore += 30;
          reasons.push('Same policy');
        }

        // Same provider
        const targetProviderName = (targetClaim as any).policy?.cloudProvider?.organisationName;
        if (targetProviderName && claim.policy?.cloudProvider?.organisationName === targetProviderName) {
          similarityScore += 25;
          reasons.push('Same provider');
        }

        // Overlapping outage window (within 24h)
        const targetIncidentStart = (targetClaim as any).triggerEvent?.mergedIncident?.incidentStart;
        const claimIncidentStart = claim.triggerEvent?.mergedIncident?.incidentStart;
        if (claimIncidentStart && targetIncidentStart) {
          const timeDiff = Math.abs(
            new Date(claimIncidentStart).getTime() - new Date(targetIncidentStart).getTime()
          );
          if (timeDiff < 24 * 60 * 60 * 1000) {
            similarityScore += 35;
            reasons.push('Outage within 24h window');
          } else if (timeDiff < 72 * 60 * 60 * 1000) {
            similarityScore += 15;
            reasons.push('Outage within 72h window');
          }
        }

        // Same customer
        if (claim.customerId === (targetClaim as any).customerId) {
          similarityScore += 10;
          reasons.push('Same customer');
        }
      } else {
        // No target claim - just flag multiple claims on same policy/provider
        similarityScore = 50;
        reasons.push('Multiple claims for same policy/provider');
      }

      return {
        id: claim.id,
        claimNumber: claim.claimNumber,
        status: claim.status?.statusCode,
        providerName: claim.policy?.cloudProvider?.organisationName ?? null,
        outageStartTime: claim.triggerEvent?.mergedIncident?.incidentStart?.toISOString() ?? null,
        outageEndTime: claim.triggerEvent?.mergedIncident?.incidentEnd?.toISOString() ?? null,
        customer: claim.customer ? { id: claim.customer.id, companyName: claim.customer.companyName } : null,
        similarityScore,
        reasons,
        isDuplicate: similarityScore >= 70,
      };
    });

    // Sort by similarity score
    scored.sort((a, b) => b.similarityScore - a.similarityScore);

    const duplicates = scored.filter((s) => s.isDuplicate);

    return NextResponse.json({
      targetClaimId: claimId || null,
      similarClaims: scored,
      duplicateCount: duplicates.length,
      hasDuplicates: duplicates.length > 0,
    });
  } catch (error) {
    console.error('Failed to detect duplicate claims', error);
    return Errors.internal();
  }
}

