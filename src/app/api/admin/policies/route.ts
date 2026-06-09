import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole, Roles } from '@/lib/services/authorization';
import { logAction } from '@/lib/services/audit-service';

export async function GET(request: NextRequest) {
  const authOrResp = await requireRole(request, Roles.ADMIN);
  if ((authOrResp as any).status) return authOrResp as NextResponse;
  try {
    const policies = await db.policy.findMany({
      where: { isDeleted: 0 },
      include: { _count: { select: { records: true } } },
      orderBy: { createdAt: 'desc' },
    });

    // Resolve categories separately (Policy.categoryId is String, Category.id is Int — no FK relation)
    const categoryIds = [...new Set(policies.map(p => p.categoryId).filter(Boolean))];
    const categories = categoryIds.length > 0
      ? await db.category.findMany({ where: { id: { in: categoryIds.map(Number).filter(n => !isNaN(n)) } } })
      : [];
    const categoryMap = Object.fromEntries(categories.map(c => [String(c.id), c]));

    const policiesWithCategory = policies.map(p => ({
      ...p,
      category: categoryMap[p.categoryId] || null,
    }));

    return NextResponse.json({ policies: policiesWithCategory });
  } catch (error) {
    console.error('Get policies error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authOrResp = await requireRole(request, Roles.ADMIN);
  if ((authOrResp as any).status) return authOrResp as NextResponse;
  try {
    const body = await request.json();
    const { policyName, categoryId, sumAssurance, premium, tenure } = body;

    if (!policyName || !categoryId || !sumAssurance || !premium || !tenure) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    const parsedCategoryId = parseInt(categoryId, 10);
    const existingCategory = await db.category.findUnique({ where: { id: parsedCategoryId } });
    if (!existingCategory) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const policy = await db.policy.create({
      data: {
        policyName,
        categoryId,
        sumAssurance: parseInt(sumAssurance),
        premium: parseInt(premium),
        tenure: parseInt(tenure),
      },
    });

    await logAction({
      entityType: 'Policy',
      entityId: parseInt(policy.id) || 0,
      actorId: (authOrResp as any).userIdNum,
      action: 'CREATE',
      actionCategory: 'ADMIN',
      newValues: { policyName, categoryId, sumAssurance, premium, tenure },
      requestPath: '/api/admin/policies',
    });

    return NextResponse.json({ policy: { ...policy, category: existingCategory } });
  } catch (error) {
    console.error('Create policy error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const authOrResp = await requireRole(request, Roles.ADMIN);
  if ((authOrResp as any).status) return authOrResp as NextResponse;
  try {
    const body = await request.json();
    const { id, policyName, categoryId, sumAssurance, premium, tenure } = body;

    if (!id) {
      return NextResponse.json({ error: 'Policy ID is required' }, { status: 400 });
    }

    const policy = await db.policy.findUnique({ where: { id } });
    if (!policy) {
      return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
    }

    const updatedPolicy = await db.policy.update({
      where: { id },
      data: {
        policyName: policyName || policy.policyName,
        categoryId: categoryId || policy.categoryId,
        sumAssurance: sumAssurance ? parseInt(sumAssurance) : policy.sumAssurance,
        premium: premium ? parseInt(premium) : policy.premium,
        tenure: tenure ? parseInt(tenure) : policy.tenure,
      },
    });

    const resolvedCategory = await db.category.findUnique({ where: { id: parseInt(updatedPolicy.categoryId, 10) } }).catch(() => null);

    await logAction({
      entityType: 'Policy',
      entityId: parseInt(updatedPolicy.id) || 0,
      actorId: (authOrResp as any).userIdNum,
      action: 'UPDATE',
      actionCategory: 'ADMIN',
      oldValues: { policyName: policy.policyName, categoryId: policy.categoryId },
      newValues: { policyName: updatedPolicy.policyName, categoryId: updatedPolicy.categoryId },
      requestPath: '/api/admin/policies',
    });

    return NextResponse.json({ policy: { ...updatedPolicy, category: resolvedCategory } });
  } catch (error) {
    console.error('Update policy error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const authOrResp = await requireRole(request, Roles.ADMIN);
  if ((authOrResp as any).status) return authOrResp as NextResponse;
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Policy ID is required' }, { status: 400 });
    }

    const policy = await db.policy.findUnique({ where: { id } });
    if (!policy) {
      return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
    }

    if (policy.isDeleted) {
      return NextResponse.json({ error: 'Policy already deleted' }, { status: 400 });
    }

    // Soft delete consistent with all other routes
    await db.policy.update({
      where: { id },
      data: {
        isDeleted: 1,
        deletedAt: new Date(),
      },
    });

    await logAction({
      entityType: 'Policy',
      entityId: parseInt(id) || 0,
      actorId: (authOrResp as any).userIdNum,
      action: 'DELETE',
      actionCategory: 'ADMIN',
      oldValues: { policyName: policy.policyName, categoryId: policy.categoryId },
      requestPath: '/api/admin/policies',
    });

    return NextResponse.json({ message: 'Policy deleted successfully' });
  } catch (error) {
    console.error('Delete policy error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


