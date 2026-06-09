
/**
 * Commission Management API
 * GET  - List brokers and commissions
 * POST - Register broker / Calculate commission / Track payout
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { db } from '@/lib/db';
import { Errors, errorResponse, validateRequestBody } from '@/middleware/validation';
import { z } from 'zod';
import { logAction } from '@/lib/services/audit-service';

const registerBrokerSchema = z.object({
  name: z.string().min(2).max(200),
  email: z.string().email(),
  phone: z.string().max(20).optional(),
  company: z.string().max(200).optional(),
  commissionRate: z.number().min(0).max(50).default(10), // percentage
  licenseNumber: z.string().max(50).optional(),
});

const calculateCommissionSchema = z.object({
  brokerId: z.number().int().positive(),
  policyId: z.number().int().positive(),
});

const payoutCommissionSchema = z.object({
  brokerId: z.number().int().positive(),
  amount: z.number().positive().optional(),
  period: z.enum(['monthly', 'quarterly']).default('monthly'),
});

export async function GET(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'list';
    const brokerId = parseInt(url.searchParams.get('brokerId') || '0', 10);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));

    if (action === 'report' && brokerId) {
      return await getBrokerReport(brokerId);
    }

    // List brokers from system settings
    const brokers = await db.systemSetting.findMany({
      where: { settingKey: { contains: 'broker_' }, isCurrent: 1 },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const brokerList = brokers.map((b) => {
      try { return { id: b.id, ...JSON.parse(b.settingValue) }; }
      catch { return { id: b.id, error: 'Invalid' }; }
    });

    return NextResponse.json({
      brokers: brokerList,
      pagination: { page, limit, total: brokers.length },
    });
  } catch (error) {
    console.error('Failed to list brokers:', error);
    return Errors.internal();
  }
}

async function getBrokerReport(brokerId: number) {
  const brokerSetting = await db.systemSetting.findFirst({ where: { id: brokerId } });
  if (!brokerSetting) return Errors.notFound('Broker');

  const broker = JSON.parse(brokerSetting.settingValue);

  // Get commission records
  const commissions = await db.systemSetting.findMany({
    where: { settingKey: { contains: `commission_${broker.code}_` }, isCurrent: 1 },
    orderBy: { createdAt: 'desc' },
  });

  const commissionRecords = commissions.map((c) => {
    try { return JSON.parse(c.settingValue); }
    catch { return {}; }
  });

  const totalEarned = commissionRecords.reduce((sum: number, c: Record<string, unknown>) => sum + Number(c.commissionAmount || 0), 0);
  const totalPaid = commissionRecords.filter((c: Record<string, unknown>) => c.status === 'PAID').reduce((sum: number, c: Record<string, unknown>) => sum + Number(c.commissionAmount || 0), 0);

  return NextResponse.json({
    broker,
    commissions: commissionRecords,
    summary: {
      totalEarned,
      totalPaid,
      totalPending: totalEarned - totalPaid,
      totalPolicies: commissionRecords.length,
    },
  });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  try {
    const body = await request.json();
    const action = body.action as string;

    switch (action) {
      case 'register':
        return await registerBroker(request, body, auth);
      case 'calculate':
        return await calculateCommission(request, body, auth);
      case 'payout':
        return await payoutCommission(request, body, auth);
      default:
        return errorResponse('Invalid action. Use: register, calculate, payout', 'INVALID_ACTION', 400);
    }
  } catch (error) {
    console.error('Commission management failed:', error);
    return Errors.internal();
  }
}

async function registerBroker(request: NextRequest, body: Record<string, unknown>, auth: NonNullable<Awaited<ReturnType<typeof getAuthInfo>>>) {
  const result = await validateRequestBody(
    new NextRequest(request.url, { body: JSON.stringify(body), method: 'POST' }),
    registerBrokerSchema
  );
  if ('error' in result) return result.error;

  const broker = result.data;
  const code = `BRK-${Date.now().toString(36).toUpperCase()}`;
  const settingKey = `broker_${code}`;

  const setting = await db.systemSetting.create({
    data: {
      settingKey,
      settingValue: JSON.stringify({ code, ...broker, status: 'ACTIVE', totalPolicies: 0, totalCommission: 0, createdAt: new Date().toISOString() }),
      valueType: 'JSON',
      isEditable: 1,
      category: 'broker',
      description: `Broker: ${broker.name}`,
      isCurrent: 1,
      version: 1,
    },
  });

  await logAction({
    entityType: 'SystemSetting',
    entityId: setting.id,
    action: 'REGISTER_BROKER',
    actorId: auth.userIdNum,
    actorType: auth.role,
    metadata: { code, name: broker.name, commissionRate: broker.commissionRate },
    ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
  });

  return NextResponse.json({ broker: { id: setting.id, code, ...broker } }, { status: 201 });
}

async function calculateCommission(request: NextRequest, body: Record<string, unknown>, auth: NonNullable<Awaited<ReturnType<typeof getAuthInfo>>>) {
  const result = await validateRequestBody(
    new NextRequest(request.url, { body: JSON.stringify(body), method: 'POST' }),
    calculateCommissionSchema
  );
  if ('error' in result) return result.error;

  const { brokerId, policyId } = result.data;

  const brokerSetting = await db.systemSetting.findFirst({ where: { id: brokerId } });
  if (!brokerSetting) return Errors.notFound('Broker');

  const broker = JSON.parse(brokerSetting.settingValue);

  const policy = await db.parametricPolicy.findFirst({ where: { id: policyId, isDeleted: 0 } });
  if (!policy) return Errors.notFound('Policy');

  const premium = Number(policy.finalPremium || 0);
  const commissionAmount = premium * (broker.commissionRate / 100);

  const commissionRecord = {
    brokerCode: broker.code,
    brokerName: broker.name,
    policyId,
    policyNumber: policy.policyNumber,
    premiumAmount: premium,
    commissionRate: broker.commissionRate,
    commissionAmount: Math.round(commissionAmount * 100) / 100,
    status: 'PENDING',
    calculatedAt: new Date().toISOString(),
  };

  const settingKey = `commission_${broker.code}_${policyId}`;
  await db.systemSetting.create({
    data: {
      settingKey,
      settingValue: JSON.stringify(commissionRecord),
      valueType: 'JSON',
      isEditable: 1,
      category: 'commission',
      description: `Commission: ${broker.name} - Policy ${policy.policyNumber}`,
      isCurrent: 1,
      version: 1,
    },
  });

  await logAction({
    entityType: 'SystemSetting',
    entityId: 0,
    action: 'CALCULATE_COMMISSION',
    actorId: auth.userIdNum,
    actorType: auth.role,
    metadata: { brokerCode: broker.code, policyId, commissionAmount },
    ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
  });

  return NextResponse.json({ commission: commissionRecord }, { status: 201 });
}

async function payoutCommission(request: NextRequest, body: Record<string, unknown>, auth: NonNullable<Awaited<ReturnType<typeof getAuthInfo>>>) {
  const result = await validateRequestBody(
    new NextRequest(request.url, { body: JSON.stringify(body), method: 'POST' }),
    payoutCommissionSchema
  );
  if ('error' in result) return result.error;

  const { brokerId, amount, period } = result.data;

  const brokerSetting = await db.systemSetting.findFirst({ where: { id: brokerId } });
  if (!brokerSetting) return Errors.notFound('Broker');

  const broker = JSON.parse(brokerSetting.settingValue);

  // Find pending commissions
  const pendingCommissions = await db.systemSetting.findMany({
    where: { settingKey: { contains: `commission_${broker.code}_` }, isCurrent: 1 },
  });

  let totalPayout = 0;
  const paidRecords: unknown[] = [];

  for (const comm of pendingCommissions) {
    const record = JSON.parse(comm.settingValue);
    if (record.status === 'PENDING') {
      if (!amount || totalPayout + record.commissionAmount <= amount) {
        record.status = 'PAID';
        record.paidAt = new Date().toISOString();
        record.period = period;

        await db.systemSetting.update({
          where: { id: comm.id },
          data: { settingValue: JSON.stringify(record), updatedAt: new Date() },
        });

        totalPayout += record.commissionAmount;
        paidRecords.push(record);
      }
    }
  }

  await logAction({
    entityType: 'SystemSetting',
    entityId: brokerId,
    action: 'PAYOUT_COMMISSION',
    actorId: auth.userIdNum,
    actorType: auth.role,
    metadata: { brokerCode: broker.code, totalPayout, recordsPaid: paidRecords.length, period },
    ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
  });

  return NextResponse.json({
    message: 'Commission payout processed',
    brokerCode: broker.code,
    totalPayout: Math.round(totalPayout * 100) / 100,
    recordsPaid: paidRecords.length,
    period,
  });
}


