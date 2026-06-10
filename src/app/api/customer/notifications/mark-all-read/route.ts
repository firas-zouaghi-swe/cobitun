/**
 * Customer Notifications Mark All Read API
 * PATCH - Mark all unread notifications as read
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { db } from '@/lib/db';
import { Errors } from '@/middleware/validation';

export async function PATCH(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'CUSTOMER') return Errors.forbidden();

  try {
    const result = await db.notification.updateMany({
      where: {
        recipientId: auth.userIdNum,
        isRead: 0,
        isDeleted: 0,
      },
      data: {
        isRead: 1,
        readAt: new Date(),
      },
    });

    return NextResponse.json({
      message: 'All notifications marked as read',
      updatedCount: result.count,
    });
  } catch (error) {
    // Ignore mark all read errors
    return Errors.internal();
  }
}

