import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole, Roles } from '@/lib/services/authorization';
import { validatePolicyTransitionWithReason, isTerminalPolicyState, WorkflowTransitionError } from '@/lib/services/workflow-engine';
import { logAction } from '@/lib/services/audit-service';

/**
 * POST /api/workflow/policy-applications/bulk
 * Bulk approve or reject policy applications.
 * Cross-cutting requirement X-09: Invalid items rejected individually.
 *
 * Body: { action: 'approve' | 'reject', ids: number[], rejectionReason?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const authOrResp = await requireRole(request, Roles.ADMIN);
    if ((authOrResp as any).status) return authOrResp as NextResponse;
    const auth = authOrResp as any;

    const body = await request.json();
    const { action, ids, rejectionReason } = body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action must be "approve" or "reject"' }, { status: 400 });
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 });
    }

    if (action === 'reject' && (!rejectionReason || rejectionReason.trim().length === 0)) {
      return NextResponse.json({ error: 'rejectionReason is required for bulk reject' }, { status: 422 });
    }

    if (action === 'reject' && rejectionReason.length > 5000) {
      return NextResponse.json({ error: 'rejectionReason must be 5000 characters or less' }, { status: 422 });
    }

    const results: { id: number; success: boolean; error?: string; newStatus?: string }[] = [];

    for (const id of ids) {
      try {
        const application = await db.workflowPolicyApplication.findUnique({
          where: { id },
          include: { status: { select: { statusCode: true } } },
        });

        if (!application || application.isDeleted) {
          results.push({ id, success: false, error: 'Not found' });
          continue;
        }

        const currentStatusCode = application.status?.statusCode ?? '';

        // Check terminal state
        if (isTerminalPolicyState(currentStatusCode)) {
          results.push({ id, success: false, error: 'Terminal state — modifications forbidden' });
          continue;
        }

        if (action === 'approve') {
          // Must be in AdminReviewing
          const validation = validatePolicyTransitionWithReason(currentStatusCode, 'PolicyContractGenerated');
          if (!validation.valid) {
            results.push({ id, success: false, error: validation.error! });
            continue;
          }

          const newStatusId = await db.enumWorkflowAppStatus.findFirst({
            where: { statusCode: 'PolicyContractGenerated', isCurrent: 1 },
            select: { id: true },
          });

          await db.workflowPolicyApplication.update({
            where: { id },
            data: { statusId: newStatusId?.id ?? null },
          });

          await logAction({
            entityType: 'WorkflowPolicyApplication',
            entityId: id,
            actorId: auth.userIdNum,
            action: 'Bulk approved — transitioned to PolicyContractGenerated',
            actionCategory: 'WORKFLOW',
            metadata: { bulkAction: true },
          });

          results.push({ id, success: true, newStatus: 'PolicyContractGenerated' });
        } else {
          // Reject
          const validation = validatePolicyTransitionWithReason(currentStatusCode, 'Rejected');
          if (!validation.valid) {
            results.push({ id, success: false, error: validation.error! });
            continue;
          }

          const rejectedStatusId = await db.enumWorkflowAppStatus.findFirst({
            where: { statusCode: 'Rejected', isCurrent: 1 },
            select: { id: true },
          });

          await db.workflowPolicyApplication.update({
            where: { id },
            data: {
              statusId: rejectedStatusId?.id ?? null,
              rejectionReason: rejectionReason ?? null,
              rejectedBy: auth.userIdNum,
              rejectedAt: new Date(),
            },
          });

          await logAction({
            entityType: 'WorkflowPolicyApplication',
            entityId: id,
            actorId: auth.userIdNum,
            action: 'Bulk rejected',
            actionCategory: 'WORKFLOW',
            metadata: { bulkAction: true, rejectionReason },
          });

          results.push({ id, success: true, newStatus: 'Rejected' });
        }
      } catch (err: any) {
        results.push({ id, success: false, error: err.message || 'Unknown error' });
      }
    }

    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return NextResponse.json({
      action,
      total: ids.length,
      succeeded,
      failed,
      results,
    });
  } catch (error) {
    if (error instanceof WorkflowTransitionError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
