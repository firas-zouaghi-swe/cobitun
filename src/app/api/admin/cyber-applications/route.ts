import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole, Roles } from '@/lib/services/authorization';

export async function GET(request: NextRequest) {
  const authOrResp = await requireRole(request, Roles.ADMIN);
  if ((authOrResp as any).status) return authOrResp as NextResponse;

  try {
    const { searchParams } = new URL(request.url);
    const statusCode = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10')));
    const skip = (page - 1) * limit;

    // Build where clause using statusId FK
    const where: Record<string, unknown> = { isDeleted: 0 };

    if (statusCode) {
      // Look up status by statusCode to get the ID
      const statusRecord = await db.enumCyberAppStatus.findFirst({
        where: { statusCode, isCurrent: 1 },
        select: { id: true },
      });
      if (statusRecord) {
        where.statusId = statusRecord.id;
      }
    }

    const [applications, total] = await Promise.all([
      db.cyberApplication.findMany({
        where,
        skip,
        take: limit,
        include: {
          customer: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
          product: {
            include: {
              category: true,
              coverageGrants: { where: { isDeleted: 0 }, orderBy: { sortOrder: 'asc' } },
              exclusions: { where: { isDeleted: 0 }, orderBy: { exclusionCode: 'asc' } },
            },
          },
          securityPosture: { select: { id: true, postureCode: true, postureName: true, riskMultiplier: true } },
          status: { select: { id: true, statusCode: true, statusName: true } },
          cyberPolicy: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.cyberApplication.count({ where }),
    ]);

    // Parse JSON fields for easier consumption
    const parsed = applications.map((app) => ({
      ...app,
      answers: JSON.parse(app.answersJson),
      waiverFlags: JSON.parse(app.waiverFlagsJson),
      selectedCoverages: JSON.parse(app.selectedCoveragesJson),
      product: {
        ...app.product,
        coverageGrants: app.product.coverageGrants.map((cg) => ({
          ...cg,
          exclusions: JSON.parse(cg.exclusionsJson),
        })),
      },
    }));

    return NextResponse.json({
      applications: parsed,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Get cyber applications error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


