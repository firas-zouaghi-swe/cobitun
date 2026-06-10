/**
 * Customer Notifications API
 * GET  - List customer notifications (with filtering & pagination)
 * DELETE - Delete all read notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { db } from '@/lib/db';
import { Errors, errorResponse } from '@/middleware/validation';

export async function GET(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'CUSTOMER') return Errors.forbidden();

  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const filter = url.searchParams.get('filter') || 'all'; // all, unread, read
    const type = url.searchParams.get('type'); // notification type filter

    const where: Record<string, unknown> = {
      recipientId: auth.userIdNum,
      isDeleted: 0,
    };

    if (filter === 'unread') where.isRead = 0;
    if (filter === 'read') where.isRead = 1;
    if (type) where.notificationType = type;

    const [notifications, total, unreadCount] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          notificationType: true,
          title: true,
          titleAr: true,
          message: true,
          messageAr: true,
          isRead: true,
          readAt: true,
          deliveryMethod: true,
          parametricPolicyId: true,
          cyberPolicyId: true,
          parametricClaimId: true,
          cyberClaimId: true,
          createdAt: true,
        },
      }),
      db.notification.count({ where }),
      db.notification.count({
        where: { recipientId: auth.userIdNum, isRead: 0, isDeleted: 0 },
      }),
    ]);

    return NextResponse.json({
      notifications: notifications.map((n) => ({
        ...n,
        isRead: n.isRead === 1,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      unreadCount,
    });
  } catch (error) {
    // Ignore notification retrieval errors
    return Errors.internal();
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'CUSTOMER') return Errors.forbidden();

  try {
    const result = await db.notification.updateMany({
      where: {
        recipientId: auth.userIdNum,
        isRead: 1,
        isDeleted: 0,
      },
      data: {
        isDeleted: 1,
        deletedAt: new Date(),
        deletedBy: auth.userIdNum,
      },
    });

    return NextResponse.json({
      message: 'Read notifications deleted',
      deletedCount: result.count,
    });
  } catch (error) {
    return Errors.internal();
  }
}

