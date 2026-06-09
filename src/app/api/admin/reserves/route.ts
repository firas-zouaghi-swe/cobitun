
/**
 * Reserve Management API
 * GET  - Get reserve status for claims
 * POST - Adjust reserves / Request actuary approval
 *
 * Uses ParametricClaimReserve which has:
 *   reserveType, reserveAmount, adjustmentReason, actuarialMethod, confidenceLevel
 *   (no status/approvedBy/approvedAt fields - use adjustmentReason for tracking)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { db } from '@/lib/db';
import { Errors, errorResponse, validateRequestBody } from '@/middleware/validation';
import { z } from 'zod';
import { logAction } from '@/lib/services/audit-service';

const adjustReserveSchema = z.object({
  claimId: z.number().int().positive(),
  reserveAmount: z.number().positive(),
  reason: z.string().min(1).max(500),
  requiresActuaryApproval: z.boolean().default(false),
});

const approveReserveSchema = z.object({
  reserveId: z.number().int().positive(),
  approved: z.boolean(),
  notes: z.string().max(1000).optional(),
});

export async function GET(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'summary';
    const claimId = parseInt(url.searchParams.get('claimId') || '0', 10);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));

    if (action === 'claim' && claimId) {
      const reserves = await db.parametricClaimReserve.findMany({
        where: { parametricClaimId: claimId, isDeleted: 0 },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json({
        claimId,
        reserves: reserves.map((r) => ({
          id: r.id,
          reserveAmount: Number(r.reserveAmount || 0),
          reserveType: r.reserveType,
          reason: r.adjustmentReason,
          actuarialMethod: r.actuarialMethod,
          confidenceLevel: r.confidenceLevel ? Number(r.confidenceLevel) : null,
          createdAt: r.createdAt?.toISOString(),
        })),
        totalReserved: reserves.reduce((sum, r) => sum + Number(r.reserveAmount || 0), 0),
      });
    }

    if (action === 'pending_approval') {
      const pending = await db.parametricClaimReserve.findMany({
        where: { reserveType: 'PENDING_APPROVAL', isDeleted: 0 },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          parametricClaim: { select: { id: true, claimNumber: true, payoutAmount: true } },
        },
      });

      return NextResponse.json({
        pendingApprovals: pending.map((r) => ({
          id: r.id,
          claimId: r.parametricClaimId,
          claimNumber: r.parametricClaim?.claimNumber,
          reserveAmount: Number(r.reserveAmount || 0),
          reason: r.adjustmentReason,
          createdAt: r.createdAt?.toISOString(),
        })),
      });
    }

    // Summary
    const [totalReserves, pendingCount, approvedCount] = await Promise.all([
      db.parametricClaimReserve.findMany({
        where: { isDeleted: 0, reserveType: 'APPROVED' },
      }),
      db.parametricClaimReserve.count({ where: { reserveType: 'PENDING_APPROVAL', isDeleted: 0 } }),
      db.parametricClaimReserve.count({ where: { reserveType: 'APPROVED', isDeleted: 0 } }),
    ]);

    const totalAmount = totalReserves.reduce((sum, r) => sum + Number(r.reserveAmount || 0), 0);

    return NextResponse.json({
      summary: {
        totalReserveAmount: totalAmount,
        pendingApprovals: pendingCount,
        approvedReserves: approvedCount,
        totalRecords: totalReserves.length,
      },
    });
  } catch (error) {
    console.error('Reserve management failed:', error);
    return Errors.internal();
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  try {
    const body = await request.json();
    const action = body.action as string;

    switch (action) {
      case 'adjust':
        return await adjustReserve(request, body, auth);
      case 'approve':
        return await approveReserve(request, body, auth);
      default:
        return errorResponse('Invalid action. Use: adjust, approve', 'INVALID_ACTION', 400);
    }
  } catch (error) {
    console.error('Reserve action failed:', error);
    return Errors.internal();
  }
}

async function adjustReserve(request: NextRequest, body: Record<string, unknown>, auth: NonNullable<Awaited<ReturnType<typeof getAuthInfo>>>) {
  const result = await validateRequestBody(
    new NextRequest(request.url, { body: JSON.stringify(body), method: 'POST' }),
    adjustReserveSchema
  );
  if ('error' in result) return result.error;

  const { claimId, reserveAmount, reason, requiresActuaryApproval } = result.data;

  const claim = await db.parametricClaim.findFirst({ where: { id: claimId, isDeleted: 0 } });
  if (!claim) return Errors.notFound('Claim');

  const reserveType = requiresActuaryApproval ? 'PENDING_APPROVAL' : 'APPROVED';

  const reserve = await db.parametricClaimReserve.create({
    data: {
      parametricClaimId: claimId,
      reserveAmount,
      adjustmentReason: reason,
      reserveType,
      previousAmount: claim.currentReserve ? Number(claim.currentReserve) : null,
      adjustmentAmount: claim.currentReserve ? reserveAmount - Number(claim.currentReserve) : reserveAmount,
      version: 1,
    },
  });

  // Update the claim's current reserve
  await db.parametricClaim.update({
    where: { id: claimId },
    data: {
      currentReserve: reserveAmount,
      reserveAdjustedBy: auth.userIdNum,
      reserveAdjustedAt: new Date(),
      reserveAdjustmentReason: reason,
      updatedAt: new Date(),
    },
  });

  await logAction({
    entityType: 'ParametricClaimReserve',
    entityId: reserve.id,
    action: requiresActuaryApproval ? 'RESERVE_PENDING_APPROVAL' : 'RESERVE_ADJUSTED',
    actorId: auth.userIdNum,
    actorType: auth.role,
    metadata: { claimId, reserveAmount, reason, requiresActuaryApproval },
    ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
  });

  return NextResponse.json({
    message: requiresActuaryApproval ? 'Reserve adjustment pending actuary approval' : 'Reserve adjusted',
    reserve: {
      id: reserve.id,
      claimId,
      reserveAmount,
      reserveType,
      reason,
    },
  }, { status: 201 });
}

async function approveReserve(request: NextRequest, body: Record<string, unknown>, auth: NonNullable<Awaited<ReturnType<typeof getAuthInfo>>>) {
  const result = await validateRequestBody(
    new NextRequest(request.url, { body: JSON.stringify(body), method: 'POST' }),
    approveReserveSchema
  );
  if ('error' in result) return result.error;

  const { reserveId, approved, notes } = result.data;

  const reserve = await db.parametricClaimReserve.findFirst({ where: { id: reserveId } });
  if (!reserve) return Errors.notFound('Reserve');

  if (reserve.reserveType !== 'PENDING_APPROVAL') {
    return errorResponse('Reserve is not pending approval', 'INVALID_STATE', 400);
  }

  await db.parametricClaimReserve.update({
    where: { id: reserveId },
    data: {
      reserveType: approved ? 'APPROVED' : 'REJECTED',
      adjustmentReason: notes ? `${reserve.adjustmentReason} | Approver notes: ${notes}` : reserve.adjustmentReason,
      updatedAt: new Date(),
    },
  });

  await logAction({
    entityType: 'ParametricClaimReserve',
    entityId: reserveId,
    action: approved ? 'RESERVE_APPROVED' : 'RESERVE_REJECTED',
    actorId: auth.userIdNum,
    actorType: auth.role,
    metadata: { reserveId, approved, notes },
    ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
  });

  return NextResponse.json({
    message: approved ? 'Reserve approved' : 'Reserve rejected',
    reserveId,
    status: approved ? 'APPROVED' : 'REJECTED',
  });
}

