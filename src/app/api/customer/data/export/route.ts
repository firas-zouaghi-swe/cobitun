
/**
 * GDPR Data Export API
 * GET - Export all personal data for a customer (ZIP/JSON)
 * DELETE - Request account deletion
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { db } from '@/lib/db';
import { Errors, errorResponse, validateRequestBody } from '@/middleware/validation';
import { z } from 'zod';
import { logAction } from '@/lib/services/audit-service';
import { notifyCustomerObject } from '@/lib/services/notification-service';

export async function GET(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();

  try {
    const customer = await db.customer.findFirst({
      where: { userId: auth.userIdNum },
      include: { user: true, sector: true },
    });

    if (!customer) return Errors.notFound('Customer');

    // Gather all personal data
    const [
      policies,
      claims,
      notifications,
      sessions,
      files,
      auditLogs,
    ] = await Promise.all([
      db.parametricPolicy.findMany({
        where: { customerId: customer.id, isDeleted: 0 },
        include: { status: { select: { statusCode: true, statusName: true } }, cloudProvider: { select: { organisationName: true } } },
      }),
      db.parametricClaim.findMany({
        where: { customerId: customer.id, isDeleted: 0 },
        include: { status: { select: { statusCode: true, statusName: true } } },
      }),
      db.notification.findMany({
        where: { recipientId: auth.userIdNum, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      }),
      db.userSession.findMany({
        where: { userId: auth.userIdNum },
      }),
      db.uploadedFile.findMany({
        where: { uploadedBy: auth.userIdNum, isDeleted: 0 },
      }),
      db.auditLog.findMany({
        where: { actorId: auth.userIdNum },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    const exportData = {
      exportDate: new Date().toISOString(),
      customer: {
        id: customer.id,
        companyName: customer.companyName,
        email: customer.user?.email || null,
        sector: customer.sector?.sectorName || null,
        createdAt: customer.createdAt?.toISOString(),
      },
      policies: policies.map((p) => ({
        id: p.id,
        policyNumber: p.policyNumber,
        status: p.status?.statusCode,
        provider: p.cloudProvider?.organisationName,
        premiumAmount: p.finalPremium,
        startDate: p.effectiveDate?.toISOString(),
        endDate: p.expiryDate?.toISOString(),
      })),
      claims: claims.map((c) => ({
        id: c.id,
        claimNumber: c.claimNumber,
        status: c.status?.statusCode,
        claimAmount: c.payoutAmount,
        createdAt: c.createdAt?.toISOString(),
      })),
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.notificationType,
        title: n.title,
        message: n.message,
        read: n.isRead,
        createdAt: n.createdAt?.toISOString(),
      })),
      sessions: sessions.map((s) => ({
        id: s.id,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        createdAt: s.createdAt?.toISOString(),
        lastAccessedAt: s.lastActiveAt?.toISOString(),
      })),
      files: files.map((f) => ({
        id: f.id,
        originalName: f.fileName,
        fileType: f.mimeType,
        fileSize: f.fileSizeBytes,
        createdAt: f.createdAt?.toISOString(),
      })),
      auditTrail: auditLogs.map((a) => ({
        id: a.id,
        action: a.action,
        entityType: a.entityType,
        createdAt: a.createdAt?.toISOString(),
      })),
    };

    await logAction({
      entityType: 'Customer',
      entityId: customer.id,
      action: 'GDPR_DATA_EXPORT',
      actorId: auth.userIdNum,
      actorType: 'CUSTOMER',
      metadata: { policyCount: policies.length, claimCount: claims.length },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    });

    const url = new URL(request.url);
    const format = url.searchParams.get('format') || 'json';

    if (format === 'json') {
      return NextResponse.json(exportData, {
        headers: {
          'Content-Disposition': `attachment; filename="cobitun-data-export-${new Date().toISOString().split('T')[0]}.json"`,
        },
      });
    }

    // For ZIP format, return JSON with instructions (actual ZIP would need archiver library)
    return NextResponse.json({
      ...exportData,
      _note: 'ZIP format export requires archiver library. Data provided in JSON format.',
    }, {
      headers: {
        'Content-Disposition': `attachment; filename="cobitun-data-export-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (error) {
    console.error('Failed to export customer data:', error);
    return Errors.internal();
  }
}

const deletionRequestSchema = z.object({
  confirmation: z.literal('DELETE_MY_ACCOUNT'),
  reason: z.string().max(500).optional(),
});

export async function DELETE(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();

  const result = await validateRequestBody(request, deletionRequestSchema);
  if ('error' in result) return result.error;

  try {
    const customer = await db.customer.findFirst({
      where: { userId: auth.userIdNum },
    });

    if (!customer) return Errors.notFound('Customer');

    // Check for active policies
    const activePolicies = await db.parametricPolicy.count({
      where: { customerId: customer.id, isDeleted: 0, status: { statusCode: 'ACTIVE' } },
    });

    if (activePolicies > 0) {
      return errorResponse(
        'Cannot delete account with active policies. Please cancel all policies first.',
        'ACTIVE_POLICIES_EXIST',
        400
      );
    }

    // Check for pending claims
    const pendingClaims = await db.parametricClaim.count({
      where: { customerId: customer.id, isDeleted: 0, status: { statusCode: { in: ['SUBMITTED', 'UNDER_REVIEW', 'APPEALED'] } } },
    });

    if (pendingClaims > 0) {
      return errorResponse(
        'Cannot delete account with pending claims. Please wait for all claims to be resolved.',
        'PENDING_CLAIMS_EXIST',
        400
      );
    }

    // Mark account for deletion (soft delete with 30-day retention)
    const deletionDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await db.user.update({
      where: { id: auth.userIdNum },
      data: {
        isActive: 0,
        updatedAt: new Date(),
      },
    });

    // Revoke all sessions
    await db.userSession.updateMany({
      where: { userId: auth.userIdNum, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await notifyCustomerObject({
      customerId: customer.id,
      type: 'action_required',
      title: 'Account Deletion Requested',
      message: `Your account deletion has been scheduled for ${deletionDate.toLocaleDateString()}. You can cancel this request by logging in before that date.`,
      metadata: { deletionDate: deletionDate.toISOString() },
    });

    await logAction({
      entityType: 'User',
      entityId: auth.userIdNum,
      action: 'GDPR_DELETION_REQUEST',
      actorId: auth.userIdNum,
      actorType: 'CUSTOMER',
      metadata: { reason: result.data.reason, scheduledDeletion: deletionDate.toISOString() },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json({
      message: 'Account deletion scheduled',
      deletionDate: deletionDate.toISOString(),
      note: 'Account will be permanently deleted in 30 days. Log in before then to cancel.',
    });
  } catch (error) {
    console.error('Failed to process deletion request:', error);
    return Errors.internal();
  }
}
