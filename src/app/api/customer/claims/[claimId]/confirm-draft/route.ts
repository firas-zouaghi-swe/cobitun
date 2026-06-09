
/**
 * Customer Confirm Draft Claim API
 * POST - Customer confirms a DRAFT claim to file it (DRAFT → SUBMITTED)
 * DELETE - Customer dismisses a DRAFT claim
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { db } from '@/lib/db';
import { Errors, errorResponse } from '@/middleware/validation';
import { logAction } from '@/lib/services/audit-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ claimId: string }> }
) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'CUSTOMER') return Errors.forbidden();

  const { claimId } = await params;
  const claimIdNum = parseInt(claimId, 10);
  if (isNaN(claimIdNum)) return Errors.notFound('Claim');

  try {
    const claim = await db.parametricClaim.findFirst({
      where: { id: claimIdNum, isDeleted: 0 },
      include: { status: true },
    });

    if (!claim) return Errors.notFound('Claim');
    const customer = await db.customer.findUnique({ where: { userId: auth.userIdNum } });
    if (!customer) return Errors.forbidden();
    if (claim.customerId !== customer.id) return Errors.forbidden();
    if (claim.status?.statusCode !== 'DRAFT') {
      return errorResponse('Only DRAFT claims can be confirmed', 'INVALID_STATUS', 409);
    }

    // Find SUBMITTED status
    const submittedStatus = await db.enumParamClaimStatus.findFirst({ where: { statusCode: 'SUBMITTED', isCurrent: 1 } });
    if (!submittedStatus) return Errors.internal();

    await db.parametricClaim.update({
      where: { id: claimIdNum },
      data: {
        statusId: submittedStatus.id,
        updatedAt: new Date(),
      },
    });

    await logAction({
      entityType: 'ParametricClaim',
      entityId: claimIdNum,
      action: 'CONFIRM_DRAFT_CLAIM',
      actorId: auth.userIdNum,
      actorType: 'CUSTOMER',
      metadata: { claimNumber: claim.claimNumber },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json({
      message: 'Draft claim confirmed and submitted',
      claimId: claimIdNum,
      status: 'SUBMITTED',
    });
  } catch (error) {
    console.error('Failed to confirm draft claim', error);
    return Errors.internal();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ claimId: string }> }
) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'CUSTOMER') return Errors.forbidden();

  const { claimId } = await params;
  const claimIdNum = parseInt(claimId, 10);
  if (isNaN(claimIdNum)) return Errors.notFound('Claim');

  try {
    const claim = await db.parametricClaim.findFirst({
      where: { id: claimIdNum, isDeleted: 0 },
      include: { status: true },
    });

    if (!claim) return Errors.notFound('Claim');
    const customer = await db.customer.findUnique({ where: { userId: auth.userIdNum } });
    if (!customer) return Errors.forbidden();
    if (claim.customerId !== customer.id) return Errors.forbidden();
    if (claim.status?.statusCode !== 'DRAFT') {
      return errorResponse('Only DRAFT claims can be dismissed', 'INVALID_STATUS', 409);
    }

    await db.parametricClaim.update({
      where: { id: claimIdNum },
      data: {
        isDeleted: 1,
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ message: 'Draft claim dismissed', claimId: claimIdNum });
  } catch (error) {
    console.error('Failed to dismiss draft claim', error);
    return Errors.internal();
  }
}

