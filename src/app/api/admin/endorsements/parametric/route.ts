import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { requireRole, Roles } from '@/lib/services/authorization';
import { logAction } from '@/lib/services/audit-service';

export async function GET(request: NextRequest) {
  const authOrResp = await requireRole(request, Roles.ADMIN);
  if ((authOrResp as any).status) return authOrResp as NextResponse;

  try {
    const endorsements = await db.parametricPolicyEndorsement.findMany({
      where: { isDeleted: 0 },
      orderBy: { createdAt: 'desc' },
      include: {
        parametricPolicy: {
          select: { id: true, policyNumber: true },
        },
      },
    });
    return NextResponse.json({ endorsements });
  } catch (error) {
    console.error('Get parametric endorsements error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authOrResp = await requireRole(request, Roles.ADMIN);
    if ((authOrResp as any).status) return authOrResp as NextResponse;
    const auth = authOrResp as AuthInfo;

    const body = await request.json();
    const {
      parametricPolicyId,
      endorsementNumber,
      endorsementType,
      previousValuesJson,
      newValuesJson,
      changeDescription,
      premiumAdjustment,
      premiumAdjustmentType,
      effectiveDate,
      status,
    } = body;

    if (!parametricPolicyId || !endorsementNumber || !endorsementType || !changeDescription || !effectiveDate) {
      return NextResponse.json({ error: 'Policy ID, endorsement number, type, description, and effective date are required' }, { status: 400 });
    }

    const existing = await db.parametricPolicyEndorsement.findUnique({ where: { endorsementNumber } });
    if (existing) {
      return NextResponse.json({ error: 'Endorsement with this number already exists' }, { status: 400 });
    }

    const endorsement = await db.parametricPolicyEndorsement.create({
      data: {
        parametricPolicyId,
        endorsementNumber,
        endorsementType,
        previousValuesJson: previousValuesJson || '{}',
        newValuesJson: newValuesJson || '{}',
        changeDescription,
        premiumAdjustment: premiumAdjustment ?? 0,
        premiumAdjustmentType: premiumAdjustmentType || null,
        effectiveDate: new Date(effectiveDate),
        status: status || 'PENDING',
        requestedBy: auth?.userIdNum,
        createdBy: auth?.userIdNum,
      },
      include: {
        parametricPolicy: { select: { id: true, policyNumber: true } },
      },
    });

    await logAction({
      entityType: 'ParametricPolicyEndorsement',
      entityId: endorsement.id,
      actorId: auth?.userIdNum,
      action: 'CREATE',
      actionCategory: 'ADMIN',
      newValues: { endorsementNumber, endorsementType, parametricPolicyId, changeDescription },
      requestPath: '/api/admin/endorsements/parametric',
    });

    return NextResponse.json({ endorsement });
  } catch (error) {
    console.error('Create parametric endorsement error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


