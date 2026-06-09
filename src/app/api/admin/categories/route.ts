import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getAuthInfo, isAdmin, AuthInfo } from '@/lib/services/auth-helper';
import { requireRole, Roles } from '@/lib/services/authorization';
import { logAction } from '@/lib/services/audit-service';

const categoryCreateSchema = z.object({
  categoryName: z.string().min(1).max(100),
  categoryNameAr: z.string().max(100).optional(),
  code: z.string().min(1).max(50),
  description: z.string().max(500).optional(),
  descriptionAr: z.string().max(500).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const categoryUpdateSchema = z.object({
  id: z.number().int().positive(),
  categoryName: z.string().min(1).max(100).optional(),
  categoryNameAr: z.string().max(100).optional(),
  code: z.string().min(1).max(50).optional(),
  description: z.string().max(500).optional(),
  descriptionAr: z.string().max(500).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.number().int().min(0).max(1).optional(),
});

export async function GET(request: NextRequest) {
  const authOrResp = await requireRole(request, Roles.ADMIN);
  if ((authOrResp as any).status) return authOrResp as NextResponse;

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    const where: Record<string, unknown> = { isDeleted: 0 };

    if (search) {
      where.OR = [
        { categoryName: { contains: search } },
        { code: { contains: search } },
      ];
    }

    const categories = await db.category.findMany({
      where,
      include: { _count: { select: { products: true } } },
      orderBy: { sortOrder: 'asc' },
    });
    return NextResponse.json({ categories });
  } catch (error) {
    console.error('Get categories error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authOrResp = await requireRole(request, Roles.ADMIN);
      if ((authOrResp as any).status) return authOrResp as NextResponse;
    const auth = authOrResp as AuthInfo;

    const body = await request.json();
    const parsed = categoryCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const { categoryName, categoryNameAr, code, description, descriptionAr, sortOrder } = parsed.data;

    const category = await db.category.create({
      data: {
        code,
        categoryName,
        categoryNameAr: categoryNameAr || null,
        description: description || null,
        descriptionAr: descriptionAr || null,
        sortOrder: sortOrder || 0,
        createdBy: auth.userIdNum,
      },
    });

    // Audit
    await logAction({
      entityType: 'Category',
      entityId: category.id,
      actorId: auth.userIdNum,
      action: 'CREATE',
      actionCategory: 'ADMIN',
      newValues: { code, categoryName, sortOrder },
      requestPath: '/api/admin/categories',
    });

    return NextResponse.json({ category });
  } catch (error) {
    console.error('Create category error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthInfo(request);
    if (!auth || !isAdmin(auth)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = categoryUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const { id, categoryName, categoryNameAr, code, description, descriptionAr, sortOrder, isActive } = parsed.data;

    const category = await db.category.findUnique({ where: { id } });
    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = { categoryName, updatedBy: auth!.userIdNum };
    if (code) updateData.code = code;
    if (categoryNameAr !== undefined) updateData.categoryNameAr = categoryNameAr;
    if (description !== undefined) updateData.description = description;
    if (descriptionAr !== undefined) updateData.descriptionAr = descriptionAr;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedCategory = await db.category.update({
      where: { id },
      data: updateData,
    });

    // Audit
    await logAction({
      entityType: 'Category',
      entityId: id,
      actorId: auth!.userIdNum,
      action: 'UPDATE',
      actionCategory: 'ADMIN',
      oldValues: { categoryName: category.categoryName, code: category.code },
      newValues: updateData,
      requestPath: '/api/admin/categories',
    });

    return NextResponse.json({ category: updatedCategory });
  } catch (error) {
    console.error('Update category error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuthInfo(request);
    if (!auth || !isAdmin(auth)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const idStr = searchParams.get('id');

    if (!idStr) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
    }

    const id = parseInt(idStr, 10);
    const category = await db.category.findUnique({ where: { id } });
    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    // Soft delete
    await db.category.update({
      where: { id },
      data: {
        isDeleted: 1,
        deletedAt: new Date(),
        deletedBy: auth!.userIdNum,
      },
    });

    // Audit
    await logAction({
      entityType: 'Category',
      entityId: id,
      actorId: auth!.userIdNum,
      action: 'DELETE',
      actionCategory: 'ADMIN',
      oldValues: { categoryName: category.categoryName, code: category.code },
      requestPath: '/api/admin/categories',
    });

    return NextResponse.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Delete category error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}



