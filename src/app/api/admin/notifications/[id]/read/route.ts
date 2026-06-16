/**
 * Admin Notification Read API
 * PATCH - Mark a single notification as read
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { db } from '@/lib/db';
import { Errors } from '@/middleware/validation';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  try {
    const { id: idStr } = await params;
    const notificationId = parseInt(idStr, 10);
    if (isNaN(notificationId)) {
      return NextResponse.json({ error: 'Invalid notification ID' }, { status: 400 });
    }

    // Verify the notification exists
    const notification = await db.notification.findFirst({
      where: {
        id: notificationId,
        isDeleted: 0,
      },
    });

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    // Mark as read
    const updated = await db.notification.update({
      where: { id: notificationId },
      data: {
        isRead: 1,
        readAt: new Date(),
      },
    });

    return NextResponse.json({ 
      message: 'Notification marked as read', 
      id: notificationId,
      updated: {
        ...updated,
        isRead: true,
        readAt: updated.readAt?.toISOString(),
        createdAt: updated.createdAt.toISOString(),
      }
    });
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
    return Errors.internal();
  }
}
