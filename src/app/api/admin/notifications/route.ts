
/**
 * Admin Notifications API
 * GET  - List all notifications (admin view, with filtering & pagination)
 * POST - Create a notification (admin sending to customer)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { db } from '@/lib/db';
import { Errors, errorResponse, validateRequestBody } from '@/middleware/validation';
import { z } from 'zod';

const createNotificationSchema = z.object({
  recipientId: z.number().int().positive(),
  notificationType: z.enum(['action_required', 'info', 'warning', 'policy_update', 'claim_update', 'payment_update']),
  title: z.string().min(1).max(200),
  titleAr: z.string().max(200).optional(),
  message: z.string().min(1).max(2000),
  messageAr: z.string().max(2000).optional(),
  parametricPolicyId: z.number().int().optional(),
  cyberPolicyId: z.number().int().optional(),
  parametricClaimId: z.number().int().optional(),
  cyberClaimId: z.number().int().optional(),
});

export async function GET(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const filter = url.searchParams.get('filter') || 'all';
    const type = url.searchParams.get('type');
    const recipientId = url.searchParams.get('recipientId');
    const search = url.searchParams.get('search');

    const where: Record<string, unknown> = { isDeleted: 0 };

    if (filter === 'unread') where.isRead = 0;
    if (filter === 'read') where.isRead = 1;
    if (type) where.notificationType = type;
    if (recipientId) where.recipientId = parseInt(recipientId, 10);
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { message: { contains: search } },
      ];
    }

    const [notifications, total, unreadCount] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          recipientId: true,
          notificationType: true,
          title: true,
          titleAr: true,
          message: true,
          messageAr: true,
          isRead: true,
          readAt: true,
          deliveryMethod: true,
          emailSent: true,
          smsSent: true,
          parametricPolicyId: true,
          cyberPolicyId: true,
          parametricClaimId: true,
          cyberClaimId: true,
          createdAt: true,
          recipient: {
            select: { id: true, username: true, email: true },
          },
        },
      }),
      db.notification.count({ where }),
      db.notification.count({
        where: { isRead: 0, isDeleted: 0 },
      }),
    ]);

    return NextResponse.json({
      notifications: notifications.map((n) => ({
        ...n,
        isRead: n.isRead === 1,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
        recipient: n.recipient ? {
          id: n.recipient.id,
          username: n.recipient.username,
          email: n.recipient.email,
        } : null,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      unreadCount,
    });
  } catch (error) {
    console.error('Failed to fetch admin notifications', error);
    return Errors.internal();
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  const result = await validateRequestBody(request, createNotificationSchema);
  if ('error' in result) return result.error;

  try {
    const data = result.data;

    // Verify recipient exists
    const recipient = await db.user.findFirst({
      where: { id: data.recipientId, isDeleted: 0 },
    });
    if (!recipient) return Errors.notFound('Recipient');

    const notification = await db.notification.create({
      data: {
        recipientId: data.recipientId,
        notificationType: data.notificationType,
        title: data.title,
        titleAr: data.titleAr,
        message: data.message,
        messageAr: data.messageAr,
        deliveryMethod: 'IN_APP',
        parametricPolicyId: data.parametricPolicyId,
        cyberPolicyId: data.cyberPolicyId,
        parametricClaimId: data.parametricClaimId,
        cyberClaimId: data.cyberClaimId,
      },
    });

    return NextResponse.json({
      ...notification,
      isRead: notification.isRead === 1,
      createdAt: notification.createdAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create notification', error);
    return Errors.internal();
  }
}


