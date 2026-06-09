
/**
 * Dunning Process API
 * POST - Trigger dunning sequence for failed payments
 * GET  - Get dunning status for a policy
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { db } from '@/lib/db';
import { Errors, errorResponse, validateRequestBody } from '@/middleware/validation';
import { z } from 'zod';
import { logAction } from '@/lib/services/audit-service';
import { notifyCustomer } from '@/lib/services/notification-service';

const triggerDunningSchema = z.object({
  policyId: z.number().int().positive(),
  stage: z.enum(['REMINDER_1', 'REMINDER_2', 'FINAL_NOTICE', 'SUSPENSION_WARNING', 'SUSPEND']).default('REMINDER_1'),
});

const DUNNING_STAGES = [
  { code: 'REMINDER_1', daysAfterFailure: 1, notificationType: 'payment_update' as const, title: 'Payment Reminder', escalate: false },
  { code: 'REMINDER_2', daysAfterFailure: 7, notificationType: 'payment_update' as const, title: 'Second Payment Reminder', escalate: false },
  { code: 'FINAL_NOTICE', daysAfterFailure: 15, notificationType: 'warning' as const, title: 'Final Notice - Payment Required', escalate: true },
  { code: 'SUSPENSION_WARNING', daysAfterFailure: 25, notificationType: 'warning' as const, title: 'Policy Suspension Warning', escalate: true },
  { code: 'SUSPEND', daysAfterFailure: 30, notificationType: 'action_required' as const, title: 'Policy Suspended - Payment Required', escalate: true },
];

export async function POST(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  const result = await validateRequestBody(request, triggerDunningSchema);
  if ('error' in result) return result.error;

  try {
    const { policyId, stage } = result.data;

    const policy = await db.parametricPolicy.findFirst({
      where: { id: policyId, isDeleted: 0 },
      include: { status: true, customer: { include: { user: true } } },
    });

    if (!policy) return Errors.notFound('Policy');

    const stageConfig = DUNNING_STAGES.find((s) => s.code === stage);
    if (!stageConfig) return Errors.notFound('Dunning stage');

    // If suspension stage, suspend the policy
    if (stage === 'SUSPEND') {
      const suspendedStatus = await db.enumParamPolicyStatus.findFirst({ where: { statusCode: 'SUSPENDED' } });
      if (suspendedStatus) {
        await db.parametricPolicy.updateMany({
          where: { id: policyId, version: policy.version },
          data: {
            statusId: suspendedStatus.id,
            cancellationReason: `SUSPENDED: NON_PAYMENT (dunning stage: ${stage})`,
            updatedAt: new Date(),
            version: { increment: 1 },
          },
        });
      }
    }

    // Notify customer
    if (policy.customer?.user) {
      await notifyCustomer(
        policy.customer.user.id,
        `Your policy ${policy.policyNumber} has a pending payment. ${stage === 'SUSPEND' ? 'Your policy has been suspended.' : 'Please make payment to avoid suspension.'}`,
        stageConfig.notificationType,
        { parametricPolicyId: policyId }
      );
    }

    await logAction({
      entityType: 'ParametricPolicy',
      entityId: policyId,
      action: `DUNNING_${stage}`,
      actorId: auth.userIdNum,
      actorType: 'ADMIN',
      metadata: { stage, daysAfterFailure: stageConfig.daysAfterFailure, policyNumber: policy.policyNumber },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json({
      message: `Dunning stage ${stage} processed`,
      policyId,
      stage,
      policyStatus: stage === 'SUSPEND' ? 'SUSPENDED' : policy.status?.statusCode,
    });
  } catch (error) {
    console.error('Failed to process dunning', error);
    return Errors.internal();
  }
}

export async function GET(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  const url = new URL(request.url);
  const policyId = parseInt(url.searchParams.get('policyId') || '0', 10);
  if (!policyId) return errorResponse('policyId query parameter required', 'VALIDATION_ERROR', 400);

  try {
    const policy = await db.parametricPolicy.findFirst({
      where: { id: policyId, isDeleted: 0 },
      include: { status: true },
    });

    if (!policy) return Errors.notFound('Policy');

    // Payment transaction tracking is not yet available (premiumTransaction model does not exist)
    const failedPayments: { id: number; amount: number; retryCount: number; createdAt: string }[] = [];

    const currentStage = failedPayments.length > 0
      ? DUNNING_STAGES[Math.min(failedPayments[0].retryCount ?? 0, DUNNING_STAGES.length - 1)]
      : null;

    return NextResponse.json({
      policyId,
      policyStatus: policy.status?.statusCode,
      failedPayments,
      currentDunningStage: currentStage?.code ?? null,
      nextStage: currentStage && DUNNING_STAGES.indexOf(currentStage) < DUNNING_STAGES.length - 1
        ? DUNNING_STAGES[DUNNING_STAGES.indexOf(currentStage) + 1].code
        : null,
    });
  } catch (error) {
    console.error('Failed to get dunning status', error);
    return Errors.internal();
  }
}

