import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/services/authorization';
import { queryEntities } from '@/lib/ioda-client';

export async function GET(request: NextRequest) {
  try {
    // Require authentication - only authenticated users can query IODA entities
    const authOrResp = await requireAuth(request);
    if ((authOrResp as NextResponse).status) return authOrResp as NextResponse;

    const url = new URL(request.url);
    const country = url.searchParams.get('country') || 'TN';
    const entityType = url.searchParams.get('entityType') || 'asn';

    const entities = await queryEntities(entityType, `country/${country}`);
    return NextResponse.json({ entities });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch IODA entities' }, { status: 500 });
  }
}
