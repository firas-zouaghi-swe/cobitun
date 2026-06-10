import { NextRequest, NextResponse } from 'next/server';
import { getOutageAlerts, getOutageEvents } from '@/lib/ioda-client';
import { db } from '@/lib/db';
import { getAuthInfo, verifyCustomerOwnership, AuthInfo } from '@/lib/services/auth-helper';
import { requireAuth } from '@/lib/services/authorization';

// Allow up to 60 seconds for IODA alerts
export const maxDuration = 60;

/**
 * Customer IODA Alerts API
 * Fetches outage alerts/events from IODA for the customer's insured providers only.
 * v3: Uses statusId FK and slaTierId FK lookups
 */
export async function GET(request: NextRequest) {
  try {
    const authOrResp = await requireAuth(request);
    if ((authOrResp as any).status) return authOrResp as NextResponse;
    const auth = authOrResp as AuthInfo;

    const { searchParams } = new URL(request.url);
    const customerIdParam = searchParams.get('customerId');
    const parsedCustomerId = customerIdParam ? parseInt(customerIdParam, 10) : undefined;

    const effectiveCustomerId = await verifyCustomerOwnership(auth, parsedCustomerId);
    if (!effectiveCustomerId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Parse parameters
    const alertType = (searchParams.get('alertType') || 'events') as 'alerts' | 'events';
    const until = searchParams.get('until')
      ? parseInt(searchParams.get('until')!)
      : Date.now();
    const from = searchParams.get('from')
      ? parseInt(searchParams.get('from')!)
      : until - 7 * 24 * 3600 * 1000;
    const datasource = searchParams.get('datasource') || undefined;
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const pageSize = Math.min(Math.max(parseInt(searchParams.get('pageSize') || '50'), 1), 200);
    const sortBy = searchParams.get('sortBy') || 'start';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // v3: Look up APPROVED status by statusCode
    const approvedStatus = await db.enumParamPolicyStatus.findFirst({
      where: { statusCode: 'APPROVED', isCurrent: 1 },
      select: { id: true },
    });

    // Get customer's approved parametric policies ? their insured providers
    const whereClause: Record<string, unknown> = {
      customerId: effectiveCustomerId,
      isDeleted: 0,
    };
    if (approvedStatus) {
      whereClause.statusId = approvedStatus.id;
    }

    const policies = await db.parametricPolicy.findMany({
      where: whereClause,
      include: {
        cloudProvider: {
          include: {
            slaTier: { select: { tierCode: true, tierName: true, mttrHours: true } },
          },
        },
      },
    });

    if (policies.length === 0) {
      return NextResponse.json({
        alerts: [],
        providers: [],
        pagination: { page, pageSize, totalItems: 0, totalPages: 0 },
        meta: { from, until, alertType, datasource },
      });
    }

    // Deduplicate providers
    const providerMap = new Map<
      number,
      { asn: number; organisationName: string; slaTierCode: string; slaTierName: string; mttrHours: number }
    >();
    policies.forEach((p) => {
      if (!providerMap.has(p.cloudProviderId)) {
        providerMap.set(p.cloudProviderId, {
          asn: Number(p.cloudProvider.asn),
          organisationName: p.cloudProvider.organisationName,
          slaTierCode: p.cloudProvider.slaTier?.tierCode || 'Bronze',
          slaTierName: p.cloudProvider.slaTier?.tierName || 'Bronze',
          mttrHours: Number(p.cloudProvider.slaTier?.mttrHours || p.cloudProvider.mttrHours || 16),
        });
      }
    });

    const providers = Array.from(providerMap.values());

    // Fetch alerts for each provider in batches
    const BATCH_SIZE = 3;
    const allAlerts: Array<{
      asn: number;
      providerName: string;
      slaTier: string;
      mttrHours: number;
      startTs: number;
      endTs: number;
      durationSeconds: number;
      durationHours: number;
      datasource: string;
      score: number;
      method: string;
      status: number;
      entityName: string;
      overlapsWindow: boolean;
      exceedsMttr: boolean;
    }> = [];

    for (let i = 0; i < providers.length; i += BATCH_SIZE) {
      const batch = providers.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (provider) => {
          try {
            if (alertType === 'alerts') {
              const data = await getOutageAlerts(from, until, 'asn', provider.asn);
              return data.map((event) => ({
                asn: provider.asn,
                providerName: provider.organisationName,
                slaTier: provider.slaTierCode,
                mttrHours: provider.mttrHours,
                startTs: event.startTs,
                endTs: event.endTs,
                durationSeconds: event.durationSeconds,
                durationHours: event.durationHours,
                datasource: event.datasource,
                score: event.score,
                method: event.method,
                status: event.status,
                entityName: event.entityName,
                overlapsWindow: false,
                exceedsMttr: event.durationHours > provider.mttrHours,
              }));
            } else {
              const data = await getOutageEvents('asn', provider.asn, from, until);
              return data.map((event) => ({
                asn: event.asn || provider.asn,
                providerName: provider.organisationName,
                slaTier: provider.slaTierCode,
                mttrHours: provider.mttrHours,
                startTs: event.startTs,
                endTs: event.endTs,
                durationSeconds: event.durationSeconds,
                durationHours: event.durationHours,
                datasource: event.datasource,
                score: event.score,
                method: event.method,
                status: event.status,
                entityName: event.entityName,
                overlapsWindow: false,
                exceedsMttr: event.durationHours > provider.mttrHours,
              }));
            }
          } catch (err) {
            // Ignore fetch errors for individual AS numbers
            return [];
          }
        })
      );

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          allAlerts.push(...result.value);
        }
      });
    }

    // Apply datasource filter
    let filtered = datasource
      ? allAlerts.filter((a) => a.datasource === datasource)
      : allAlerts;

    // Sort
    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'start':
          cmp = a.startTs - b.startTs;
          break;
        case 'duration':
          cmp = a.durationSeconds - b.durationSeconds;
          break;
        case 'score':
          cmp = a.score - b.score;
          break;
        case 'provider':
          cmp = a.providerName.localeCompare(b.providerName);
          break;
        default:
          cmp = a.startTs - b.startTs;
      }
      return sortOrder === 'desc' ? -cmp : cmp;
    });

    // Pagination
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const paginatedAlerts = filtered.slice((page - 1) * pageSize, page * pageSize);

    return NextResponse.json({
      alerts: paginatedAlerts,
      providers: providers.map((p) => ({
        asn: p.asn,
        name: p.organisationName,
        slaTier: p.slaTierCode,
        mttrHours: p.mttrHours,
      })),
      pagination: { page, pageSize, totalItems, totalPages },
      meta: {
        from,
        until,
        alertType,
        datasource,
        providerCount: providers.length,
        totalAlerts: allAlerts.length,
        filteredAlerts: totalItems,
      },
    });
  } catch (error) {
    // Ignore IODA alerts API errors
    return NextResponse.json(
      { error: 'Failed to fetch IODA alerts' },
      { status: 500 }
    );
  }
}

