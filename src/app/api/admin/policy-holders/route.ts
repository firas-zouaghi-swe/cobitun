import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole, Roles } from '@/lib/services/authorization';
import { logAction } from '@/lib/services/audit-service';

// Legacy PolicyRecord — still uses cuid IDs for backward compatibility

export async function GET(request: NextRequest) {
  const authOrResp = await requireRole(request, Roles.ADMIN);
  if ((authOrResp as any).status) return authOrResp as NextResponse;
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all';

    const whereClause = filter === 'all' ? {} : { status: filter };

    const policyHolders = await db.policyRecord.findMany({
      where: whereClause,
      include: {
        policy: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Resolve categories separately (Policy.categoryId is String, Category.id is Int — no FK relation)
    const categoryIds = [...new Set(policyHolders.map(ph => ph.policy?.categoryId).filter(Boolean))];
    const categories = categoryIds.length > 0
      ? await db.category.findMany({ where: { id: { in: categoryIds.map(Number).filter(n => !isNaN(n)) } } })
      : [];
    const categoryMap = Object.fromEntries(categories.map(c => [String(c.id), c]));

    // Enrich with Customer + User when policyRecord.customerId is a numeric customer id stored as string
    const numericCustomerIds = policyHolders
      .map(ph => {
        const n = parseInt(ph.customerId, 10);
        return isNaN(n) ? null : n;
      })
      .filter((v) => v !== null) as number[];

    const customers = numericCustomerIds.length > 0
      ? await db.customer.findMany({ where: { id: { in: numericCustomerIds } }, include: { user: true } })
      : [];
    const customerMap = Object.fromEntries(customers.map(c => [String(c.id), c]));

    const enriched = policyHolders.map(ph => ({
      ...ph,
      customer: customerMap[ph.customerId] || null,
      policy: ph.policy ? { ...ph.policy, category: categoryMap[ph.policy.categoryId] || null } : ph.policy,
    }));

    return NextResponse.json({ policyHolders: enriched });
  } catch (error: any) {
    console.error('Get policy holders error:', error);
    return NextResponse.json({ error: 'Internal server error', message: error?.message, stack: process.env.NODE_ENV === 'production' ? undefined : error?.stack }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const authOrResp = await requireRole(request, Roles.ADMIN);
  if ((authOrResp as any).status) return authOrResp as NextResponse;
  try {
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'ID and status are required' }, { status: 400 });
    }

    if (!['Approved', 'Disapproved'].includes(status)) {
      return NextResponse.json({ error: 'Status must be Approved or Disapproved' }, { status: 400 });
    }

    const record = await db.policyRecord.findUnique({ where: { id } });
    if (!record) {
      return NextResponse.json({ error: 'Policy record not found' }, { status: 404 });
    }

    const updatedRecord = await db.policyRecord.update({
      where: { id },
      data: { status },
      include: {
        policy: true,
      },
    });

    await logAction({
      entityType: 'PolicyRecord',
      entityId: parseInt(id) || 0,
      actorId: (authOrResp as any).userIdNum,
      action: `STATUS_${status.toUpperCase()}`,
      actionCategory: 'ADMIN',
      oldValues: { status: record.status },
      newValues: { status },
      requestPath: '/api/admin/policy-holders',
    });

    // Resolve category separately
    let resolvedCategory: any = null;
    if (updatedRecord.policy?.categoryId) {
      resolvedCategory = await db.category.findUnique({
        where: { id: parseInt(updatedRecord.policy.categoryId, 10) },
      }).catch(() => null);
    }

    const enrichedRecord = {
      ...updatedRecord,
      policy: updatedRecord.policy
        ? { ...updatedRecord.policy, category: resolvedCategory }
        : updatedRecord.policy,
    };

    return NextResponse.json({ policyHolder: enrichedRecord });
  } catch (error: any) {
    console.error('Update policy holder error:', error);
    return NextResponse.json({ error: 'Internal server error', message: error?.message, stack: process.env.NODE_ENV === 'production' ? undefined : error?.stack }, { status: 500 });
  }
}


