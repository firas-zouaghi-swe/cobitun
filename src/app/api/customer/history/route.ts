import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthInfo, verifyCustomerOwnership, AuthInfo } from '@/lib/services/auth-helper';
import { requireAuth } from '@/lib/services/authorization';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerIdParam = searchParams.get('customerId');
    const parsedCustomerId = customerIdParam ? parseInt(customerIdParam, 10) : undefined;

    const authOrResp = await requireAuth(request);
    if ((authOrResp as any).status) return authOrResp as NextResponse;
    const auth = authOrResp as AuthInfo;

    const effectiveCustomerId = await verifyCustomerOwnership(auth, parsedCustomerId);
    if (!effectiveCustomerId) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    // Legacy PolicyRecord - customerId stored as string
    const records = await db.policyRecord.findMany({
      where: { customerId: String(effectiveCustomerId) },
      include: {
        policy: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Resolve categories separately (Policy.categoryId is String, Category.id is Int - no FK relation)
    const categoryIds = [...new Set(records.map(r => r.policy?.categoryId).filter(Boolean))];
    const categories = categoryIds.length > 0
      ? await db.category.findMany({ where: { id: { in: categoryIds.map(Number).filter(n => !isNaN(n)) } } })
      : [];
    const categoryMap = Object.fromEntries(categories.map(c => [String(c.id), c]));

    const enriched = records.map(r => ({
      ...r,
      policy: r.policy ? { ...r.policy, category: categoryMap[r.policy.categoryId] || null } : r.policy,
    }));

    return NextResponse.json({ records: enriched });
  } catch (error) {
    console.error('Get history error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

