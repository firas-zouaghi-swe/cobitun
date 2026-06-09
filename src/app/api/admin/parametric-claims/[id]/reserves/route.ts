import { NextRequest, NextResponse } from 'next/server';
import { db, safeTransaction } from '@/lib/db';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { requireRole, Roles } from '@/lib/services/authorization';
import { logAction } from '@/lib/services/audit-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authOrResp = await requireRole(request, Roles.ADMIN);
    if ((authOrResp as any).status) return authOrResp as NextResponse;
    const auth = authOrResp as AuthInfo;

    const { id } = await params;
    const claimId = parseInt(id, 10);
    if (isNaN(claimId)) {
      return NextResponse.json({ error: 'Invalid claim ID' }, { status: 400 });
    }

    const claim = await db.parametricClaim.findUnique({ where: { id: claimId } });
    if (!claim || claim.isDeleted) {
      return NextResponse.json({ error: 'Parametric claim not found' }, { status: 404 });
    }

    const body = await request.json();
    const { reserveType, reserveAmount, actuarialMethod, confidenceLevel, adjustmentReason } = body;

    if (!reserveType || reserveAmount === undefined) {
      return NextResponse.json({ error: 'Reserve type and amount are required' }, { status: 400 });
    }

    const latestReserve = await db.parametricClaimReserve.findFirst({
      where: { parametricClaimId: claimId, isDeleted: 0, reserveType },
      orderBy: { createdAt: 'desc' },
    });

    const previousAmount = latestReserve ? latestReserve.reserveAmount : null;
    const adjustmentAmount = previousAmount
      ? Number(reserveAmount) - Number(previousAmount)
      : null;

    const reserve = await safeTransaction(async (tx) => {
      const created = await tx.parametricClaimReserve.create({
        data: {
          parametricClaimId: claimId,
          reserveType,
          reserveAmount,
          previousAmount,
          adjustmentAmount,
          adjustmentReason: adjustmentReason || 'Initial reserve',
          actuarialMethod: actuarialMethod || null,
          confidenceLevel: confidenceLevel || null,
          createdBy: auth?.userIdNum,
        },
      });
      return created;
    });

    await logAction({
      entityType: 'ParametricClaimReserve',
      entityId: reserve.id,
      actorId: auth?.userIdNum,
      action: 'CREATE',
      actionCategory: 'ADMIN',
      newValues: { parametricClaimId: claimId, reserveType, reserveAmount, actuarialMethod },
      requestPath: `/api/admin/parametric-claims/${claimId}/reserves`,
    });

    return NextResponse.json({ reserve });
  } catch (error) {
    console.error('Create parametric claim reserve error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

