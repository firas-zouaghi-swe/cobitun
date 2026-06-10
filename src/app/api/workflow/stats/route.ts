import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole, Roles } from '@/lib/services/authorization';

/**
 * GET /api/workflow/stats
 * Returns state counts for policy applications and claims.
 * Cross-cutting requirement X-08.
 */
export async function GET(request: NextRequest) {
  try {
    const authOrResp = await requireRole(request, Roles.ADMIN);
    if ((authOrResp as any).status) return authOrResp as NextResponse;

    // Get all policy applications (non-deleted) grouped by status
    const policyApps = await db.workflowPolicyApplication.findMany({
      where: { isDeleted: 0 },
      include: { status: { select: { statusCode: true, statusName: true } } },
    });

    const policyCounts: Record<string, number> = {};
    for (const app of policyApps) {
      const code = app.status?.statusCode ?? 'UNKNOWN';
      policyCounts[code] = (policyCounts[code] ?? 0) + 1;
    }

    // Get all workflow claims (non-deleted) grouped by status
    const claims = await db.workflowClaim.findMany({
      where: { isDeleted: 0 },
      include: { status: { select: { statusCode: true, statusName: true } } },
    });

    const claimCounts: Record<string, number> = {};
    for (const claim of claims) {
      const code = claim.status?.statusCode ?? 'UNKNOWN';
      claimCounts[code] = (claimCounts[code] ?? 0) + 1;
    }

    return NextResponse.json({
      policyApplications: policyCounts,
      claims: claimCounts,
      totals: {
        policyApplications: policyApps.length,
        claims: claims.length,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
