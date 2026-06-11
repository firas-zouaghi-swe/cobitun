import { NextRequest, NextResponse } from 'next/server';
import { queryEntities } from '@/lib/ioda-client';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const country = url.searchParams.get('country') || 'TN';
    const entityType = url.searchParams.get('entityType') || 'asn';

    const entities = await queryEntities(entityType, `country/${country}`);
    return NextResponse.json({ entities });
  } catch (error) {
    console.error('IODA entity query failed:', error);
    return NextResponse.json({ error: 'Failed to fetch IODA entities' }, { status: 500 });
  }
}
