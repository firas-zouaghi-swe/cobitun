import { NextRequest, NextResponse } from 'next/server';
import { getSignals } from '@/lib/ioda-client';
import { db } from '@/lib/db';
import { getAuthInfo, verifyCustomerOwnership, AuthInfo } from '@/lib/services/auth-helper';
import { requireAuth } from '@/lib/services/authorization';

// Allow up to 60 seconds for IODA signals (can be slow for multiple ASNs)
export const maxDuration = 60;

/**
 * Customer IODA Signals API
 * v3: Uses statusId FK lookups for approved policies
 */
export async function GET(request: NextRequest) {
  try {
    const authOrResp = await requireAuth(request);
    if ((authOrResp as any).status) return authOrResp as NextResponse;
    const auth = authOrResp as AuthInfo;

    const { searchParams } = new URL(request.url);
    const customerIdParam = searchParams.get('customerId');
    const parsedCustomerId = customerIdParam ? parseInt(customerIdParam, 10) : undefined;

    const parseTimestamp = (value: string | null): number | null => {
      if (!value) return null;
      const parsed = parseInt(value, 10);
      if (Number.isNaN(parsed)) return null;
      return parsed > 1e12 ? parsed : parsed * 1000;
    };

    const effectiveCustomerId = await verifyCustomerOwnership(auth, parsedCustomerId);
    if (!effectiveCustomerId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Parse date range
    const until = searchParams.get('until')
      ? parseInt(searchParams.get('until')!)
      : Date.now();
    const from = searchParams.get('from')
      ? parseInt(searchParams.get('from')!)
      : until - 24 * 3600 * 1000;

    const datasource = searchParams.get('datasource') || 'bgp';
    const signalType = (searchParams.get('signalType') || 'raw') as 'raw' | 'events';
    const maxPoints = Math.min(parseInt(searchParams.get('maxPoints') || '500'), 5000);

    // v3: Look up APPROVED status by statusCode
    const approvedStatus = await db.enumParamPolicyStatus.findFirst({
      where: { statusCode: 'APPROVED', isCurrent: 1 },
      select: { id: true },
    });

    const whereClause: Record<string, unknown> = {
      customerId: effectiveCustomerId,
      isDeleted: 0,
    };
    if (approvedStatus) {
      whereClause.statusId = approvedStatus.id;
    }

    // Get customer's approved parametric policies → their insured providers
    const policies = await db.parametricPolicy.findMany({
      where: whereClause,
      include: { cloudProvider: { select: { asn: true, organisationName: true } } },
    });

    if (policies.length === 0) {
      return NextResponse.json({ signals: {}, providers: [] });
    }

    // Deduplicate providers (customer may have multiple policies on same provider)
    const providerMap = new Map<number, string>();
    policies.forEach((p) => {
      providerMap.set(Number(p.cloudProvider.asn), p.cloudProvider.organisationName);
    });

    const providers = Array.from(providerMap.entries()).map(([asn, name]) => ({
      asn,
      organisationName: name,
    }));

    // Fetch signals for each provider in parallel (limit concurrency to 3)
    const BATCH_SIZE = 3;
    const signals: Record<string, {
      asn: number;
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
          const data = await getSignals('asn', provider.asn, from, until, datasource, maxPoints, signalType);
          return { provider, data };
        })
      );

      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.data.length > 0) {
          const { provider, data } = result.value;
          const signal = data[0];
          const timestamps: number[] = [];
          const step = signal.step || 300;

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
      providers: providers.map((p) => ({ asn: p.asn, name: p.organisationName })),
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
    console.error('Customer signals API error:', (error as any)?.message ?? error, error);
    return NextResponse.json(
      { error: 'Failed to fetch IODA signals' },
      { status: 500 }
    );
  }
}

