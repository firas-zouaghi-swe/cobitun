import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { requireRole, Roles } from '@/lib/services/authorization';
import { logAction } from '@/lib/services/audit-service';

export async function GET(request: NextRequest) {
  const authOrResp = await requireRole(request, Roles.ADMIN);
  if ((authOrResp as any).status) return authOrResp as NextResponse;

  try {
    const configs = await db.payoutFunctionConfig.findMany({
      where: { isDeleted: 0 },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ configs });
  } catch (error) {
    console.error('Get payout function configs error:', error);
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
      configName,
      configCode,
      functionType,
      description,
      linearMultiplier,
      stepConfigJson,
      hybridBaseRate,
      hybridStepConfigJson,
      exponentialBase,
      exponentialExponent,
    } = body;

    if (!configName || !configCode || !functionType) {
      return NextResponse.json({ error: 'Config name, code, and function type are required' }, { status: 400 });
    }

    if (!['LINEAR', 'STEP', 'HYBRID', 'EXPONENTIAL'].includes(functionType)) {
      return NextResponse.json({ error: 'Function type must be LINEAR, STEP, HYBRID, or EXPONENTIAL' }, { status: 400 });
    }

    const existing = await db.payoutFunctionConfig.findUnique({ where: { configCode } });
    if (existing) {
      return NextResponse.json({ error: 'Config with this code already exists' }, { status: 400 });
    }

    const config = await db.payoutFunctionConfig.create({
      data: {
        configName,
        configCode,
        functionType,
        description: description || null,
        linearMultiplier: linearMultiplier || null,
        stepConfigJson: stepConfigJson || null,
        hybridBaseRate: hybridBaseRate || null,
        hybridStepConfigJson: hybridStepConfigJson || null,
        exponentialBase: exponentialBase || null,
        exponentialExponent: exponentialExponent || null,
        createdBy: auth?.userIdNum,
      },
    });

    await logAction({
      entityType: 'PayoutFunctionConfig',
      entityId: config.id,
      actorId: auth?.userIdNum,
      action: 'CREATE',
      actionCategory: 'ADMIN',
      newValues: { configName, configCode, functionType },
      requestPath: '/api/admin/payout-functions',
    });

    return NextResponse.json({ config });
  } catch (error) {
    console.error('Create payout function config error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


