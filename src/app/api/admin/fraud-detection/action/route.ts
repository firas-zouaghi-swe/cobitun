import { NextRequest, NextResponse } from 'next/server';
import { AuthInfo } from '@/lib/services/auth-helper';
import { requireRole, Roles } from '@/lib/services/authorization';
import { db } from '@/lib/db';
import { FraudDetector } from '@/lib/fraud-detector';
import { Errors, errorResponse } from '@/middleware/validation';
import { z } from 'zod';
import { logAction } from '@/lib/services/audit-service';

const actionSchema = z.object({
  userId: z.number().int().positive(),
  action: z.enum(['DELETE', 'LOCK', 'WHITELIST', 'CONFIRM_FAKE', 'CONFIRM_LEGIT']),
  reason: z.string().min(1).max(500),
});

export async function POST(request: NextRequest) {
  const authOrResp = await requireRole(request, Roles.ADMIN);
  if ((authOrResp as any).status) return authOrResp as NextResponse;
  const auth = authOrResp as AuthInfo;

  try {
    const body = await request.json();
    const result = actionSchema.safeParse(body);

    if (!result.success) {
      return errorResponse('Invalid request body', 'VALIDATION_ERROR', 400);
    }

    const { userId, action, reason } = result.data;

    // Find the user
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { customer: true },
    });

    if (!user) {
      return errorResponse('User not found', 'NOT_FOUND', 404);
    }

    // Create fraud detector instance
    const detector = new FraudDetector(db);

    // Perform the action
    switch (action) {
      case 'DELETE':
        await db.user.update({
          where: { id: userId },
          data: {
            isDeleted: 1,
            deletedAt: new Date(),
            deletedBy: auth.userIdNum,
            deletionReason: reason,
            isActive: 0,
          },
        });

        if (user.customer) {
          await db.customer.update({
            where: { id: user.customer.id },
            data: { isDeleted: 1 },
          });
        }
        break;

      case 'LOCK':
        await db.user.update({
          where: { id: userId },
          data: {
            isActive: 0,
            lockedUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          },
        });
        break;

      case 'WHITELIST':
        await detector.feedback(userId, 'LEGITIMATE', reason);
        break;

      case 'CONFIRM_FAKE':
        await detector.feedback(userId, 'FAKE', reason);
        break;

      case 'CONFIRM_LEGIT':
        await detector.feedback(userId, 'LEGITIMATE', reason);
        break;
    }

    await logAction({
      entityType: 'User',
      entityId: userId,
      action: `ADMIN_${action}`,
      actorId: auth.userIdNum,
      actorType: auth.role,
      metadata: { action, reason },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json({
      message: `Action ${action} completed successfully`,
      userId,
      action,
      reason,
    });
  } catch (error) {
    console.error('Failed to perform admin action:', error);
    return Errors.internal();
  }
}

