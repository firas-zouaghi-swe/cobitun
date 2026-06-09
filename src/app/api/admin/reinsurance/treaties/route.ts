import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getAuthInfo, AuthInfo } from '@/lib/services/auth-helper';
import { requireRole, Roles } from '@/lib/services/authorization';
import { logAction } from '@/lib/services/audit-service';

const treatyCreateSchema = z.object({
  treatyNumber: z.string().min(1).max(50),
  treatyName: z.string().min(1).max(200),
  reinsurerName: z.string().min(1).max(200),
  reinsurerContact: z.string().max(200).optional(),
  reinsurerEmail: z.string().email().max(200).optional().or(z.literal('')),
  reinsurerPhone: z.string().max(50).optional(),
  treatyType: z.string().min(1).max(50),
  treatyStartDate: z.string().optional(),
  treatyEndDate: z.string().optional(),
  cessionPct: z.number().min(0).max(100).optional(),
  retentionAmount: z.number().min(0).optional(),
  limitAmount: z.number().positive().optional(),
  attachmentPoint: z.number().min(0).optional(),
  reinsurancePremiumPct: z.number().min(0).optional(),
  profitCommissionPct: z.number().min(0).optional(),
  noClaimBonusPct: z.number().min(0).optional(),
  status: z.string().max(50).optional(),
});

export async function GET(request: NextRequest) {
  const authOrResp = await requireRole(request, Roles.ADMIN);
  if ((authOrResp as any).status) return authOrResp as NextResponse;

  try {
    const treaties = await db.reinsuranceTreaty.findMany({
      where: { isDeleted: 0 },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { parametricReinsuranceCeded: true, cyberReinsuranceCeded: true } },
      },
    });
    return NextResponse.json({ treaties });
  } catch (error) {
    console.error('Get reinsurance treaties error:', error);
    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json({ error: 'Internal server error', message: (error as Error).message, stack: (error as any).stack }, { status: 500 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authOrResp = await requireRole(request, Roles.ADMIN);
    if ((authOrResp as any).status) return authOrResp as NextResponse;
    const auth = authOrResp as AuthInfo;

    const body = await request.json();
    const parsed = treatyCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const {
      treatyNumber,
      treatyName,
      reinsurerName,
      reinsurerContact,
      reinsurerEmail,
      reinsurerPhone,
      treatyType,
      treatyStartDate,
      treatyEndDate,
      cessionPct,
      retentionAmount,
      limitAmount,
      attachmentPoint,
      reinsurancePremiumPct,
      profitCommissionPct,
      noClaimBonusPct,
      status,
    } = parsed.data;

    // Treaty number uniqueness is already checked below

    const existing = await db.reinsuranceTreaty.findUnique({ where: { treatyNumber } });
    if (existing) {
      return NextResponse.json({ error: 'Treaty with this number already exists' }, { status: 400 });
    }

    const treaty = await db.reinsuranceTreaty.create({
      data: {
        treatyNumber,
        treatyName,
        reinsurerName,
        reinsurerContact: reinsurerContact || null,
        reinsurerEmail: reinsurerEmail || null,
        reinsurerPhone: reinsurerPhone || null,
        treatyType,
        treatyStartDate: treatyStartDate ? new Date(treatyStartDate) : new Date(),
        treatyEndDate: treatyEndDate ? new Date(treatyEndDate) : new Date(),
        cessionPct: cessionPct || null,
        retentionAmount: retentionAmount || null,
        limitAmount: limitAmount || null,
        attachmentPoint: attachmentPoint || null,
        reinsurancePremiumPct: reinsurancePremiumPct || null,
        profitCommissionPct: profitCommissionPct || null,
        noClaimBonusPct: noClaimBonusPct || null,
        status: status || 'ACTIVE',
        createdBy: auth?.userIdNum,
      },
    });

    await logAction({
      entityType: 'ReinsuranceTreaty',
      entityId: treaty.id,
      actorId: auth?.userIdNum,
      action: 'CREATE',
      actionCategory: 'ADMIN',
      newValues: { treatyNumber, treatyName, reinsurerName, treatyType },
      requestPath: '/api/admin/reinsurance/treaties',
    });

    return NextResponse.json({ treaty });
  } catch (error) {
    console.error('Create reinsurance treaty error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


