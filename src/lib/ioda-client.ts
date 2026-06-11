// IODA API Client v2 - Internet Outage Detection and Analysis
// Georgia Tech IODA public API: https://api.ioda.inetintel.cc.gatech.edu/v2
// Used server-side only in API routes
//
// Real API endpoints (verified 2026-05-28):
//   GET /v2/outages/events?entityType=asn&entityCode={asn}&from={unix}&until={unix}
//   GET /v2/outages/alerts?from={unix}&until={unix}
//   GET /v2/signals/events/{entityType}/{entityCode}?from={unix}&until={unix}
//   GET /v2/signals/raw/{entityType}/{entityCode}?from={unix}&until={unix}
//   GET /v2/entities/search?q={query}
//
// Refactored for v3 schema:
//   - When creating TriggerEvent, set slaTierId from CloudProvider.slaTierId
//   - When creating OutageEvent, store iodaEventId and other new fields

const IODA_BASE_URL = 'https://api.ioda.inetintel.cc.gatech.edu/v2';

// ==================== TYPE DEFINITIONS ====================

export interface IodaOutageEvent {
  location: string;           // "asn/2609"
  start: number;              // Unix timestamp in seconds
  duration: number;           // Duration in seconds
  uncertainty: number | null;
  method: string;             // "median" | "mode" etc.
  datasource: string;         // "ping-slash24" | "bgp" | "ucsd-nt"
  status: number;             // 0 = resolved
  fraction: number | null;
  score: number;              // Severity score
  location_name: string;      // "AS2609 (TN-BB-AS)"
  overlaps_window: boolean;
}

export interface IodaNormalizedEvent {
  entityCode: string;
  entityName: string;
  asn: number;
  startTs: number;            // Unix ms
  endTs: number;              // Unix ms
  durationSeconds: number;
  durationHours: number;
  datasource: string;
  score: number;
  method: string;
  status: number;
}

export interface IodaEntityAttrs {
  org?: string;
  fqid?: string;
  ip_count?: string | number;
  ipCount?: string | number;
  name?: string;
}

export interface IodaEntity {
  type: string;
  code: string;
  name: string;
  asn?: number;
  attrs?: IodaEntityAttrs;
}

export interface IodaEntityWithIpCount extends IodaEntity {
  ipCount: number;
}

interface IodaApiResponse {
  type: string;
  metadata: Record<string, unknown>;
  requestParameters: Record<string, unknown>;
  error: string | null;
  perf: unknown;
  data: IodaOutageEvent[] | IodaEntity[];
  copyright: string;
}

// ==================== FETCH WITH RETRY ====================

async function fetchWithRetry(url: string, retries: number = 2, timeoutMs: number = 10000): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.ok) return response;
      if (response.status === 429) {
        // Rate limited - exponential backoff
        const wait = Math.pow(2, attempt) * 1000;
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      // Try to read response body for better diagnostics
      let bodyText = '';
      try {
        bodyText = await response.text();
      } catch (_) {
        bodyText = '(failed to read response body)';
      }
      throw new Error(`IODA API error: ${response.status} ${response.statusText} - ${bodyText}`);
    } catch (error) {
      lastError = error as Error;
      if (attempt < retries - 1) {
        const wait = Math.pow(2, attempt) * 1000;
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  throw lastError || new Error('IODA API request failed after retries');
}

// ==================== NORMALIZATION ====================

function normalizeEvent(event: IodaOutageEvent): IodaNormalizedEvent {
  const durationSeconds = event.duration || 0;
  const startTs = event.start * 1000; // Convert to ms
  const endTs = startTs + durationSeconds * 1000;

  // Extract ASN from location string "asn/2609"
  const asnMatch = event.location?.match(/asn\/(\d+)/);
  const asn = asnMatch ? parseInt(asnMatch[1]) : 0;

  return {
    entityCode: asn.toString(),
    entityName: event.location_name || '',
    asn,
    startTs,
    endTs,
    durationSeconds,
    durationHours: durationSeconds / 3600,
    datasource: event.datasource || 'unknown',
    score: event.score || 0,
    method: event.method || 'unknown',
    status: event.status ?? 0,
  };
}

// ==================== PUBLIC API ====================

/**
 * Get outage events for a specific ASN from IODA v2
 * Uses the correct /outages/events endpoint with query parameters
 */
export async function getOutageEvents(
  entityType: string = 'asn',
  entityCode: string | number,
  fromTs: number,
  untilTs: number
): Promise<IodaNormalizedEvent[]> {
  const from = Math.floor(fromTs / 1000);
  const until = Math.floor(untilTs / 1000);
  const url = `${IODA_BASE_URL}/outages/events?entityType=${entityType}&entityCode=${entityCode}&from=${from}&until=${until}`;

  const response = await fetchWithRetry(url);
  const data: IodaApiResponse = await response.json();

  if (!data || !data.data || !Array.isArray(data.data)) {
    return [];
  }

  return (data.data as IodaOutageEvent[]).map(normalizeEvent);
}

/**
 * Fetch recent outage events for a cloud provider by ASN
 * Default: last 7 days (168 hours)
 */
export async function fetchRecentForProvider(
  asn: number,
  hoursBack: number = 168
): Promise<IodaNormalizedEvent[]> {
  const untilTs = Date.now();
  const fromTs = untilTs - hoursBack * 3600 * 1000;

  return getOutageEvents('asn', asn, fromTs, untilTs);
}

/**
 * Get outage alerts across all entities (global view)
 */
export async function getOutageAlerts(
  fromTs: number,
  untilTs: number,
  entityType?: string,
  entityCode?: string | number,
  datasource?: string
): Promise<IodaNormalizedEvent[]> {
  const from = Math.floor(fromTs / 1000);
  const until = Math.floor(untilTs / 1000);
  let url = `${IODA_BASE_URL}/outages/alerts?from=${from}&until=${until}`;
  if (entityType) url += `&entityType=${entityType}`;
  if (entityCode) url += `&entityCode=${entityCode}`;
  if (datasource) url += `&datasource=${datasource}`;

  const response = await fetchWithRetry(url);
  const data: IodaApiResponse = await response.json();

  if (!data || !data.data || !Array.isArray(data.data)) {
    return [];
  }

  return (data.data as IodaOutageEvent[]).map(normalizeEvent);
}

/**
 * Search for entities in IODA
 */
export async function searchEntities(query: string): Promise<IodaEntity[]> {
  const url = `${IODA_BASE_URL}/entities/search?q=${encodeURIComponent(query)}`;

  const response = await fetchWithRetry(url);
  const data: IodaApiResponse = await response.json();

  if (!data || !data.data || !Array.isArray(data.data)) {
    return [];
  }

  return (data.data as unknown as Record<string, unknown>[]).map((entity) => ({
    type: (entity.type as string) || 'asn',
    code: (entity.code as string) || '',
    name: (entity.name as string) || '',
    asn: (entity.asn as number) || undefined,
    attrs: (entity.attrs as IodaEntityAttrs) ?? undefined,
  }));
}

export async function queryEntities(
  entityType: string = 'asn',
  relatedTo: string
): Promise<IodaEntityWithIpCount[]> {
  const url = `${IODA_BASE_URL}/entities/query?entityType=${encodeURIComponent(entityType)}&relatedTo=${encodeURIComponent(relatedTo)}`;

  const response = await fetchWithRetry(url);
  const data: IodaApiResponse = await response.json();

  if (!data || !data.data || !Array.isArray(data.data)) {
    return [];
  }

  return (data.data as unknown as Record<string, unknown>[]).map((entity) => {
    const attrs = (entity.attrs as IodaEntityAttrs) ?? {};
    const ipCount = Number(attrs.ip_count ?? attrs.ipCount ?? 0) || 0;
    const code = String(entity.code ?? '');
    const asn = code.replace(/^AS/i, '') ? Number(code.replace(/^AS/i, '')) : undefined;

    return {
      type: (entity.type as string) || 'asn',
      code,
      name: (entity.name as string) || String(attrs.name || ''),
      asn: Number.isFinite(asn) ? asn : undefined,
      attrs,
      ipCount,
    };
  });
}

// ==================== SIGNALS (Time-Series) ====================

export interface IodaSignalData {
  datasource: string;
  entityType: string;
  entityCode: string;
  from: number;
  until: number;
  step: number;       // Seconds between data points
  values: (number | null)[];  // Signal values (0-1 range for bgp, absolute for others)
}

/**
 * Get time-series signal data for an entity from IODA v2
 * Used for dashboard visualization and outage validation
 *
 * signalType: 'raw' gives actual BGP route counts (normalized to 0-1 connectivity %)
 *             'events' gives outage event signals (0 = no outage, >0 = outage detected)
 *
 * Endpoints:
 *   Raw:     GET /v2/signals/raw/{entityType}/{entityCode}
 *   Events:  GET /v2/signals/events/{entityType}/{entityCode}
 *
 * Note: Raw signals return nested arrays [[{...}]], while events return flat arrays [{...}].
 * Raw values are absolute counts (e.g., 9588 BGP routes) — we normalize to 0-1 range.
 * Event values are already 0 or outage intensity.
 *
 * IODA expects `from` and `until` as Unix epoch seconds.
 */
export async function getSignals(
  entityType: string = 'asn',
  entityCode: string | number,
  fromTs: number,
  untilTs: number,
  datasource: string = 'bgp',
  maxPoints: number = 500,
  signalType: 'raw' | 'events' = 'raw'
): Promise<IodaSignalData[]> {
  const from = Math.floor(fromTs / 1000);
  const until = Math.floor(untilTs / 1000);
  const normalizedCode = String(entityCode)
    .trim()
    .replace(/^AS/i, '')
    .replace(/^asn\//i, '');

  const params = new URLSearchParams({
    from: String(from),
    until: String(until),
    maxPoints: String(Math.min(maxPoints, 5000)),
  });

  if (signalType === 'raw') {
    params.set('datasource', datasource);
  }

  const url = `${IODA_BASE_URL}/signals/${signalType}/${entityType}/${normalizedCode}?${params.toString()}`;
  const response = await fetchWithRetry(url, 3, 30000); // 30s timeout for signals (heavier endpoint)
  const data = await response.json();

  if (!data || !data.data || !Array.isArray(data.data)) {
    return [];
  }

  // Raw signals return nested arrays: data = [[{...}]]
  // Events signals return flat arrays: data = [{...}]
  let signals: IodaSignalData[] = [];

  if (signalType === 'raw' && data.data.length > 0 && Array.isArray(data.data[0])) {
    // Raw format: nested array
    const flatData = data.data.flat() as Record<string, unknown>[];
    signals = flatData.map((item) => {
      const rawValues = (item.values as (number | null)[]) || [];
      // Normalize raw values to 0-1 range (divide by max non-null value)
      const maxVal = Math.max(...rawValues.filter((v): v is number => v !== null && v > 0)) || 1;
      const normalizedValues = rawValues.map((v) => (v === null ? null : v / maxVal));

      return {
        datasource: (item.datasource as string) || datasource,
        entityType: (item.entityType as string) || entityType,
        entityCode: (item.entityCode as string) || String(entityCode),
        from: (item.from as number) || from,
        until: (item.until as number) || until,
        step: (item.step as number) || 300,
        values: normalizedValues,
      };
    });
  } else {
    // Events format: flat array of objects
    signals = (data.data as Record<string, unknown>[]).map((item) => ({
      datasource: (item.datasource as string) || 'outages',
      entityType: (item.entityType as string) || entityType,
      entityCode: (item.entityCode as string) || String(entityCode),
      from: (item.from as number) || from,
      until: (item.until as number) || until,
      step: (item.step as number) || 300,
      values: (item.values as (number | null)[]) || [],
    }));
  }

  return signals;
}

/**
 * Verify an ASN exists in IODA (useful for admin provider validation)
 */
export async function verifyAsn(asn: number): Promise<{ found: boolean; name?: string; code?: string }> {
  try {
    // Use outage events endpoint to verify ASN exists - more reliable than search
    const until = Math.floor(Date.now() / 1000);
    const from = until - 365 * 24 * 3600; // Check last year for any events
    const url = `${IODA_BASE_URL}/outages/events?entityType=asn&entityCode=${asn}&from=${from}&until=${until}&limit=1`;

    const response = await fetchWithRetry(url);
    const data: IodaApiResponse = await response.json();

    if (data?.data && Array.isArray(data.data) && data.data.length > 0) {
      const event = data.data[0] as IodaOutageEvent;
      return { found: true, name: event.location_name || `AS${asn}`, code: String(asn) };
    }

    // No outage events, but the ASN might still be valid - try search
    try {
      const entities = await searchEntities(`AS${asn}`);
      const match = entities.find((e) => e.code === String(asn));
      if (match) {
        return { found: true, name: match.name, code: match.code };
      }
    } catch {
      // Search failed too
    }

    return { found: false };
  } catch {
    return { found: false };
  }
}

// ==================== OUTAGE EVENT STORAGE HELPERS (v3) ====================

/**
 * Generate a unique IODA event ID from the raw event data.
 * This is used to populate OutageEvent.iodaEventId.
 */
export function generateIodaEventId(asn: number, startTs: number, datasource: string): string {
  return `ioda-asn${asn}-${startTs}-${datasource}`;
}

/**
 * Generate raw data JSON from an IODA normalized event.
 * Used to populate OutageEvent.iodaRawData.
 */
export function generateIodaRawData(event: IodaNormalizedEvent): string {
  return JSON.stringify({
    entityCode: event.entityCode,
    entityName: event.entityName,
    asn: event.asn,
    startTs: event.startTs,
    endTs: event.endTs,
    durationSeconds: event.durationSeconds,
    durationHours: event.durationHours,
    datasource: event.datasource,
    score: event.score,
    method: event.method,
    status: event.status,
  });
}

