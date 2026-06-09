import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getAuthInfo, isAdmin, AuthInfo } from '@/lib/services/auth-helper';
import { requireRole, Roles } from '@/lib/services/authorization';
import { logAction } from '@/lib/services/audit-service';

const providerCreateSchema = z.object({
  asn: z.number().int().positive(),
  organisationName: z.string().min(1).max(200),
  slaTierId: z.union([z.number().int().positive(), z.string().min(1)]).optional(),
  riskScore: z.number().min(0).max(100).optional(),
  premiumFactor: z.number().positive().optional(),
  iodaName: z.string().max(200).optional(),
  isVerified: z.union([z.boolean(), z.number().int().min(0).max(1)]).optional(),
});

const providerUpdateSchema = z.object({
  id: z.number().int().positive(),
  organisationName: z.string().min(1).max(200).optional(),
  slaTierId: z.union([z.number().int().positive(), z.string().min(1)]).optional(),
  riskScore: z.number().min(0).max(100).optional(),
  premiumFactor: z.number().positive().optional(),
  isVerified: z.union([z.boolean(), z.number().int().min(0).max(1)]).optional(),
  isActive: z.union([z.boolean(), z.number().int().min(0).max(1)]).optional(),
  iodaName: z.string().max(200).optional(),
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
        { organisationName: { contains: search } },
        { iodaName: { contains: search } },
        { asn: { contains: search } },
      ];
    }

    const providers = await db.cloudProvider.findMany({
      where,
      orderBy: { asn: 'asc' },
      include: {
        slaTier: {
          select: { id: true, tierCode: true, tierName: true, mttrHours: true, thresholdHours: true, basePremiumFactor: true },
        },
        _count: { select: { outageEvents: true, parametricPolicies: true } },
      },
    });
    return NextResponse.json({ providers });
  } catch (error) {
    console.error('Get cloud providers error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authOrResp = await requireRole(request, Roles.ADMIN);
    if ((authOrResp as any).status) return authOrResp as NextResponse;
    const auth = authOrResp as AuthInfo;

    const body = await request.json();
    const parsed = providerCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const { asn, organisationName, slaTierId, riskScore, premiumFactor, iodaName, isVerified } = parsed.data;

    // Look up SLA tier by ID or tierCode
    let resolvedSlaTierId: number;
    if (slaTierId) {
      const slaTier = await db.enumSlaTier.findFirst({
        where: {
          id: typeof slaTierId === 'number' ? slaTierId : undefined,
          tierCode: typeof slaTierId === 'string' ? slaTierId : undefined,
          isCurrent: 1,
        },
      });
      if (!slaTier) {
        return NextResponse.json({ error: 'SLA tier not found' }, { status: 400 });
      }
      resolvedSlaTierId = slaTier.id;
    } else {
      // Default to Bronze
      const bronze = await db.enumSlaTier.findFirst({
        where: { tierCode: 'Bronze', isCurrent: 1 },
      });
      if (!bronze) {
        return NextResponse.json({ error: 'Default SLA tier (Bronze) not found' }, { status: 500 });
      }
      resolvedSlaTierId = bronze.id;
    }

    // Get MTTR from SLA tier
    const slaTier = await db.enumSlaTier.findUnique({ where: { id: resolvedSlaTierId } });
    const mttrHours = Number(slaTier?.mttrHours) || 16.0;

    const existing = await db.cloudProvider.findUnique({ where: { asn: String(asn) } });
    if (existing) {
      return NextResponse.json({ error: 'Provider with this ASN already exists' }, { status: 400 });
    }

    const isVerifiedNum = typeof isVerified === 'boolean'
      ? (isVerified ? 1 : 0)
      : (isVerified !== undefined ? Number(isVerified) : 0);

    const provider = await db.cloudProvider.create({
      data: {
        asn: String(asn),
        organisationName,
        iodaName: iodaName || null,
        slaTierId: resolvedSlaTierId,
        mttrHours,
        riskScore: riskScore || 0,
        premiumFactor: premiumFactor || 1.0,
        isVerified: isVerifiedNum,
        isActive: 1,
        createdBy: auth.userIdNum,
      },
      include: {
        slaTier: {
          select: { id: true, tierCode: true, tierName: true, mttrHours: true },
        },
      },
    });

    // Audit
    await logAction({
      entityType: 'CloudProvider',
      entityId: provider.id,
      actorId: auth.userIdNum,
      action: 'CREATE',
      actionCategory: 'ADMIN',
      newValues: { asn: String(asn), organisationName, slaTierId: resolvedSlaTierId },
      requestPath: '/api/admin/cloud-providers',
    });

    return NextResponse.json({ provider });
  } catch (error) {
    console.error('Create cloud provider error:', error);
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
    const parsed = providerUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const { id, organisationName, slaTierId, riskScore, premiumFactor, isActive, iodaName, isVerified } = parsed.data;

    const provider = await db.cloudProvider.findUnique({ where: { id } });
    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }

    // Resolve SLA tier if provided
    let resolvedSlaTierId: number | undefined;
    let mttrHours: number | undefined;
    if (slaTierId !== undefined) {
      const slaTier = await db.enumSlaTier.findFirst({
        where: {
          id: typeof slaTierId === 'number' ? slaTierId : undefined,
          tierCode: typeof slaTierId === 'string' ? slaTierId : undefined,
          isCurrent: 1,
        },
      });
      if (slaTier) {
        resolvedSlaTierId = slaTier.id;
        mttrHours = Number(slaTier.mttrHours);
      }
    }

    const isVerifiedNumUpdate = typeof isVerified === 'boolean'
      ? (isVerified ? 1 : 0)
      : (isVerified !== undefined ? Number(isVerified) : undefined as any);
    const isActiveNumUpdate = typeof isActive === 'boolean'
      ? (isActive ? 1 : 0)
      : (isActive !== undefined ? Number(isActive) : undefined as any);

    const updated = await db.cloudProvider.update({
      where: { id },
      data: {
        organisationName: organisationName ?? provider.organisationName,
        slaTierId: resolvedSlaTierId ?? provider.slaTierId,
        mttrHours: mttrHours ?? provider.mttrHours,
        riskScore: riskScore !== undefined ? riskScore : provider.riskScore,
        premiumFactor: premiumFactor !== undefined ? premiumFactor : provider.premiumFactor,
        isVerified: isVerifiedNumUpdate !== undefined ? isVerifiedNumUpdate : provider.isVerified,
        isActive: isActiveNumUpdate !== undefined ? isActiveNumUpdate : provider.isActive,
        iodaName: iodaName ?? provider.iodaName,
        updatedBy: auth!.userIdNum,
      },
      include: {
        slaTier: {
          select: { id: true, tierCode: true, tierName: true, mttrHours: true },
        },
      },
    });

    // Audit
    await logAction({
      entityType: 'CloudProvider',
      entityId: id,
      actorId: auth!.userIdNum,
      action: 'UPDATE',
      actionCategory: 'ADMIN',
      newValues: { organisationName, slaTierId: resolvedSlaTierId, isActive },
      requestPath: '/api/admin/cloud-providers',
    });

    return NextResponse.json({ provider: updated });
  } catch (error) {
    console.error('Update cloud provider error:', error);
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
      return NextResponse.json({ error: 'Provider ID is required' }, { status: 400 });
    }

    const id = parseInt(idStr, 10);
    const provider = await db.cloudProvider.findUnique({ where: { id } });
    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }

    // Soft delete
    await db.cloudProvider.update({
      where: { id },
      data: {
        isDeleted: 1,
        deletedAt: new Date(),
        deletedBy: auth!.userIdNum,
        isActive: 0,
      },
    });

    // Audit
    await logAction({
      entityType: 'CloudProvider',
      entityId: id,
      actorId: auth!.userIdNum,
      action: 'DELETE',
      actionCategory: 'ADMIN',
      oldValues: { asn: provider.asn, organisationName: provider.organisationName },
      requestPath: '/api/admin/cloud-providers',
    });

    return NextResponse.json({ message: 'Cloud provider deleted successfully' });
  } catch (error) {
    console.error('Delete cloud provider error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}



