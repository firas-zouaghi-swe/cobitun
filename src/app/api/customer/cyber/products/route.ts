import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/services/authorization';

export async function GET(request: NextRequest) {
  const authOrResp = await requireAuth(request);
  if (authOrResp instanceof NextResponse) return authOrResp;

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

    const parsed = products.map((product) => ({
      ...product,
      masterDeductibleSIR: product.masterDeductibleSir ? Number(product.masterDeductibleSir) : null,
      coverageGrants: product.coverageGrants.map((cg) => ({
        id: cg.id,
        code: cg.coverageCode,
        name: cg.coverageName,
        description: `Sub-limit: ${cg.subLimitDefault ? (Number(cg.subLimitDefault).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })) : 'Unlimited'} TND`,
        subLimitDefault: cg.subLimitDefault ? Number(cg.subLimitDefault) : null,
        waitingPeriodHours: cg.waitingPeriodHours,
        specialConditions: null,
        exclusions: cg.exclusionsJson ? JSON.parse(cg.exclusionsJson) : [],
      })),
      exclusions: product.exclusions.map((ex) => ({
        id: ex.id,
        code: ex.exclusionCode,
        name: ex.exclusionName,
        description: ex.description,
      })),
      underwritingQuestions: product.underwritingQuestions.map((q) => ({
        id: q.id,
        field: q.fieldName,
        question: q.questionText,
        type: q.questionType?.typeCode || 'text',
        options: q.optionsJson ? JSON.parse(q.optionsJson) : [],
        required: q.isRequired === 1,
        expectedAnswer: q.expectedAnswer,
        sortOrder: q.sortOrder,
      })),
    }));

    return NextResponse.json({ products: parsed });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
