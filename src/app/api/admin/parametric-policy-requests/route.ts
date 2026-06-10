import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { requireRole, Roles } from '@/lib/services/authorization';
import { logAction } from '@/lib/services/audit-service';
import { notifyCustomer } from '@/lib/services/notification-service';
import { updatePolicyApplicationStatus, completeTask, createTask } from '@/lib/services/workflow-engine';

export async function GET(request: NextRequest) {
  try {
    // Look up PENDING status ID
    const pendingStatus = await db.enumParamPolicyStatus.findFirst({
      where: { statusCode: 'PENDING', isCurrent: 1 },
      select: { id: true },
    });
    const url = request.nextUrl;
    const showAll = url.searchParams.get('all') === '1' || url.searchParams.get('all') === 'true';

    const whereClause: Record<string, unknown> = { isDeleted: 0 };
    if (!showAll && pendingStatus) {
      whereClause.statusId = pendingStatus.id;
    }

    const pendingPolicies = await db.parametricPolicy.findMany({
      where: whereClause,
      include: {
        customer: { include: { user: true } },
        cloudProvider: { include: { slaTier: true } },
        sector: { select: { sectorCode: true, sectorName: true } },
        businessModel: { select: { modelCode: true, modelName: true } },
        turnoverBand: { select: { bandCode: true, bandName: true } },
        resilienceProfile: { select: { profileCode: true, profileName: true } },
        product: { select: { productCode: true, productName: true } },
        status: { select: { statusCode: true, statusName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ policies: pendingPolicies });
  } catch (error) {
    console.error('Get pending policy requests error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authOrResp = await requireRole(request, Roles.ADMIN);
    if (authOrResp instanceof NextResponse) return authOrResp;
    const auth = authOrResp;

    const body = await request.json();
    const { policyId, action, adminComment } = body;

    if (!policyId || !action) {
      return NextResponse.json({ error: 'Policy ID and action are required' }, { status: 400 });
    }

    const policy = await db.parametricPolicy.findUnique({
      where: { id: policyId },
      include: { status: true, customer: { include: { user: true } } },
    });
    if (!policy) {
      return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
    }

    // Check that the policy is in PENDING status
    if (policy.status?.statusCode !== 'PENDING') {
      return NextResponse.json({ error: 'Only pending policies can be approved or rejected' }, { status: 400 });
    }

    let updatedPolicy;
    // Workflow update summary to return to caller (may be filled when approval triggers workflow transitions)
    let workflowUpdate: { found: boolean; appId?: number; transitionedTo?: string | null } | null = null;

    if (action === 'approve') {
      // Look up APPROVED status
      const approvedStatus = await db.enumParamPolicyStatus.findFirst({
        where: { statusCode: 'APPROVED', isCurrent: 1 },
        select: { id: true },
      });

      if (!approvedStatus) {
        return NextResponse.json({ error: 'APPROVED status not found in system' }, { status: 500 });
      }

      updatedPolicy = await db.parametricPolicy.update({
        where: { id: policyId },
        data: {
          statusId: approvedStatus.id,
          effectiveDate: new Date(),
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          underwrittenBy: auth.userIdNum,
          underwrittenAt: new Date(),
          underwritingNotes: adminComment || null,
          updatedBy: auth.userIdNum,
        },
        include: {
          customer: { include: { user: true } },
          cloudProvider: { include: { slaTier: true } },
          sector: { select: { sectorCode: true, sectorName: true } },
          businessModel: { select: { modelCode: true, modelName: true } },
          turnoverBand: { select: { bandCode: true, bandName: true } },
          resilienceProfile: { select: { profileCode: true, profileName: true } },
          status: { select: { statusCode: true, statusName: true } },
        },
      });

      // Notify customer
      await notifyCustomer(policy.customer.userId, `Your parametric policy ${policy.policyNumber} has been approved.`, 'action_required', { parametricPolicyId: policyId });

      // If there's a related workflow policy application for this customer/product, mark admin review task completed
      workflowUpdate = { found: false, transitionedTo: null };
      try {
        let wfApp = await db.workflowPolicyApplication.findFirst({
          where: { customerId: policy.customerId, productId: policy.productId ?? null, isDeleted: 0 },
          orderBy: { createdAt: 'desc' },
        });

        // Fallback: find any recent workflow app for this customer in provider-uploaded or admin-reviewing
        if (!wfApp) {
          wfApp = await db.workflowPolicyApplication.findFirst({
            where: {
              customerId: policy.customerId,
              isDeleted: 0,
              OR: [
                { status: { statusCode: 'ProviderContractUploaded' } },
                { status: { statusCode: 'AdminReviewing' } },
              ],
            },
            orderBy: { createdAt: 'desc' },
          });
        }

        if (wfApp) {
          workflowUpdate.found = true;
          workflowUpdate.appId = wfApp.id;

          if (!wfApp.productId && policy.productId) {
            await db.workflowPolicyApplication.update({
              where: { id: wfApp.id },
              data: { productId: policy.productId },
            });
          }

          const reviewTask = await db.workflowPolicyTask.findFirst({
            where: { policyApplicationId: wfApp.id, actionRequired: 'ReviewProviderContract', isDeleted: 0 },
            include: { status: { select: { statusCode: true } } },
          });

          if (reviewTask && reviewTask.status?.statusCode === 'PENDING') {
            await completeTask(reviewTask.id, 'Policy', auth.userIdNum, adminComment || 'Approved by admin');
          }

          // Ensure we only attempt transitions that are valid from the application's current state.
          try {
            // Re-fetch the application to have the latest status
            let freshApp = await db.workflowPolicyApplication.findUnique({ where: { id: wfApp.id }, include: { status: { select: { statusCode: true } } } });

            // Only move to AdminReviewing if the app is at ProviderContractUploaded
            if (freshApp?.status?.statusCode === 'ProviderContractUploaded') {
              try {
                await updatePolicyApplicationStatus(wfApp.id, 'AdminReviewing');
                // refresh
                freshApp = await db.workflowPolicyApplication.findUnique({ where: { id: wfApp.id }, include: { status: { select: { statusCode: true } } } });
              } catch (e) {
              }
            }

            // Now attempt to advance to PolicyContractGenerated (if allowed)
            try {
              await updatePolicyApplicationStatus(wfApp.id, 'PolicyContractGenerated');
              workflowUpdate.transitionedTo = 'PolicyContractGenerated';

              const existingSignTask = await db.workflowPolicyTask.findFirst({
                where: { policyApplicationId: wfApp.id, actionRequired: 'SignPolicyContract', isDeleted: 0 },
              });
              if (!existingSignTask) {
                await createTask({ entityType: 'Policy', policyApplicationId: wfApp.id, actorCode: Roles.CUSTOMER, actionRequired: 'SignPolicyContract' });
              }
            } catch (e) {
            }
          } catch (e) {
            console.error('Admin approval: error while handling workflow transitions for app', wfApp.id, e);
          }
        }
      } catch (wfErr) {
        console.error('Failed to update workflow application after parametric approval:', wfErr);
      }
    } else if (action === 'reject') {
      // Look up REJECTED status
      const rejectedStatus = await db.enumParamPolicyStatus.findFirst({
        where: { statusCode: 'REJECTED', isCurrent: 1 },
        select: { id: true },
      });

      if (!rejectedStatus) {
        return NextResponse.json({ error: 'REJECTED status not found in system' }, { status: 500 });
      }

      updatedPolicy = await db.parametricPolicy.update({
        where: { id: policyId },
        data: {
          statusId: rejectedStatus.id,
          underwrittenBy: auth.userIdNum,
          underwrittenAt: new Date(),
          underwritingNotes: adminComment || 'Rejected by admin',
          updatedBy: auth.userIdNum,
        },
        include: {
          customer: { include: { user: true } },
          cloudProvider: { include: { slaTier: true } },
          sector: { select: { sectorCode: true, sectorName: true } },
          businessModel: { select: { modelCode: true, modelName: true } },
          turnoverBand: { select: { bandCode: true, bandName: true } },
          resilienceProfile: { select: { profileCode: true, profileName: true } },
          status: { select: { statusCode: true, statusName: true } },
        },
      });

      // Notify customer
      await notifyCustomer(policy.customer.userId, `Your parametric policy ${policy.policyNumber} has been rejected.`, 'info', { parametricPolicyId: policyId });
    } else {
      return NextResponse.json({ error: 'Invalid action. Use: approve or reject' }, { status: 400 });
    }

    // Audit
    await logAction({
      entityType: 'ParametricPolicy',
      entityId: policyId,
      actorId: auth.userIdNum,
      action: action === 'approve' ? 'APPROVE' : 'REJECT',
      actionCategory: 'ADMIN',
      oldValues: { statusId: policy.statusId },
      newValues: { statusId: updatedPolicy.statusId, adminComment },
      requestPath: '/api/admin/parametric-policy-requests',
    });

    return NextResponse.json({ policy: updatedPolicy, workflowUpdate });
  } catch (error) {
    console.error('Update policy request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


