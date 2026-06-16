/**
 * Admin Notification Detail API
 * GET    - Get single notification
 * PATCH  - Mark notification as read
 * DELETE - Delete single notification
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { db } from '@/lib/db';
import { Errors } from '@/middleware/validation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  const { id } = await params;
  const notificationId = parseInt(id, 10);
  if (isNaN(notificationId)) return Errors.notFound('Notification');

  try {
    const notification = await db.notification.findFirst({
      where: { id: notificationId, isDeleted: 0 },
    });

    if (!notification) return Errors.notFound('Notification');

    return NextResponse.json({
      ...notification,
      isRead: notification.isRead === 1,
      readAt: notification.readAt?.toISOString() ?? null,
      createdAt: notification.createdAt.toISOString(),
      updatedAt: notification.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('Failed to fetch notification:', error);
    return Errors.internal();
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  const { id } = await params;
  const notificationId = parseInt(id, 10);
  if (isNaN(notificationId)) return Errors.notFound('Notification');

  try {
    const notification = await db.notification.findFirst({
      where: { id: notificationId, isDeleted: 0 },
    });

    if (!notification) return Errors.notFound('Notification');

    const updated = await db.notification.update({
      where: { id: notificationId },
      data: {
        isRead: 1,
        readAt: new Date(),
      },
    });

    return NextResponse.json({
      ...updated,
      isRead: true,
      readAt: updated.readAt?.toISOString(),
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
    return Errors.internal();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  const { id } = await params;
  const notificationId = parseInt(id, 10);
  if (isNaN(notificationId)) return Errors.notFound('Notification');

  try {
    const notification = await db.notification.findFirst({
      where: { id: notificationId, isDeleted: 0 },
    });

    if (!notification) return Errors.notFound('Notification');

    await db.notification.update({
      where: { id: notificationId },
      data: {
        isDeleted: 1,
        deletedAt: new Date(),
        deletedBy: auth.userIdNum,
      },
    });

    return NextResponse.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Failed to delete notification:', error);
    return Errors.internal();
  }
}
