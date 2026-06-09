import { NextRequest, NextResponse } from 'next/server';
import { getOutageAlerts, getOutageEvents } from '@/lib/ioda-client';
import { db } from '@/lib/db';
import { requireRole, Roles } from '@/lib/services/authorization';
import { Decimal } from '@prisma/client/runtime/library';

// Allow up to 60 seconds for IODA alerts (can be slow for multiple ASNs)
export const maxDuration = 60;

/**
 * Admin IODA Alerts API
 * Fetches outage alerts or events from IODA for all or selected ASNs.
 * Returns a flat list of alerts with provider details for table display.
 * v3: Uses CloudProvider.slaTierId (FK) → EnumSlaTier relation
 */
export async function GET(request: NextRequest) {
  const authOrResp = await requireRole(request, Roles.ADMIN);
  if ((authOrResp as any).status) return authOrResp as NextResponse;
  try {
    const { searchParams } = new URL(request.url);

    // Parse parameters
    const alertType = (searchParams.get('alertType') || 'events') as 'alerts' | 'events';
    const asnsParam = searchParams.get('asns');
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
    const search = searchParams.get('search')?.toLowerCase() || undefined;

    // Get providers with SLA tier info from FK relation
    let providers: { asn: string; organisationName: string; slaTier: { tierCode: string; tierName: string }; mttrHours: Decimal }[];

    const includeSlaTier = {
      slaTier: { select: { tierCode: true, tierName: true } },
    };

    if (asnsParam) {
      const asnList = asnsParam.split(',').map(String).filter(Boolean);
      providers = await db.cloudProvider.findMany({
        where: { asn: { in: asnList }, isDeleted: 0 },
        select: { asn: true, organisationName: true, mttrHours: true, slaTier: includeSlaTier.slaTier },
      });
    } else {
      providers = await db.cloudProvider.findMany({
        where: { isActive: 1, isDeleted: 0 },
        select: { asn: true, organisationName: true, mttrHours: true, slaTier: includeSlaTier.slaTier },
      });
    }

    if (providers.length === 0) {
      return NextResponse.json({
        alerts: [],
        providers: [],
        pagination: { page, pageSize, totalItems: 0, totalPages: 0 },
        meta: { from, until, alertType, datasource },
      });
    }

    // Build provider lookup
    const providerMap = new Map(providers.map((p) => [p.asn, p]));
    const providerAsns = providers.map((p) => p.asn).join(',');

    const rawEvents = alertType === 'alerts'
      ? await getOutageAlerts(from, until, 'asn', providerAsns, datasource || undefined)
      : await getOutageEvents('asn', providerAsns, from, until);

    const allAlerts = rawEvents
      .map((event) => {
        const asnMatch = event.entityCode.match(/^\d+$/) ? event.entityCode : event.entityCode.replace(/^asn\//i, '');
        const provider = providerMap.get(asnMatch);
        if (!provider) return null;

        return {
          asn: provider.asn,
          providerName: provider.organisationName,
          slaTier: provider.slaTier?.tierCode || 'Unknown',
          slaTierName: provider.slaTier?.tierName || 'Unknown',
          mttrHours: Number(provider.mttrHours),
          startTs: event.startTs,
          endTs: event.endTs,
          durationSeconds: event.durationSeconds,
          durationHours: event.durationHours,
          datasource: event.datasource,
          score: event.score,
          method: event.method,
          status: event.status,
          entityName: event.entityName,
        };
      })
      .filter((item): item is Exclude<typeof item, null> => item !== null);

    // Apply datasource filter if specified
    let filtered = datasource
      ? allAlerts.filter((a) => a.datasource === datasource)
      : allAlerts;

    // Apply search filter
    if (search) {
      filtered = filtered.filter(
        (a) =>
          a.providerName.toLowerCase().includes(search) ||
          a.entityName.toLowerCase().includes(search) ||
          a.asn.toString().includes(search)
      );
    }

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
        slaTier: p.slaTier?.tierCode || 'Unknown',
        slaTierName: p.slaTier?.tierName || 'Unknown',
        mttrHours: Number(p.mttrHours),
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
    console.error('Admin IODA alerts API error:', error);
    // Upstream IODA failure should not cause a hard 500 for the dashboard.
    // Return empty results with an explanatory meta field so the UI can show a friendly message.
    return NextResponse.json(
      {
        alerts: [],
        providers: [],
        pagination: { page: 1, pageSize: 50, totalItems: 0, totalPages: 0 },
        meta: { from: 0, until: 0, alertType: 'events', datasource: undefined, error: 'IODA upstream unavailable' },
      },
      { status: 200 }
    );
  }
}

