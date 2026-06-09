/**
 * Customer Notification Read API
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
  if (auth.role !== 'CUSTOMER') return Errors.forbidden();

  try {
    const { id: idStr } = await params;
    const notificationId = parseInt(idStr, 10);
    if (isNaN(notificationId)) {
      return NextResponse.json({ error: 'Invalid notification ID' }, { status: 400 });
    }

    // Verify the notification belongs to this customer
    const notification = await db.notification.findFirst({
      where: {
        id: notificationId,
        recipientId: auth.userIdNum,
        isDeleted: 0,
      },
    });

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    // Mark as read
    await db.notification.update({
      where: { id: notificationId },
      data: {
        isRead: 1,
        readAt: new Date(),
      },
    });

    return NextResponse.json({ message: 'Notification marked as read', id: notificationId });
  } catch (error) {
    console.error('Failed to mark notification as read', error);
    return Errors.internal();
  }
}

