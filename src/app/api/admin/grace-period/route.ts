
/**
 * Grace Period API
 * GET  - Get policies in grace period
 * POST - Trigger grace period for a policy
 * Handles auto-grace period after expiry, notifications, and auto-cancellation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { db } from '@/lib/db';
import { Errors, errorResponse, validateRequestBody } from '@/middleware/validation';
import { z } from 'zod';
import { logAction } from '@/lib/services/audit-service';
import { notifyCustomerObject } from '@/lib/services/notification-service';

const GRACE_PERIOD_DAYS = 30; // Default grace period
const NOTIFICATION_DAYS = [7, 15, 30]; // Days at which to send notifications

const triggerGracePeriodSchema = z.object({
  policyId: z.number().int().positive(),
  gracePeriodDays: z.number().int().min(1).max(90).default(GRACE_PERIOD_DAYS),
});

export async function GET(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));

    // Find policies with grace period status
    const graceStatus = await db.enumParamPolicyStatus.findFirst({
      where: { statusCode: 'GRACE_PERIOD', isCurrent: 1 },
    });

    const expiredStatus = await db.enumParamPolicyStatus.findFirst({
      where: { statusCode: 'EXPIRED', isCurrent: 1 },
    });

    const statusIds = [graceStatus?.id, expiredStatus?.id].filter((id): id is number => id !== undefined);

    if (statusIds.length === 0) {
      return NextResponse.json({ policies: [], pagination: { page, limit, total: 0, totalPages: 0 } });
    }

    const where = {
      statusId: { in: statusIds },
      isDeleted: 0,
    };

    const [policies, total] = await Promise.all([
      db.parametricPolicy.findMany({
        where,
        orderBy: { expiryDate: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          customer: { select: { id: true, companyName: true, user: { select: { email: true } } } },
          status: { select: { statusCode: true, statusName: true } },
        },
      }),
      db.parametricPolicy.count({ where }),
    ]);

    const now = new Date();

    return NextResponse.json({
      policies: policies.map((p) => {
        const daysSinceExpiry = Math.floor((now.getTime() - p.expiryDate!.getTime()) / (1000 * 60 * 60 * 24));
        const gracePeriodEnd = new Date(p.expiryDate!.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
        const daysUntilGracePeriodEnd = Math.max(0, Math.ceil((gracePeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

        return {
          id: p.id,
          policyNumber: p.policyNumber,
          endDate: p.expiryDate?.toISOString(),
          status: p.status?.statusCode,
          customer: p.customer,
          daysSinceExpiry,
          gracePeriodEndDate: gracePeriodEnd.toISOString(),
          daysUntilGracePeriodEnd,
          autoCancellationDate: gracePeriodEnd.toISOString(),
          isAutoCancellationPending: daysUntilGracePeriodEnd <= 0,
        };
      }),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Failed to list grace period policies:', error);
    return Errors.internal();
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  const result = await validateRequestBody(request, triggerGracePeriodSchema);
  if ('error' in result) return result.error;

  try {
    const { policyId, gracePeriodDays } = result.data;

    const policy = await db.parametricPolicy.findFirst({
      where: { id: policyId, isDeleted: 0 },
      include: { customer: { include: { user: true } }, status: true },
    });

    if (!policy) return Errors.notFound('Policy');

    // Set grace period status
    const graceStatus = await db.enumParamPolicyStatus.findFirst({
      where: { statusCode: 'GRACE_PERIOD', isCurrent: 1 },
    });

    if (!graceStatus) {
      return errorResponse('Grace period status not configured', 'CONFIG_ERROR', 500);
    }

    await db.parametricPolicy.updateMany({
      where: { id: policyId, version: policy.version },
      data: {
        statusId: graceStatus.id,
        cancellationReason: `GRACE_PERIOD: ${gracePeriodDays} days from ${new Date().toISOString()}`,
        updatedAt: new Date(),
      },
    });

    // Send grace period notification
    const gracePeriodEnd = new Date(policy.expiryDate!.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000);

    await notifyCustomerObject({
      customerId: policy.customerId,
      type: 'action_required',
      title: 'Policy Grace Period Started',
      message: `Your policy ${policy.policyNumber} has entered a ${gracePeriodDays}-day grace period. Please renew before ${gracePeriodEnd.toLocaleDateString()} to avoid automatic cancellation.`,
      metadata: { policyId, gracePeriodDays, gracePeriodEnd: gracePeriodEnd.toISOString() },
    });

    // Schedule notifications at 7/15/30 days
    for (const notifyDay of NOTIFICATION_DAYS) {
      if (notifyDay < gracePeriodDays) {
        const notifyDate = new Date(policy.expiryDate!.getTime() + notifyDay * 24 * 60 * 60 * 1000);
        // Store scheduled notification (would be processed by cron job)
        await db.notificationLog.create({
          data: {
            recipientId: policy.customer.userId,
            notificationType: 'action_required',
            channel: 'IN_APP',
            status: 'PENDING',
            nextRetryAt: notifyDate,
          },
        });
      }
    }

    await logAction({
      entityType: 'ParametricPolicy',
      entityId: policyId,
      action: 'GRACE_PERIOD_STARTED',
      actorId: auth.userIdNum,
      actorType: auth.role,
      metadata: { policyId, gracePeriodDays, gracePeriodEnd: gracePeriodEnd.toISOString() },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json({
      message: 'Grace period started',
      policyId,
      gracePeriodDays,
      gracePeriodEnd: gracePeriodEnd.toISOString(),
      scheduledNotifications: NOTIFICATION_DAYS.filter((d) => d < gracePeriodDays),
    });
  } catch (error) {
    console.error('Failed to start grace period:', error);
    return Errors.internal();
  }
}

