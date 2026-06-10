import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthInfo, AuthInfo } from '@/lib/services/auth-helper';
import { requireAuth, isOwnerOrAdminAsync } from '@/lib/services/authorization';

export async function GET() {
  try {
    const policies = await db.policy.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const categories = await db.category.findMany({
      orderBy: { categoryName: 'asc' },
    });

    const enrichedPolicies = policies.map((policy) => ({
      ...policy,
      category: categories.find((cat) => String(cat.id) === policy.categoryId) ?? null,
    }));

    return NextResponse.json({ policies: enrichedPolicies, categories });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authOrResp = await requireAuth(request);
    if (authOrResp instanceof NextResponse) return authOrResp;
    const auth = authOrResp as AuthInfo;

    const currentUser = await db.user.findUnique({
      where: { id: auth.userIdNum },
      select: { emailVerified: true },
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'Authenticated user not found' }, { status: 404 });
    }

    // In development mode skip the email-verified gate to simplify testing.
    if (auth.role !== 'ADMIN' && process.env.NODE_ENV === 'production' && currentUser.emailVerified !== 1) {
      return NextResponse.json({ error: 'Email verification required before applying for a policy' }, { status: 403 });
    }

    const body = await request.json();
    const { customerId, policyId } = body;

    if (!customerId || !policyId) {
      return NextResponse.json({ error: 'Customer ID and Policy ID are required' }, { status: 400 });
    }

    // Legacy: customerId is kept as string for PolicyRecord compatibility
    const customer = await db.customer.findUnique({ where: { id: parseInt(customerId, 10) || 0 } });
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }
    if (!(await isOwnerOrAdminAsync(auth, customer.id))) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const policy = await db.policy.findUnique({ where: { id: String(policyId) } });
    if (!policy) {
      return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
    }

    // Check if already applied
    const existingRecord = await db.policyRecord.findFirst({
      where: { customerId: String(customerId), policyId: String(policyId) },
    });

    if (existingRecord) {
      return NextResponse.json({ error: 'You have already applied for this policy' }, { status: 400 });
    }

    const record = await db.policyRecord.create({
      data: {
        customerId: String(customerId),
        policyId: String(policyId),
        status: 'Pending',
      },
      include: {
        policy: true,
      },
    });

    return NextResponse.json({ record });
  } catch (error) {
    console.error('Apply policy error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

