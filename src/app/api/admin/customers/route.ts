import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, safeTransaction } from '@/lib/db';
import { requireRole, Roles } from '@/lib/services/authorization';
import { logAction } from '@/lib/services/audit-service';

const customerUpdateSchema = z.object({
  id: z.number().int().positive(),
  companyName: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  mobile: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  sectorId: z.union([z.number().int().positive(), z.string()]).optional(),
  businessModelId: z.union([z.number().int().positive(), z.string()]).optional(),
  registrationNumber: z.string().max(100).optional(),
  taxId: z.string().max(100).optional(),
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
        { companyName: { contains: search } },
        { user: { firstName: { contains: search } } },
        { user: { lastName: { contains: search } } },
        { user: { email: { contains: search } } },
      ];
    }

    const customers = await db.customer.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true,
            roleId: true,
            role: { select: { roleCode: true, roleName: true } },
          },
        },
        sector: { select: { id: true, sectorCode: true, sectorName: true } },
        businessModel: { select: { id: true, modelCode: true, modelName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ customers });
  } catch (error) {
    console.error('Get customers error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const authOrResp = await requireRole(request, Roles.ADMIN);
  if ((authOrResp as any).status) return authOrResp as NextResponse;
  try {
    const body = await request.json();
    const parsed = customerUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const { id, firstName, lastName, mobile, address, email, companyName, sectorId, businessModelId, registrationNumber, taxId } = parsed.data;

    const customer = await db.customer.findUnique({ where: { id }, include: { user: true } });
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Update user info
    await db.user.update({
      where: { id: customer.userId },
      data: {
        firstName: firstName || customer.user.firstName,
        lastName: lastName || customer.user.lastName,
        email: email !== undefined ? email : customer.user.email,
      },
    });

    // Update customer info
    const updatedCustomer = await db.customer.update({
      where: { id },
      data: {
        mobile: mobile || customer.mobile,
        address: address || customer.address,
        companyName: companyName || customer.companyName,
        sectorId: sectorId !== undefined ? (sectorId ? parseInt(String(sectorId), 10) : null) : customer.sectorId,
        businessModelId: businessModelId !== undefined ? (businessModelId ? parseInt(String(businessModelId), 10) : null) : customer.businessModelId,
        registrationNumber: registrationNumber !== undefined ? registrationNumber : customer.registrationNumber,
        taxId: taxId !== undefined ? taxId : customer.taxId,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true,
            roleId: true,
            role: { select: { roleCode: true, roleName: true } },
          },
        },
        sector: { select: { id: true, sectorCode: true, sectorName: true } },
        businessModel: { select: { id: true, modelCode: true, modelName: true } },
      },
    });

    return NextResponse.json({ customer: updatedCustomer });
  } catch (error) {
    console.error('Update customer error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const authOrResp = await requireRole(request, Roles.ADMIN);
  if ((authOrResp as any).status) return authOrResp as NextResponse;
  try {
    const { searchParams } = new URL(request.url);
    const idStr = searchParams.get('id');

    if (!idStr) {
      return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 });
    }

    const id = parseInt(idStr, 10);
    const customer = await db.customer.findUnique({ where: { id } });
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Soft-delete customer and associated user in a transaction
    const result = await safeTransaction(async (tx) => {
      await tx.customer.update({
        where: { id },
        data: {
          isDeleted: 1,
          deletedAt: new Date(),
        },
      });

      await tx.user.update({
        where: { id: customer.userId },
        data: {
          isDeleted: 1,
          deletedAt: new Date(),
          isActive: 0,
        },
      });

      return { ok: true };
    });

    await logAction({
      entityType: 'Customer',
      entityId: id,
      actorId: (authOrResp as any).userIdNum,
      action: 'DELETE',
      actionCategory: 'ADMIN',
      oldValues: { companyName: customer.companyName },
      requestPath: '/api/admin/customers',
    });

    return NextResponse.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Delete customer error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


