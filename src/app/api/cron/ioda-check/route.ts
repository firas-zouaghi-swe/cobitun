import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { processProvider } from '@/lib/parametric-engine';

/**
 * Cron endpoint for periodic IODA polling
 * v3: processProvider() from parametric-engine.ts has been updated; ensure it's called correctly
 * The processProvider now accepts a providerId (Int) and handles slaTierId FK internally
 */
export async function POST(request: Request) {
  try {
    // Verify cron secret if provided
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // v3: CloudProvider uses slaTierId (FK), isActive is Int
    const activeProviders = await db.cloudProvider.findMany({
      where: { isActive: 1, isDeleted: 0 },
    });

    let totalTriggers = 0;
    let totalClaims = 0;
    const results: Array<{ provider: string; asn: string; triggers: number; claims: number; error?: string }> = [];

    for (const provider of activeProviders) {
      try {
        // v3: processProvider accepts providerId (Int) — same call signature
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
      message: 'IODA cron check completed',
      timestamp: new Date().toISOString(),
      totalTriggers,
      totalClaims,
      providersProcessed: activeProviders.length,
      results,
    });
  } catch (error) {
    console.error('Cron IODA check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'IODA cron endpoint is active',
    hint: 'Send POST request to trigger IODA check for all active providers',
    schedule: 'Recommended: every 5 minutes via external scheduler',
  });
}

