import { NextRequest, NextResponse } from 'next/server';
import { verifyAsn } from '@/lib/ioda-client';
import { requireRole, Roles } from '@/lib/services/authorization';

/**
 * Verify ASN with IODA.
 * No model changes — just an API call.
 */
export async function GET(request: NextRequest) {
  const authOrResp = await requireRole(request, Roles.ADMIN);
  if ((authOrResp as any).status) return authOrResp as NextResponse;
  try {
    const { searchParams } = new URL(request.url);
    const asn = searchParams.get('asn');

    if (!asn) {
      return NextResponse.json({ error: 'ASN parameter is required' }, { status: 400 });
    }

    const result = await verifyAsn(Number(asn));
    return NextResponse.json(result);
  } catch (error) {
    console.error('IODA verify error:', error);
    return NextResponse.json({ error: 'Failed to verify ASN with IODA' }, { status: 500 });
  }
}


