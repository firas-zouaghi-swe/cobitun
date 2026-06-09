import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { requireRole, Roles } from '@/lib/services/authorization';
import { logAction } from '@/lib/services/audit-service';

export async function GET(request: NextRequest) {
  const authOrResp = await requireRole(request, Roles.ADMIN);
  if ((authOrResp as any).status) return authOrResp as NextResponse;

  try {
    const renewals = await db.parametricPolicyRenewal.findMany({
      where: { isDeleted: 0 },
      orderBy: { createdAt: 'desc' },
      include: {
        parentPolicy: {
          select: { id: true, policyNumber: true },
        },
      },
    });
    return NextResponse.json({ renewals });
  } catch (error) {
    console.error('Get parametric renewals error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authOrResp = await requireRole(request, Roles.ADMIN);
    if ((authOrResp as any).status) return authOrResp as NextResponse;
    const auth = authOrResp as AuthInfo;

    const body = await request.json();
    const { id, status, declinedReason } = body;

    if (!id) {
      return NextResponse.json({ error: 'Renewal ID is required' }, { status: 400 });
    }

    if (!['ACCEPTED', 'DECLINED'].includes(status)) {
      return NextResponse.json({ error: 'Status must be ACCEPTED or DECLINED' }, { status: 400 });
    }

    const renewal = await db.parametricPolicyRenewal.findUnique({ where: { id } });
    if (!renewal || renewal.isDeleted) {
      return NextResponse.json({ error: 'Renewal not found' }, { status: 404 });
    }

    if (renewal.status !== 'PENDING') {
      return NextResponse.json({ error: 'Only PENDING renewals can be accepted or declined' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      status,
      updatedBy: auth?.userIdNum,
    };

    if (status === 'ACCEPTED') {
      updateData.acceptedAt = new Date();
    } else {
      updateData.declinedAt = new Date();
      updateData.declinedReason = declinedReason || null;
    }

    const updated = await db.parametricPolicyRenewal.update({
      where: { id },
      data: updateData,
      include: {
        parentPolicy: { select: { id: true, policyNumber: true } },
      },
    });

    await logAction({
      entityType: 'ParametricPolicyRenewal',
      entityId: id,
      actorId: auth?.userIdNum,
      action: status === 'ACCEPTED' ? 'ACCEPT' : 'DECLINE',
      actionCategory: 'ADMIN',
      newValues: { status, declinedReason },
      requestPath: '/api/admin/renewals/parametric',
    });

    return NextResponse.json({ renewal: updated });
  } catch (error) {
    console.error('Update parametric renewal error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


