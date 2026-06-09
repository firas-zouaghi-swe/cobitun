import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole, Roles } from '@/lib/services/authorization';
import { processProvider } from '@/lib/parametric-engine';

/**
 * Run IODA check for all active providers.
 * processProvider() has been updated for v3 schema — takes providerId (number).
 */
export async function POST(request: NextRequest) {
  const authOrResp = await requireRole(request, Roles.ADMIN);
  if ((authOrResp as any).status) return authOrResp as NextResponse;
  try {
    const activeProviders = await db.cloudProvider.findMany({
      where: { isActive: 1, isDeleted: 0 },
    });

    let totalTriggers = 0;
    let totalClaims = 0;
    const results: Array<{ provider: string; asn: string; triggers: number; claims: number; error?: string }> = [];

    for (const provider of activeProviders) {
      try {
        const result = await processProvider(provider.id);
        totalTriggers += result.triggers;
        totalClaims += result.claims;
        results.push({
          provider: provider.organisationName,
          asn: provider.asn,
          ...result,
        });
      } catch (error) {
        console.error(`Failed to process provider ${provider.asn}:`, error);
        results.push({
          provider: provider.organisationName,
          asn: provider.asn,
          triggers: 0,
          claims: 0,
          error: 'Processing failed',
        });
      }
    }

    return NextResponse.json({
      message: 'IODA check completed',
      totalTriggers,
      totalClaims,
      providersProcessed: activeProviders.length,
      results,
    });
  } catch (error) {
    console.error('Run IODA check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


