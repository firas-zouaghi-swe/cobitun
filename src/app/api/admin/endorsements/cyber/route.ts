import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole, Roles } from '@/lib/services/authorization';

export async function GET(request: NextRequest) {
  const authOrResp = await requireRole(request, Roles.ADMIN);
  if ((authOrResp as any).status) return authOrResp as NextResponse;

  try {
    const endorsements = await db.cyberPolicyEndorsement.findMany({
      where: { isDeleted: 0 },
      orderBy: { createdAt: 'desc' },
      include: {
        cyberPolicy: {
          select: { id: true, policyNumber: true },
        },
      },
    });
    return NextResponse.json({ endorsements });
  } catch (error) {
    console.error('Get cyber endorsements error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

