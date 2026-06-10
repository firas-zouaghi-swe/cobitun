import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { requireAuth, isOwnerOrAdminAsync, Roles } from '@/lib/services/authorization';

type AuthInfo = NonNullable<Awaited<ReturnType<typeof getAuthInfo>>>;
type WorkflowApp = NonNullable<Awaited<ReturnType<typeof db.workflowPolicyApplication.findUnique>>> & {
  status?: {
    id?: number;
    statusCode?: string | null;
    statusName?: string | null;
    isTerminal?: number;
    nextStatesJson?: string;
  } | null;
  tasks?: Array<{
    id: number;
    actionRequired: string;
    status?: { statusCode?: string | null } | null;
  }>;
  customer?: {
    user?: { id?: number; firstName?: string; lastName?: string; email?: string | null } | null;
    address?: string | null;
  } | null;
  paymentTransactionId?: string | null;
  paymentStatus?: string | null;
  signedPolicyContractPdfUrl?: string | null;
  premiumAmount?: number | string | null;
};
import {
  validatePolicyTransitionWithReason,
  assertPolicyActionAllowed,
  isTerminalPolicyState,
  WorkflowTransitionError,
  transitionWithConcurrencyGuard,
  createTask,
  completeTask,
} from '@/lib/services/workflow-engine';
import { logAction } from '@/lib/services/audit-service';
import { notifyCustomer, notifyAdmins } from '@/lib/services/notification-service';
import { verifyMfaOtp } from '@/lib/services/mfa-service';

interface RouteContext {
  params: { id: string };
}

/**
 * Helper: Check if a file is 0 bytes
 */
function isZeroByteFile(file: File): boolean {
  return file.size === 0;
}

/**
 * GET /api/workflow/policy-applications/[id]
 * v3: Uses WorkflowPolicyApplication model with Int IDs
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const authOrResp = await requireAuth(request);
    if ((authOrResp as any).status) return authOrResp as NextResponse;
    const auth = authOrResp as AuthInfo;

    const { id } = await context.params;
    const parsedId = parseInt(id, 10);

    const application = await db.workflowPolicyApplication.findUnique({
      where: { id: parsedId },
      include: {
        customer: {
          include: { user: { select: { firstName: true, lastName: true, email: true } } },
        },
        product: { select: { id: true, productCode: true, productName: true } },
        status: { select: { id: true, statusCode: true, statusName: true, isTerminal: true, nextStatesJson: true } },
        tasks: {
          where: { isDeleted: 0 },
          include: {
            actor: { select: { actorCode: true, actorName: true } },
            status: { select: { statusCode: true, statusName: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!application) {
      return NextResponse.json({ error: 'Policy application not found' }, { status: 404 });
    }

    // Fetch audit logs separately
    const auditLogs = await db.auditLog.findMany({
      where: { entityType: 'WorkflowPolicyApplication', entityId: parsedId },
      orderBy: { createdAt: 'desc' },
    });

    // Access control: customer can only see their own (or admins)
    if (!(await isOwnerOrAdminAsync(auth, application.customerId))) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Flatten status for client convenience (top-level `statusCode`/`statusName`)
    const applicationOut = { ...application, statusCode: application.status?.statusCode ?? null, statusName: application.status?.statusName ?? null };
    return NextResponse.json({ application: applicationOut, auditLogs });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/workflow/policy-applications/[id]
 * Soft-deletes a policy application if not in a terminal state.
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const auth = await getAuthInfo(request);
    if (!auth) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await context.params;
    const parsedId = parseInt(id, 10);

    // Fetch the application with status
    const application = await db.workflowPolicyApplication.findUnique({
      where: { id: parsedId },
      include: {
        status: { select: { statusCode: true } },
      },
    });

    if (!application) {
      return NextResponse.json({ error: 'Policy application not found' }, { status: 404 });
    }

    const currentStatusCode = application.status?.statusCode || '';

    // Terminal state check — cannot delete immutable records
    if (currentStatusCode === 'UnderwritingCompleted' || currentStatusCode === 'Rejected') {
      return NextResponse.json(
        { error: 'Immutable record — deletion rejected' },
        { status: 409 }
      );
    }

    // Perform soft delete
    await db.workflowPolicyApplication.update({
      where: { id: parsedId },
      data: {
        isDeleted: 1,
        deletedAt: new Date(),
        deletedBy: auth.userIdNum,
      },
    });

    // Log the action
    await logAction({
      entityType: 'WorkflowPolicyApplication',
      entityId: parsedId,
      actorId: auth.userIdNum,
      action: 'Policy application soft-deleted',
      actionCategory: 'WORKFLOW',
      metadata: { previousStatus: currentStatusCode },
    });

    return NextResponse.json({ message: 'Policy application deleted successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/workflow/policy-applications/[id]
 * v3: Uses WorkflowPolicyApplication, WorkflowPolicyTask, EnumWorkflowAppStatus
 * Status transitions use enum_workflow_app_status
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const auth = await getAuthInfo(request);
    if (!auth) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = context.params;
    const parsedId = parseInt(id, 10);

    // Fetch the application
    const application = await db.workflowPolicyApplication.findUnique({
      where: { id: parsedId },
      include: {
        tasks: {
          where: { isDeleted: 0 },
          include: {
            actor: { select: { actorCode: true } },
            status: { select: { statusCode: true } },
          },
        },
        customer: { include: { user: true } },
        status: { select: { id: true, statusCode: true, statusName: true, isTerminal: true, nextStatesJson: true } },
      },
    });

    if (!application) {
      return NextResponse.json({ error: 'Policy application not found' }, { status: 404 });
    }

    // Get current status code
    const currentStatusCode = application.status?.statusCode || '';

    // Guard: Terminal state immutability
    if (isTerminalPolicyState(currentStatusCode)) {
      return NextResponse.json(
        { error: 'Terminal state — modifications forbidden' },
        { status: 409 }
      );
    }

    // Parse request body - support both JSON and multipart/form-data
    const contentType = request.headers.get('content-type') || '';
    let action: string | null = null;
    let formData: FormData | null = null;
    let jsonBody: Record<string, unknown> | null = null;

    if (contentType.includes('multipart/form-data')) {
      formData = await request.formData();
      action = formData.get('action') as string | null;
    } else {
      jsonBody = await request.json();
      action = (jsonBody?.action as string) || null;
    }

    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 });
    }

    // Cast to WorkflowApp for handler compatibility
    const app = application as unknown as WorkflowApp;

    switch (action) {
      case 'review':
        return await handleReview(auth, app, formData, jsonBody);
      case 'sign':
        return await handleSign(auth, app, formData, jsonBody);
      case 'pay':
        return await handlePay(auth, app, formData, jsonBody, request);
      case 'final-sign':
        return await handleFinalSign(auth, app, formData, jsonBody);
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof WorkflowTransitionError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Helper: Look up enum status ID by statusCode
 */
async function getStatusIdByCode(statusCode: string): Promise<number | null> {
  const status = await db.enumWorkflowAppStatus.findFirst({
    where: { statusCode, isCurrent: 1 },
    select: { id: true },
  });
  return status?.id ?? null;
}

/**
 * Admin Step 1.2: Review provider contract
 * v3: Uses EnumWorkflowAppStatus transitions
 */
async function handleReview(
  auth: AuthInfo,
  application: WorkflowApp,
  formData: FormData | null,
  jsonBody: Record<string, unknown> | null
) {
  // Dynamic import to prevent Turbopack whole-project tracing
  const { generatePolicyContract } = await import('@/lib/services/pdf-generator');

  if (auth.role !== Roles.ADMIN) {
    return NextResponse.json({ error: 'Only admins can review provider contracts' }, { status: 403 });
  }

  const approved = formData ? formData.get('approved') as string : String(jsonBody?.approved);
  const rejectionReason = formData ? formData.get('rejectionReason') as string : (jsonBody?.rejectionReason as string) || null;

  const currentStatusCode = application.status?.statusCode || '';

  if (approved === null) {
    return NextResponse.json({ error: 'approved field is required' }, { status: 400 });
  }

  const isApproved = approved === 'true';

  // RBAC check using workflow-engine
  assertPolicyActionAllowed('REVIEW', currentStatusCode, auth.role, { isOwner: true, hasApprovalPrivilege: true });

  // If application already progressed to PolicyContractGenerated, treat this as idempotent success
  if (currentStatusCode === 'PolicyContractGenerated') {
    const out = { ...application, statusCode: application.status?.statusCode ?? null, statusName: application.status?.statusName ?? null };
    return NextResponse.json({ application: out });
  }

  // Must be in AdminReviewing status to review
  if (currentStatusCode !== 'AdminReviewing') {
    return NextResponse.json(
      { error: `Cannot review application in status ${currentStatusCode}. Expected AdminReviewing.` },
      { status: 409 }
    );
  }

  if (isApproved) {
    // Transition: AdminReviewing → PolicyContractGenerated
    const transitionResult = validatePolicyTransitionWithReason('AdminReviewing', 'PolicyContractGenerated');
    if (!transitionResult.valid) {
      return NextResponse.json(
        { error: transitionResult.error },
        { status: transitionResult.httpStatus }
      );
    }

    // Use concurrency guard for the transition
    return await transitionWithConcurrencyGuard(
      'PolicyApplication',
      application.id,
      currentStatusCode,
      async () => {
        // v3: Complete the ReviewProviderContract task using WorkflowPolicyTask
        const adminReviewTasks = application.tasks ?? [];
        const reviewTask = adminReviewTasks.find(
          (t) => t.actionRequired === 'ReviewProviderContract' && t.status?.statusCode === 'PENDING'
        );
        if (reviewTask) {
          await completeTask(reviewTask.id, 'Policy', auth.userIdNum);
        }

        // Generate the policy contract PDF
        const customerUser = application.customer?.user;
        if (!customerUser) {
          throw new Error('Customer user record not found');
        }

        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 10);
        const policyNumber = `COBITUN-C${timestamp.toUpperCase()}${random.toUpperCase()}`;

        const policyContractPath = await generatePolicyContract({
          policyNumber,
          customerName: `${customerUser.firstName} ${customerUser.lastName}`,
          customerEmail: customerUser.email || '',
          customerAddress: application.customer?.address ?? '',
          sector: 'Other',
          annualTurnover: 0,
          premiumAmount: Number(application.premiumAmount) || 0,
          currency: 'TND',
          effectiveDate: new Date().toISOString().split('T')[0],
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          coverageTerms: [
            'Couverture contre les pannes de service cloud',
            'Indemnisation parametrique basee sur la duree de panne',
            'Protection contre les pertes de revenus liees aux interruptions',
          ],
          cloudProvider: undefined,
          signatureBlocks: [
            { label: "Signature de l'Assure", line: 'Client' },
            { label: 'Signature COBITUN', line: 'Compagnie' },
          ],
        });

        // Update application with policy contract and new status
        const policyContractGeneratedStatusId = await getStatusIdByCode('PolicyContractGenerated');
        const updated = await db.workflowPolicyApplication.update({
          where: { id: application.id },
          data: {
            statusId: policyContractGeneratedStatusId,
            insurancePolicyContractPdfUrl: policyContractPath,
          },
          include: {
            tasks: { where: { isDeleted: 0 }, include: { status: { select: { statusCode: true } } } },
            status: { select: { statusCode: true, statusName: true } },
          },
        });

        // v3: Create SignPolicyContract task using WorkflowPolicyTask
        await createTask({
          entityType: 'Policy',
          policyApplicationId: application.id,
          actorCode: Roles.CUSTOMER,
          actionRequired: 'SignPolicyContract',
        });

        // Log audit
        await logAction({
          entityType: 'WorkflowPolicyApplication',
          entityId: application.id,
          actorId: auth.userIdNum,
          action: 'Admin approved provider contract and generated policy contract',
          actionCategory: 'WORKFLOW',
          metadata: { policyNumber, policyContractPath },
        });

        // Notify customer (use customer.user.id and link notification to this policy)
        const custUserId = application.customer?.user?.id ?? null;
        if (custUserId) {
          await notifyCustomer(
            custUserId,
            'Your provider contract has been approved. Please sign the policy contract and pay the premium.',
            'action_required',
            { parametricPolicyId: application.id }
          );
        }

        const updatedOut = { ...updated, statusCode: updated.status?.statusCode ?? null, statusName: updated.status?.statusName ?? null };
        return NextResponse.json({ application: updatedOut });
      }
    );
  } else {
    // Rejected path
    // W1-D-04: Require non-empty rejection reason
    if (!rejectionReason || rejectionReason.trim().length === 0) {
      return NextResponse.json(
        { error: 'Rejection reason is required when not approving' },
        { status: 400 }
      );
    }

    // W1-D-05: Max 5000 chars for rejection reason
    if (rejectionReason.length > 5000) {
      return NextResponse.json(
        { error: 'Rejection reason must not exceed 5000 characters' },
        { status: 400 }
      );
    }

    const transitionResult = validatePolicyTransitionWithReason('AdminReviewing', 'Rejected');
    if (!transitionResult.valid) {
      return NextResponse.json(
        { error: transitionResult.error },
        { status: transitionResult.httpStatus }
      );
    }

    // Use concurrency guard for the rejection transition
    return await transitionWithConcurrencyGuard(
      'PolicyApplication',
      application.id,
      currentStatusCode,
      async () => {
        const rejectedTasks = application.tasks ?? [];
        const reviewTask = rejectedTasks.find(
          (t) => t.actionRequired === 'ReviewProviderContract' && t.status?.statusCode === 'PENDING'
        );
        if (reviewTask) {
          await completeTask(reviewTask.id, 'Policy', auth.userIdNum);
        }

        const rejectedStatusId = await getStatusIdByCode('Rejected');
        const updated = await db.workflowPolicyApplication.update({
          where: { id: application.id },
          data: {
            statusId: rejectedStatusId,
            rejectionReason: rejectionReason || null,
            rejectedBy: auth.userIdNum,
            rejectedAt: new Date(),
          },
          include: {
            tasks: { where: { isDeleted: 0 }, include: { status: { select: { statusCode: true } } } },
            status: { select: { statusCode: true, statusName: true } },
          },
        });

        // Log audit
        await logAction({
          entityType: 'WorkflowPolicyApplication',
          entityId: application.id,
          actorId: auth.userIdNum,
          action: 'Admin rejected provider contract',
          actionCategory: 'WORKFLOW',
          metadata: { rejectionReason: rejectionReason || 'No reason provided' },
        });

        // Notify customer
        const rejectedCustUserId = application.customer?.user?.id ?? null;
        if (rejectedCustUserId) {
          await notifyCustomer(
            rejectedCustUserId,
            `Your policy application has been rejected. Reason: ${rejectionReason || 'No reason provided'}`,
            'warning',
            { parametricPolicyId: application.id }
          );
        }

        const updatedOut = { ...updated, statusCode: updated.status?.statusCode ?? null, statusName: updated.status?.statusName ?? null };
        return NextResponse.json({ application: updatedOut });
      }
    );
  }
}

/**
 * Customer Step 1.4: Sign policy contract
 */
async function handleSign(
  auth: AuthInfo,
  application: WorkflowApp,
  formData: FormData | null,
  jsonBody: Record<string, unknown> | null
) {
  // Dynamic imports to prevent Turbopack whole-project tracing
  const { validatePdf, saveUploadedFile } = await import('@/lib/services/file-storage');

  if (auth.role !== Roles.CUSTOMER) {
    return NextResponse.json({ error: 'Only customers can sign policy contracts' }, { status: 403 });
  }

  const isOwner = await isOwnerOrAdminAsync(auth, application.customerId);
  if (!isOwner) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const signedContractPdf = formData ? formData.get('signedContractPdf') as File | null : null;
  if (!signedContractPdf) {
    return NextResponse.json({ error: 'signedContractPdf file is required' }, { status: 400 });
  }

  const currentStatusCode = application.status?.statusCode || '';

  // RBAC check using workflow-engine
  assertPolicyActionAllowed('SIGN', currentStatusCode, auth.role, { isOwner });

  if (currentStatusCode !== 'PolicyContractGenerated') {
    return NextResponse.json(
      { error: `Cannot sign contract in status ${currentStatusCode}. Expected PolicyContractGenerated.` },
      { status: 409 }
    );
  }

  const isValidPdf = await validatePdf(signedContractPdf);
  if (!isValidPdf) {
    return NextResponse.json(
      { error: 'Invalid PDF file: must be application/pdf, max 10MB, with valid %PDF- header' },
      { status: 415 }
    );
  }

  const transitionResult = validatePolicyTransitionWithReason(currentStatusCode, 'AwaitingSignatureAndPayment');
  if (!transitionResult.valid) {
    return NextResponse.json(
      { error: transitionResult.error },
      { status: transitionResult.httpStatus }
    );
  }

  // Use concurrency guard for the transition
  return await transitionWithConcurrencyGuard(
    'PolicyApplication',
    application.id,
    currentStatusCode,
    async () => {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 10);
      const fileName = `COBITUN_police_assurance_parametrique_signee_c${timestamp}${random}.pdf`;
      const uploadedRecord = await saveUploadedFile({
        file: signedContractPdf,
        fileName,
        fileCategory: 'workflow.policy.signed_contract',
        uploadedBy: auth.userIdNum,
        isPublic: false,
        entityRefs: { workflowPolicyAppId: application.id },
      });
      const savedFilePath = uploadedRecord.filePath;

      // Complete the SignPolicyContract task
      const signTask = application.tasks?.find(
        (t) => t.actionRequired === 'SignPolicyContract' && t.status?.statusCode === 'PENDING'
      );
      if (signTask) {
        await completeTask(signTask.id, 'Policy', auth.userIdNum);
      }

      const awaitingStatusId = await getStatusIdByCode('AwaitingSignatureAndPayment');
      const updated = await db.workflowPolicyApplication.update({
        where: { id: application.id },
        data: {
          signedPolicyContractPdfUrl: savedFilePath,
          statusId: awaitingStatusId,
          customerSignedAt: new Date(),
        },
        include: {
          tasks: { where: { isDeleted: 0 }, include: { status: { select: { statusCode: true } } } },
          status: { select: { statusCode: true, statusName: true } },
        },
      });

      // Create PayPremium task for Customer
      await createTask({
        entityType: 'Policy',
        policyApplicationId: application.id,
        actorCode: Roles.CUSTOMER,
        actionRequired: 'PayPremium',
      });

      // Log audit
      await logAction({
        entityType: 'WorkflowPolicyApplication',
        entityId: application.id,
        actorId: auth.userIdNum,
        action: 'Customer signed policy contract',
        actionCategory: 'WORKFLOW',
        metadata: { fileName },
      });

      // Notify all admins (include policy id in entity refs)
      await notifyAdmins(
        `Customer ${application.customerId} has signed the policy contract for application ${application.id}`,
        'info',
        { parametricPolicyId: application.id }
      );

      const updatedOut = { ...updated, statusCode: updated.status?.statusCode ?? null, statusName: updated.status?.statusName ?? null };
      return NextResponse.json({ application: updatedOut });
    }
  );
}

async function handlePay(
  auth: AuthInfo,
  application: WorkflowApp,
  formData: FormData | null,
  jsonBody: Record<string, unknown> | null,
  request: NextRequest
) {
  if (auth.role !== Roles.CUSTOMER) {
    return NextResponse.json({ error: 'Only customers can pay premiums' }, { status: 403 });
  }

  const isOwner = await isOwnerOrAdminAsync(auth, application.customerId);
  if (!isOwner) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const idempotencyKey = request.headers.get('idempotency-key') || request.headers.get('Idempotency-Key') || null;
  if (idempotencyKey) {
    const idemp = await (await import('@/lib/idempotency')).default.getCachedResponse(idempotencyKey);
    if (idemp) {
      return NextResponse.json(idemp.body, { status: idemp.status });
    }
    await (await import('@/lib/idempotency')).default.reserveKey(
      idempotencyKey,
      auth.userIdNum,
      'PATCH',
      `/api/workflow/policy-applications/${application.id}`,
      jsonBody || Object.fromEntries(formData || [])
    );
  }

  const getField = (name: string) => formData ? formData.get(name) as string | null : (jsonBody?.[name] as string) || null;
  const premiumTransactionId = getField('premiumTransactionId');
  const paymentAmount = getField('paymentAmount');

  if (!premiumTransactionId) {
    return NextResponse.json({ error: 'premiumTransactionId is required' }, { status: 400 });
  }

  const currentStatusCode = application.status?.statusCode || '';

  // RBAC check using workflow-engine
  assertPolicyActionAllowed('PAY', currentStatusCode, auth.role, { isOwner });

  if (currentStatusCode !== 'AwaitingSignatureAndPayment') {
    return NextResponse.json(
      { error: `Cannot pay premium in status ${currentStatusCode}. Expected AwaitingSignatureAndPayment.` },
      { status: 409 }
    );
  }

  const transitionResult = validatePolicyTransitionWithReason(currentStatusCode, 'ReadyForFinalApproval');
  if (!transitionResult.valid) {
    return NextResponse.json(
      { error: transitionResult.error },
      { status: transitionResult.httpStatus }
    );
  }

  // W1-D-09: Validate payment amount matches premium
  if (application.premiumAmount && paymentAmount) {
    const expectedPremium = Number(application.premiumAmount);
    const actualPayment = Number(paymentAmount);
    if (!isNaN(expectedPremium) && !isNaN(actualPayment) && expectedPremium > 0 && actualPayment !== expectedPremium) {
      return NextResponse.json(
        { error: `Payment amount (${actualPayment}) does not match premium amount (${expectedPremium})` },
        { status: 400 }
      );
    }
  }

  if (application.paymentTransactionId) {
    const alreadyPaidApp = {
      ...application,
      statusCode: application.status?.statusCode ?? null,
      statusName: application.status?.statusName ?? null,
    };
    const out = {
      message: 'Already paid',
      premiumTransactionId: application.paymentTransactionId,
      application: alreadyPaidApp,
    };
    if (idempotencyKey) {
      await (await import('@/lib/idempotency')).default.storeResponseForKey(idempotencyKey, 200, out);
    }
    return NextResponse.json(out);
  }

  // Verify signed contract exists before allowing payment
  if (!application.signedPolicyContractPdfUrl) {
    return NextResponse.json(
      { error: 'Signed policy contract is required before paying the premium' },
      { status: 400 }
    );
  }

  // Use concurrency guard for the transition
  return await transitionWithConcurrencyGuard(
    'PolicyApplication',
    application.id,
    currentStatusCode,
    async () => {
      const payTask = application.tasks?.find(
        (t) => t.actionRequired === 'PayPremium' && t.status?.statusCode === 'PENDING'
      );
      if (payTask) {
        await completeTask(payTask.id, 'Policy', auth.userIdNum);
      }

      const readyStatusId = await getStatusIdByCode('ReadyForFinalApproval');
      const updated = await db.workflowPolicyApplication.update({
        where: { id: application.id },
        data: {
          paymentTransactionId: premiumTransactionId,
          paymentStatus: 'PAID',
          premiumPaidAt: new Date(),
          statusId: readyStatusId,
        },
        include: {
          tasks: { where: { isDeleted: 0 }, include: { status: { select: { statusCode: true } } } },
          status: { select: { statusCode: true, statusName: true } },
        },
      });

      // Always create FinalAdminSign task after payment (signed contract already verified above)
      await createTask({
        entityType: 'Policy',
        policyApplicationId: application.id,
        actorCode: Roles.ADMIN,
        actionRequired: 'FinalAdminSign',
      });

      await logAction({
        entityType: 'WorkflowPolicyApplication',
        entityId: application.id,
        actorId: auth.userIdNum,
        action: 'Customer paid premium',
        actionCategory: 'WORKFLOW',
        metadata: { premiumTransactionId },
      });

      await notifyAdmins(
        `Customer ${application.customerId} has paid the premium for application ${application.id}. Ready for final admin sign.`,
        'action_required',
        { parametricPolicyId: application.id }
      );

      const updatedOut = { ...updated, statusCode: updated.status?.statusCode ?? null, statusName: updated.status?.statusName ?? null };
      if (idempotencyKey) {
        await (await import('@/lib/idempotency')).default.storeResponseForKey(idempotencyKey, 200, { application: updatedOut });
      }

      return NextResponse.json({ application: updatedOut });
    }
  );
}

/**
 * Admin Step 1.6: Final admin sign
 */
async function handleFinalSign(
  auth: AuthInfo,
  application: WorkflowApp,
  formData: FormData | null,
  jsonBody: Record<string, unknown> | null
) {
  if (auth.role !== Roles.ADMIN) {
    return NextResponse.json({ error: 'Only admins can finalize applications' }, { status: 403 });
  }

  const isOwner = await isOwnerOrAdminAsync(auth, application.customerId);
  if (!isOwner) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const currentStatusCode = application.status?.statusCode || '';

  // RBAC check using workflow-engine
  assertPolicyActionAllowed('FINAL_APPROVE', currentStatusCode, auth.role, { isOwner: true, hasUnderwritingPrivilege: true });

  // W1-D-12: Require 2FA verification
  const getField = (name: string) => formData ? formData.get(name) as string | null : (jsonBody?.[name] as string) || null;
  const mfaToken = getField('mfaToken');
  if (!mfaToken) {
    return NextResponse.json({ error: 'Final signature requires 2FA verification' }, { status: 403 });
  }
  const mfaResult = await verifyMfaOtp(auth.userIdNum, mfaToken);
  if (!mfaResult.valid) {
    return NextResponse.json({ error: `2FA verification failed: ${mfaResult.message}` }, { status: 403 });
  }

  // Must be in ReadyForFinalApproval status to final-sign
  if (currentStatusCode !== 'ReadyForFinalApproval') {
    return NextResponse.json(
      { error: `Cannot finalize application in status ${currentStatusCode}. Expected ReadyForFinalApproval.` },
      { status: 409 }
    );
  }

  // Verify signed contract exists
  if (!application.signedPolicyContractPdfUrl) {
    return NextResponse.json(
      { error: 'Signed policy contract is required before final sign' },
      { status: 400 }
    );
  }

  if (!application.paymentTransactionId || application.paymentStatus !== 'PAID') {
    return NextResponse.json(
      { error: 'Premium payment is required before final sign' },
      { status: 400 }
    );
  }

  const transitionResult = validatePolicyTransitionWithReason(currentStatusCode, 'UnderwritingCompleted');
  if (!transitionResult.valid) {
    return NextResponse.json(
      { error: transitionResult.error },
      { status: transitionResult.httpStatus }
    );
  }

  // Use concurrency guard for the transition
  return await transitionWithConcurrencyGuard(
    'PolicyApplication',
    application.id,
    currentStatusCode,
    async () => {
      const finalSignTask = application.tasks?.find(
        (t) => t.actionRequired === 'FinalAdminSign' && t.status?.statusCode === 'PENDING'
      );
      if (finalSignTask) {
        await completeTask(finalSignTask.id, 'Policy', auth.userIdNum);
      }

      const completedStatusId = await getStatusIdByCode('UnderwritingCompleted');
      const updated = await db.workflowPolicyApplication.update({
        where: { id: application.id },
        data: {
          statusId: completedStatusId,
          adminFinalSignatureAt: new Date(),
          adminFinalizedBy: auth.userIdNum,
        },
        include: {
          tasks: { where: { isDeleted: 0 }, include: { status: { select: { statusCode: true } } } },
          status: { select: { statusCode: true, statusName: true } },
        },
      });

      await logAction({
        entityType: 'WorkflowPolicyApplication',
        entityId: application.id,
        actorId: auth.userIdNum,
        action: 'Admin final-signed — underwriting completed, policy now immutable',
        actionCategory: 'WORKFLOW',
        metadata: {
          signedContract: application.signedPolicyContractPdfUrl,
          paymentTransactionId: application.paymentTransactionId,
        },
      });

      const customerUserId = application.customer?.user?.id ?? null;
      if (customerUserId) {
        await notifyCustomer(
          customerUserId,
          'Your policy application has been fully approved. Underwriting is complete and your policy is now active.',
          'info',
          { parametricPolicyId: application.id }
        );
      }

      const updatedOut = { ...updated, statusCode: updated.status?.statusCode ?? null, statusName: updated.status?.statusName ?? null };
      return NextResponse.json({ application: updatedOut });
    }
  );
}
