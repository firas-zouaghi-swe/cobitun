import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { Roles, isOwnerOrAdminAsync } from '@/lib/services/authorization';
import { createTask } from '@/lib/services/workflow-engine';
import { generateDeclarationOfLoss } from '@/lib/services/pdf-generator';
import { logAction } from '@/lib/services/audit-service';
import { notifyCustomer } from '@/lib/services/notification-service';

/**
 * Generate claim number using sequence_registry
 */
async function generateClaimNumber(): Promise<string> {
  const sequenceName = 'workflow_claim';
  const currentYear = new Date().getFullYear();

  // Use interactive transaction to prevent race conditions on concurrent requests
  const result = await db.$transaction(async (tx) => {
    const sequence = await tx.sequenceRegistry.upsert({
      where: { sequenceName },
      create: {
        sequenceName,
        currentValue: 1,
        prefix: 'WCL',
        paddingWidth: 6,
        yearReset: 1,
        lastYear: currentYear,
      },
      update: {},
    });

    let currentValue = sequence.currentValue;
    if (sequence.yearReset === 1 && sequence.lastYear !== currentYear) {
      currentValue = 1;
      await tx.sequenceRegistry.update({
        where: { sequenceName },
        data: { currentValue: 2, lastYear: currentYear },
      });
    } else {
      await tx.sequenceRegistry.update({
        where: { sequenceName },
        data: { currentValue: currentValue + 1 },
      });
    }

    const padded = String(currentValue).padStart(sequence.paddingWidth, '0');
    return `${sequence.prefix}-${currentYear}-${padded}`;
  });

  return result;
}

/**
 * GET /api/workflow/claims
 * v3: Uses WorkflowClaim model, statusId → join EnumWorkflowClaimStatus
 * WorkflowClaimTask for tasks
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthInfo(request);
    if (!auth) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    let claims;

    if (auth.role === Roles.ADMIN) {
      claims = await db.workflowClaim.findMany({
        where: { isDeleted: 0 },
        include: {
          customer: {
            include: { user: { select: { firstName: true, lastName: true, email: true } } },
          },
          policyApplication: {
            select: { id: true, applicationNumber: true, status: { select: { statusCode: true, statusName: true } } },
          },
          status: { select: { id: true, statusCode: true, statusName: true } },
          tasks: {
            where: { isDeleted: 0 },
            include: {
              actor: { select: { actorCode: true, actorName: true } },
              status: { select: { statusCode: true, statusName: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      const customer = await db.customer.findUnique({
        where: { userId: auth.userIdNum },
      });

      if (!customer) {
        return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });
      }

      claims = await db.workflowClaim.findMany({
        where: { customerId: customer.id, isDeleted: 0 },
        include: {
          policyApplication: {
            select: { id: true, applicationNumber: true, status: { select: { statusCode: true, statusName: true } } },
          },
          status: { select: { id: true, statusCode: true, statusName: true } },
          tasks: {
            where: { isDeleted: 0 },
            include: {
              actor: { select: { actorCode: true, actorName: true } },
              status: { select: { statusCode: true, statusName: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    return NextResponse.json({ claims });
  } catch (error) {
    console.error('Error listing workflow claims:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/workflow/claims
 * v3: Uses WorkflowClaim model, WorkflowClaimTask for tasks
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthInfo(request);
    if (!auth) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { customerId, policyApplicationId, lossDescription } = body;

    if (!customerId) {
      return NextResponse.json({ error: 'customerId is required' }, { status: 400 });
    }

    if (!policyApplicationId) {
      return NextResponse.json({ error: 'policyApplicationId is required' }, { status: 400 });
    }

    // W2-D-01: Validate lossDescription is non-empty
    if (!lossDescription || lossDescription.trim().length === 0) {
      return NextResponse.json({ error: 'lossDescription is required' }, { status: 400 });
    }

    const parsedCustomerId = parseInt(customerId, 10);
    const parsedPolicyAppId = parseInt(policyApplicationId, 10);

    // Verify the customer exists
    const customer = await db.customer.findUnique({
      where: { id: parsedCustomerId },
      include: { user: true },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // If customer role, verify they own this customer record or admin
    if (!(await isOwnerOrAdminAsync(auth, parsedCustomerId))) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Verify the policy application exists and belongs to the customer
    const policyApplication = await db.workflowPolicyApplication.findUnique({
      where: { id: parsedPolicyAppId },
      include: { status: { select: { statusCode: true } } },
    });

    if (!policyApplication) {
      return NextResponse.json({ error: 'Policy application not found' }, { status: 404 });
    }

    if (policyApplication.customerId !== parsedCustomerId) {
      return NextResponse.json({ error: 'Policy application does not belong to this customer' }, { status: 403 });
    }

    // Verify the policy is active (UnderwritingCompleted)
    if (policyApplication.status?.statusCode !== 'UnderwritingCompleted') {
      return NextResponse.json(
        { error: 'Cannot create claim for a policy that is not yet active (underwriting not completed)' },
        { status: 400 }
      );
    }

    // v3: Look up Open status
    const openStatus = await db.enumWorkflowClaimStatus.findFirst({
      where: { statusCode: 'Open', isCurrent: 1 },
      select: { id: true },
    });

    // Generate claim number first so we can use it in the PDF
    const claimNumber = await generateClaimNumber();

    // Create the workflow claim (v3 model) without PDF first
    const claim = await db.workflowClaim.create({
      data: {
        claimNumber,
        policyApplicationId: parsedPolicyAppId,
        customerId: parsedCustomerId,
        statusId: openStatus?.id ?? null,
        lossDescription: lossDescription || null,
      },
      include: {
        tasks: true,
        status: { select: { statusCode: true, statusName: true } },
      },
    });

    // Generate Declaration of Loss PDF with actual claim number (single generation)
    const declarationPdfPath = await generateDeclarationOfLoss({
      claimId: claim.claimNumber,
      policyNumber: policyApplication.applicationNumber || `WPA-${parsedPolicyAppId}`,
      customerName: `${customer.user.firstName} ${customer.user.lastName}`,
      lossAmount: 0,
      lossStartDate: new Date().toISOString().split('T')[0],
      lossEndDate: new Date().toISOString().split('T')[0],
      lossDescription: lossDescription || 'To be completed by the customer',
      declarationDate: new Date().toISOString().split('T')[0],
    });

    await db.workflowClaim.update({
      where: { id: claim.id },
      data: { declarationOfLossPdfUrl: declarationPdfPath },
    });

    // v3: Create a FillDeclarationOfLoss task using WorkflowClaimTask
    await createTask({
      entityType: 'Claim',
      workflowClaimId: claim.id,
      actorCode: Roles.CUSTOMER,
      actionRequired: 'FillDeclarationOfLoss',
    });

    // Log the action
    await logAction({
      entityType: 'WorkflowClaim',
      entityId: claim.id,
      actorId: auth.userIdNum,
      action: 'Claim created — declaration of loss generated',
      actionCategory: 'WORKFLOW',
      metadata: {
        customerId: parsedCustomerId,
        policyApplicationId: parsedPolicyAppId,
        lossDescription: lossDescription || null,
        claimNumber: claim.claimNumber,
      },
    });

    // Notify customer
    await notifyCustomer(
      customer.user.id,
      `A claim has been created for your policy. Please fill in the declaration of loss details.`,
      'action_required'
    );

    return NextResponse.json({ claim }, { status: 201 });
  } catch (error) {
    console.error('Error creating workflow claim:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

