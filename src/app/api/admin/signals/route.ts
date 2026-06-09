import { NextRequest, NextResponse } from 'next/server';
import { getSignals } from '@/lib/ioda-client';
import { db } from '@/lib/db';
import { requireRole, Roles } from '@/lib/services/authorization';

// Allow up to 60 seconds for IODA signals (can be slow for multiple ASNs)
export const maxDuration = 60;

/**
 * Admin IODA Signals API
 * Fetches real-time time-series signal data from IODA for visualization.
 * No model changes in v3 — CloudProvider.asn is now String.
 */
export async function GET(request: NextRequest) {
  const authOrResp = await requireRole(request, Roles.ADMIN);
  if ((authOrResp as any).status) return authOrResp as NextResponse;
  try {
    const { searchParams } = new URL(request.url);

    const parseTimestamp = (value: string | null): number | null => {
      if (!value) return null;
      const parsed = parseInt(value, 10);
      if (Number.isNaN(parsed)) return null;
      return parsed > 1e12 ? parsed : parsed * 1000;
    };

    // Parse date range (accept seconds or milliseconds)
    const until = parseTimestamp(searchParams.get('until')) ?? Date.now();
    const from = parseTimestamp(searchParams.get('from')) ?? until - 24 * 3600 * 1000;

    const datasource = searchParams.get('datasource') || 'bgp';
    const signalType = (searchParams.get('signalType') || 'raw') as 'raw' | 'events';
    const maxPoints = Math.min(parseInt(searchParams.get('maxPoints') || '500'), 5000);

    // Parse requested ASNs or default to all active providers
    const asnsParam = searchParams.get('asns');
    let providers: { asn: string; organisationName: string }[] = [];

    if (asnsParam) {
      const asnList = asnsParam.split(',').map(String).filter(Boolean);
      providers = await db.cloudProvider.findMany({
        where: { asn: { in: asnList }, isDeleted: 0 },
        select: { asn: true, organisationName: true },
      });
    } else {
      providers = await db.cloudProvider.findMany({
        where: { isActive: 1, isDeleted: 0 },
        select: { asn: true, organisationName: true },
      });
    }

    if (providers.length === 0) {
      return NextResponse.json({ signals: [], providers: [] });
    }

    // Fetch signals for each provider in parallel (limit concurrency to 3)
    const BATCH_SIZE = 3;
    const signals: Record<string, {
      asn: string;
      providerName: string;
      datasource: string;
      from: number;
      until: number;
      step: number;
      timestamps: number[];
      values: (number | null)[];
    }> = {};

    for (let i = 0; i < providers.length; i += BATCH_SIZE) {
      const batch = providers.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (provider) => {
          const data = await getSignals('asn', Number(provider.asn), from, until, datasource, maxPoints, signalType);
          return { provider, data };
        })
      );

      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.data.length > 0) {
          const { provider, data } = result.value;
          const signal = data[0]; // Take first signal series
          const timestamps: number[] = [];
          const step = signal.step || 300;
          const numericAsn = Number(provider.asn);

          for (let j = 0; j < signal.values.length; j++) {
            timestamps.push((signal.from + j * step) * 1000);
          }

          signals[provider.asn] = {
            asn: provider.asn,
            providerName: provider.organisationName,
            datasource: signal.datasource,
            from: signal.from,
            until: signal.until,
            step,
            timestamps,
            values: signal.values,
          };
        }
      });
    }

    return NextResponse.json({
      signals,
      providers: providers.map((p) => ({ asn: Number(p.asn), name: p.organisationName })),
      meta: {
        from,
        until,
        datasource,
        signalType,
        maxPoints,
        providerCount: providers.length,
        signalCount: Object.keys(signals).length,
      },
    });
  } catch (error) {
    console.error('Admin signals API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch IODA signals' },
      { status: 500 }
    );
  }
}


