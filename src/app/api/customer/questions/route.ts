import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { verifyCustomerOwnership, AuthInfo } from '@/lib/services/auth-helper';
import { requireAuth } from '@/lib/services/authorization';

const questionSchema = z.object({
  customerId: z.number().int().positive(),
  category: z.string().min(1).max(50),
  subject: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const authOrResp = await requireAuth(request);
    if ((authOrResp as any).status) return authOrResp as NextResponse;
    const auth = authOrResp as AuthInfo;

    const { searchParams } = new URL(request.url);
    const customerIdParam = searchParams.get('customerId');
    const parsedCustomerId = customerIdParam ? parseInt(customerIdParam, 10) : undefined;

    const effectiveCustomerId = await verifyCustomerOwnership(auth, parsedCustomerId);
    if (!effectiveCustomerId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // v3: CustomerQuestion model (renamed from Question)
    const questions = await db.customerQuestion.findMany({
      where: { customerId: effectiveCustomerId, isDeleted: 0 },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ questions });
  } catch (error) {
    console.error('Get questions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authOrResp = await requireAuth(request);
    if ((authOrResp as any).status) return authOrResp as NextResponse;
    const auth = authOrResp as AuthInfo;

    const body = await request.json();
    const parsed = questionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const { customerId, category, subject, description, priority } = parsed.data;

    const customer = await db.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }
    const effectiveCustomerId = await verifyCustomerOwnership(auth, customerId);
    if (!effectiveCustomerId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // v3: CustomerQuestion with new fields: category, subject, description, priority, status
    const question = await db.customerQuestion.create({
      data: {
        customerId,
        category,
        subject,
        description,
        priority: priority || 'MEDIUM',
        status: 'OPEN',
      },
    });

    return NextResponse.json({ question });
  } catch (error) {
    console.error('Create question error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

