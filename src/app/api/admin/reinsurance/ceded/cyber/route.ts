import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole, Roles } from '@/lib/services/authorization';

export async function GET(request: NextRequest) {
  const authOrResp = await requireRole(request, Roles.ADMIN);
  if ((authOrResp as any).status) return authOrResp as NextResponse;

  try {
    const ceded = await db.cyberReinsuranceCeded.findMany({
      where: { isDeleted: 0 },
      orderBy: { createdAt: 'desc' },
      include: {
        treaty: { select: { id: true, treatyNumber: true, treatyName: true } },
        cyberPolicy: { select: { id: true, policyNumber: true } },
      },
    });
    return NextResponse.json({ ceded });
  } catch (error) {
    console.error('Get cyber ceded error:', error);
    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json({ error: 'Internal server error', message: (error as Error).message, stack: (error as any).stack }, { status: 500 });
    }
    // Fallback to empty list to avoid breaking UI in production
    return NextResponse.json({ ceded: [] });
  }
}

