import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getAuthInfo, AuthInfo } from '@/lib/services/auth-helper';
import { requireRole, Roles } from '@/lib/services/authorization';
import { logAction } from '@/lib/services/audit-service';
import { notifyCustomer } from '@/lib/services/notification-service';

const cyberClaimPatchSchema = z.object({
  claimId: z.number().int().positive(),
  status: z.enum(['REPORTED', 'UNDER_INVESTIGATION', 'ADJUSTED', 'APPROVED', 'PAID', 'DENIED']).optional(),
  adjusterComment: z.string().max(2000).optional(),
  approvedAmount: z.union([z.string(), z.number()]).optional(),
  assignedInvestigator: z.union([z.string(), z.number()]).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusCode = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10')));
    const skip = (page - 1) * limit;

    // Build where clause using statusId FK
    const where: Record<string, unknown> = { isDeleted: 0 };

    if (statusCode) {
      const statusRecord = await db.enumCyberClaimStatus.findFirst({
        where: { statusCode, isCurrent: 1 },
        select: { id: true },
      });
      if (statusRecord) {
        where.statusId = statusRecord.id;
      }
    }

    const [claims, total] = await Promise.all([
      db.cyberClaim.findMany({
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
          policy: {
            include: {
              product: {
                include: {
                  category: true,
                },
              },
            },
          },
          incidentType: { select: { id: true, typeCode: true, typeName: true } },
          status: { select: { id: true, statusCode: true, statusName: true } },
          assignedInvestigatorUser: { select: { id: true, firstName: true, lastName: true } },
          adjustedByUser: { select: { id: true, firstName: true, lastName: true } },
          approvedByUser: { select: { id: true, firstName: true, lastName: true } },
          paidByUser: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.cyberClaim.count({ where }),
    ]);

    return NextResponse.json({
      claims,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Get cyber claims error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authOrResp = await requireRole(request, Roles.ADMIN);
    if ((authOrResp as any).status) return authOrResp as NextResponse;
    const auth = authOrResp as AuthInfo;

    const body = await request.json();
    const parsed = cyberClaimPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const { claimId, status: statusCode, adjusterComment, approvedAmount, assignedInvestigator } = parsed.data;

    const claim = await db.cyberClaim.findUnique({
      where: { id: claimId },
      include: { status: true, customer: { include: { user: true } } },
    });
    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = { updatedBy: auth.userIdNum };

    // Set status via statusId FK (statusCode already validated by Zod)
    if (statusCode) {
      // Look up status by statusCode
      const statusRecord = await db.enumCyberClaimStatus.findFirst({
        where: { statusCode, isCurrent: 1 },
        select: { id: true },
      });

      if (!statusRecord) {
        return NextResponse.json({ error: `Status ${statusCode} not found in system` }, { status: 500 });
      }

      updateData.statusId = statusRecord.id;
    }

    // Set adjuster comment
    if (adjusterComment !== undefined) {
      updateData.adjustmentReason = adjusterComment;
    }

    // Set approved amount
    if (approvedAmount !== undefined) {
      updateData.approvedAmount = parseFloat(String(approvedAmount));
      updateData.approvedAt = new Date();
      updateData.approvedBy = auth.userIdNum;
    }

    // If assigning investigator
    if (assignedInvestigator !== undefined) {
      updateData.assignedInvestigator = assignedInvestigator ? parseInt(String(assignedInvestigator), 10) : null;
      updateData.investigationStartedAt = new Date();
    }

    // If marking as UNDER_INVESTIGATION, set investigationStartedAt
    if (statusCode === 'UNDER_INVESTIGATION') {
      updateData.investigationStartedAt = new Date();
    }

    // If marking as ADJUSTED, set adjustedAt
    if (statusCode === 'ADJUSTED') {
      updateData.adjustedAt = new Date();
      updateData.adjustedBy = auth.userIdNum;
    }

    // If marking as PAID, set paidAt
    if (statusCode === 'PAID') {
      updateData.paidAt = new Date();
      updateData.paidBy = auth.userIdNum;
      updateData.payoutTransactionId = `PAY-${Date.now()}`;
      updateData.payoutMethod = 'BANK_TRANSFER';
      // Use approvedAmount or adjustedAmount as paidAmount
      updateData.paidAmount = approvedAmount
        ? parseFloat(String(approvedAmount))
        : claim.approvedAmount || claim.adjustedAmount || claim.estimatedLoss;
    }

    // If marking as APPROVED and no approvedAmount set, default to estimatedLoss
    if (statusCode === 'APPROVED' && approvedAmount === undefined && claim.estimatedLoss) {
      updateData.approvedAmount = claim.estimatedLoss;
      updateData.approvedAt = new Date();
      updateData.approvedBy = auth.userIdNum;
    }

    const updatedClaim = await db.cyberClaim.update({
      where: { id: claimId },
      data: updateData,
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
        policy: {
          include: {
            product: {
              include: {
                category: true,
              },
            },
          },
        },
        incidentType: { select: { id: true, typeCode: true, typeName: true } },
        status: { select: { id: true, statusCode: true, statusName: true } },
        assignedInvestigatorUser: { select: { id: true, firstName: true, lastName: true } },
        adjustedByUser: { select: { id: true, firstName: true, lastName: true } },
        approvedByUser: { select: { id: true, firstName: true, lastName: true } },
        paidByUser: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Notify customer on status change
    if (statusCode) {
      await notifyCustomer(
        claim.customer.userId,
        `Your cyber claim ${claim.claimNumber} status has been updated to ${statusCode}.`,
        statusCode === 'PAID' ? 'info' : 'action_required',
        { cyberClaimId: claimId }
      );
    }

    // Audit
    await logAction({
      entityType: 'CyberClaim',
      entityId: claimId,
      actorId: auth.userIdNum,
      action: statusCode ? `STATUS_${statusCode}` : 'UPDATE',
      actionCategory: 'ADMIN',
      oldValues: { statusId: claim.statusId, statusCode: claim.status?.statusCode },
      newValues: updateData,
      requestPath: '/api/admin/cyber-claims',
    });

    return NextResponse.json({ claim: updatedClaim });
  } catch (error) {
    console.error('Update cyber claim error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}



