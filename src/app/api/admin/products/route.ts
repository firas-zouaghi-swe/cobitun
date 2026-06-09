import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole, Roles } from '@/lib/services/authorization';

export async function GET(request: NextRequest) {
  const authOrResp = await requireRole(request, Roles.ADMIN);
  if ((authOrResp as any).status) return authOrResp as NextResponse;
  try {
    const { searchParams } = new URL(request.url);
    const productTypeId = searchParams.get('productTypeId');
    const productCode = searchParams.get('productCode');

    const where: Record<string, unknown> = { isActive: 1, isDeleted: 0 };

    if (productTypeId) {
      where.productTypeId = parseInt(productTypeId, 10);
    }
    if (productCode) {
      where.productCode = productCode;
    }

    const products = await db.product.findMany({
      where,
      include: {
        category: true,
        productType: { select: { id: true, typeCode: true, typeName: true } },
        coverageGrants: {
          where: { isDeleted: 0 },
          orderBy: { sortOrder: 'asc' },
        },
        exclusions: {
          where: { isDeleted: 0 },
          orderBy: { exclusionCode: 'asc' },
        },
        underwritingQuestions: {
          where: { isDeleted: 0 },
          include: {
            questionType: { select: { id: true, typeCode: true, typeName: true } },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { productName: 'asc' },
    });

    // Parse JSON fields for easier consumption
    const parsed = products.map((product) => ({
      ...product,
      coverageGrants: product.coverageGrants.map((cg) => ({
        ...cg,
        exclusions: JSON.parse(cg.exclusionsJson),
      })),
      underwritingQuestions: product.underwritingQuestions.map((q) => ({
        ...q,
        options: q.optionsJson ? JSON.parse(q.optionsJson) : [],
      })),
    }));

    return NextResponse.json({ products: parsed });
  } catch (error) {
    console.error('Get active products error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


