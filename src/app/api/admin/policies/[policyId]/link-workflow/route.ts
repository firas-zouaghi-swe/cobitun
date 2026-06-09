import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/services/authorization';
import { Roles } from '@/lib/services/authorization';

/**
 * POST /api/admin/policies/[policyId]/link-workflow
 * Creates explicit link between ParametricPolicy and WorkflowPolicyApplication
 * Validates policy exists and is in PENDING state before allowing workflow creation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { policyId: string } }
) {
  try {
    // Check admin authorization
    const authOrResp = await requireRole(request, Roles.ADMIN);
    if (authOrResp instanceof NextResponse) return authOrResp;
    const auth = authOrResp;

    const { policyId } = params;
    const { workflowApplicationId } = await request.json();

    // Validate input
    if (!workflowApplicationId) {
      return NextResponse.json(
        { error: 'workflowApplicationId is required' },
        { status: 400 }
      );
    }

    const policyIdNum = parseInt(policyId);
    const workflowAppIdNum = parseInt(workflowApplicationId);

    // Verify parametric policy exists
    const parametricPolicy = await prisma.parametricPolicy.findUnique({
      where: { id: policyIdNum },
      include: { status: true }
    });

    if (!parametricPolicy) {
      return NextResponse.json({ error: 'Parametric policy not found' }, { status: 404 });
    }

    // Check if policy is in PENDING state (before activation)
    const pendingStatus = await prisma.enumParamPolicyStatus.findFirst({
      where: { statusCode: 'PENDING' }
    });

    if (parametricPolicy.statusId !== pendingStatus?.id) {
      return NextResponse.json(
        {
          error: `Workflow can only be linked to policies in PENDING state. Current status: ${parametricPolicy.status?.statusName}`
        },
        { status: 400 }
      );
    }

    // Verify workflow application exists
    const workflowApp = await prisma.workflowPolicyApplication.findUnique({
      where: { id: workflowAppIdNum },
      include: { status: true }
    });

    if (!workflowApp) {
      return NextResponse.json({ error: 'Workflow application not found' }, { status: 404 });
    }

    // Check if workflow application is in valid state
    const validStatuses = ['UNDERWRITING_COMPLETED', 'PAYMENT_PENDING', 'SIGNED', 'ACTIVE'];
    if (!validStatuses.includes(workflowApp.status?.statusCode || '')) {
      return NextResponse.json(
        {
          error: `Workflow must be in valid state to link. Current status: ${workflowApp.status?.statusName}. Valid states: ${validStatuses.join(', ')}`
        },
        { status: 400 }
      );
    }

    // Verify they belong to the same customer
    if (parametricPolicy.customerId !== workflowApp.customerId) {
      return NextResponse.json(
        {
          error: 'Policy and workflow must belong to the same customer'
        },
        { status: 400 }
      );
    }

    // Check if already linked
    if (workflowApp.parametricPolicyId && workflowApp.parametricPolicyId !== policyIdNum) {
      return NextResponse.json(
        {
          error: 'Workflow application is already linked to a different parametric policy'
        },
        { status: 400 }
      );
    }

    // Create link (transactional)
    const result = await prisma.$transaction(async (tx) => {
      // Update workflow application with parametric policy link
      const updatedWorkflow = await tx.workflowPolicyApplication.update({
        where: { id: workflowAppIdNum },
        data: {
          parametricPolicyId: policyIdNum,
          updatedAt: new Date()
        },
        include: {
          status: true,
          parametricPolicy: true,
          customer: true
        }
      });

      // Update parametric policy status to ACTIVE to reflect workflow link
      const activeStatus = await tx.enumParamPolicyStatus.findFirst({
        where: { statusCode: 'ACTIVE' }
      });

      let updatedPolicy = parametricPolicy;
      if (activeStatus) {
        updatedPolicy = await tx.parametricPolicy.update({
          where: { id: policyIdNum },
          data: {
            statusId: activeStatus.id,
            updatedAt: new Date()
          },
          include: { status: true }
        });
      }

      return { workflow: updatedWorkflow, policy: updatedPolicy };
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        entityType: 'WorkflowPolicyApplication',
        entityId: workflowAppIdNum,
        action: 'WORKFLOW_LINKED_TO_POLICY',
        actionCategory: 'POLICY_MANAGEMENT',
        actorId: auth.userIdNum,
        newValuesJson: JSON.stringify({
          linkedParametricPolicyId: policyIdNum,
          parametricPolicyNumber: result.policy.policyNumber,
          workflowStatus: result.workflow.status?.statusCode,
          policyStatus: result.policy.status?.statusCode
        })
      }
    });

    return NextResponse.json(
      {
        message: 'Workflow successfully linked to parametric policy',
        link: {
          workflowApplicationId: result.workflow.id,
          parametricPolicyId: result.policy.id,
          policyNumber: result.policy.policyNumber,
          workflowStatus: result.workflow.status?.statusName,
          policyStatus: result.policy.status?.statusName,
          customer: {
            id: result.workflow.customer?.id,
            name: result.workflow.customer?.companyName
          }
        }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Policy-workflow linking error:', error);
    return NextResponse.json(
      { error: 'An error occurred while linking workflow to policy' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/policies/[policyId]/workflow-link
 * Retrieves workflow linked to a parametric policy
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { policyId: string } }
) {
  try {
    // Check admin authorization
    const authOrResp = await requireRole(request, Roles.ADMIN);
    if (authOrResp instanceof NextResponse) return authOrResp;

    const { policyId } = params;
    const policyIdNum = parseInt(policyId);

    // Get parametric policy
    const policy = await prisma.parametricPolicy.findUnique({
      where: { id: policyIdNum },
      include: { status: true, customer: true }
    });

    if (!policy) {
      return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
    }

    // Get linked workflow (if any)
    const workflow = await prisma.workflowPolicyApplication.findFirst({
      where: { parametricPolicyId: policyIdNum },
      include: { status: true }
    });

    return NextResponse.json(
      {
        policy: {
          id: policy.id,
          policyNumber: policy.policyNumber,
          status: policy.status?.statusName,
          effectiveDate: policy.effectiveDate,
          expiryDate: policy.expiryDate,
          premium: policy.finalPremium
        },
        linkedWorkflow: workflow
          ? {
              id: workflow.id,
              status: workflow.status?.statusName,
              createdAt: workflow.createdAt,
              linkedAt: workflow.updatedAt
            }
          : null
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get workflow link error:', error);
    return NextResponse.json(
      { error: 'An error occurred while retrieving workflow link' },
      { status: 500 }
    );
  }
}

