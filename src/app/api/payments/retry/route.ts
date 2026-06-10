
/**
 * Payment Retry Middleware & API
 * POST - Retry a failed payment with exponential backoff
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { db } from '@/lib/db';
import { Errors, errorResponse, validateRequestBody } from '@/middleware/validation';
import { z } from 'zod';
import { logAction } from '@/lib/services/audit-service';
import { notifyCustomer } from '@/lib/services/notification-service';

const retryPaymentSchema = z.object({
  policyId: z.number().int().positive(),
  amount: z.number().positive().optional(),
});

const MAX_RETRY_ATTEMPTS = 3;
const BACKOFF_DELAYS = [1000, 5000, 15000]; // 1s, 5s, 15s

export async function POST(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN' && auth.role !== 'CUSTOMER') return Errors.forbidden();

  const result = await validateRequestBody(request, retryPaymentSchema);
  if ('error' in result) return result.error;

  try {
    const { policyId, amount } = result.data;

    const policy = await db.parametricPolicy.findFirst({
      where: { id: policyId, isDeleted: 0 },
      include: { status: true, customer: { include: { user: true } } },
    });

    if (!policy) return Errors.notFound('Policy');

    // Check if customer owns this policy
    if (auth.role === 'CUSTOMER' && policy.customerId !== auth.customerId) {
      return Errors.forbidden();
    }

    const paymentAmount = amount ?? Number(policy.finalPremium);

    // Find or create a tracking record using audit logs (no PremiumTransaction model exists)
    const existingRetryLogs = await db.auditLog.findMany({
      where: { entityType: 'ParametricPolicy', entityId: policyId, action: 'PAYMENT_RETRY_FAILED' },
      orderBy: { createdAt: 'desc' },
    });

    const retryCount = existingRetryLogs.length + 1;

    if (retryCount > MAX_RETRY_ATTEMPTS) {
      return errorResponse('Maximum retry attempts reached. Payment requires manual intervention.', 'MAX_RETRIES_EXCEEDED', 400);
    }

    // Simulate payment processing (in production, integrate with payment gateway)
    const backoffDelay = BACKOFF_DELAYS[Math.min(retryCount - 1, BACKOFF_DELAYS.length - 1)];
    await new Promise((resolve) => setTimeout(resolve, Math.min(backoffDelay, 100))); // Capped for API response

    // TODO: Integrate with actual payment gateway
    // For now, log the retry attempt for manual processing
    const paymentSuccess = false; // Default to false until real gateway integration

    if (paymentSuccess) {
      // If policy was suspended, reinstate it
      if (policy.status?.statusCode === 'SUSPENDED') {
        const activeStatus = await db.enumParamPolicyStatus.findFirst({ where: { statusCode: 'ACTIVE', isCurrent: 1 } });
        if (activeStatus) {
          await db.parametricPolicy.update({
            where: { id: policyId },
            data: { statusId: activeStatus.id, updatedAt: new Date() },
          });
        }
      }

      // Notify customer
      if (policy.customer?.user) {
        await notifyCustomer(policy.customer.user.id, `Your payment of ${paymentAmount} TND for policy ${policy.policyNumber} was processed successfully.`, 'payment_update', { parametricPolicyId: policyId });
      }

      await logAction({
        entityType: 'ParametricPolicy',
        entityId: policyId,
        action: 'PAYMENT_RETRY_SUCCESS',
        actorId: auth.userIdNum,
        actorType: auth.role,
        metadata: { amount: paymentAmount, retryCount, policyNumber: policy.policyNumber },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      });

      return NextResponse.json({
        message: 'Payment retry successful',
        policyId,
        amount: paymentAmount,
        retryCount,
        status: 'COMPLETED',
      });
    } else {
      // Payment failed again - log the failure
      await logAction({
        entityType: 'ParametricPolicy',
        entityId: policyId,
        action: 'PAYMENT_RETRY_FAILED',
        actorId: auth.userIdNum,
        actorType: auth.role,
        metadata: { amount: paymentAmount, retryCount, policyNumber: policy.policyNumber },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      });

      // Notify customer of failure
      if (policy.customer?.user) {
        await notifyCustomer(policy.customer.user.id, `Your payment of ${paymentAmount} TND for policy ${policy.policyNumber} failed. Attempt ${retryCount} of ${MAX_RETRY_ATTEMPTS}.`, 'payment_update', { parametricPolicyId: policyId });
      }

      return NextResponse.json({
        message: `Payment retry failed. Attempt ${retryCount} of ${MAX_RETRY_ATTEMPTS}.`,
        policyId,
        retryCount,
        status: 'FAILED',
      }, { status: 402 });
    }
  } catch (error) {
    return Errors.internal();
  }
}
