import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthInfo, AuthInfo } from '@/lib/services/auth-helper';
import { Roles, isOwnerOrAdminAsync } from '@/lib/services/authorization';
import {
  validateClaimTransitionWithReason,
  assertClaimActionAllowed,
  isTerminalClaimState,
  WorkflowTransitionError,
  transitionWithConcurrencyGuard,
  createTask,
  completeTask,
} from '@/lib/services/workflow-engine';
import { logAction } from '@/lib/services/audit-service';
import { notifyCustomer, notifyAdmins } from '@/lib/services/notification-service';

interface RouteContext {
  params: { id: string };
}

type WorkflowClaimWithRelations = Awaited<ReturnType<typeof db.workflowClaim.findUnique>> & {
  customer: { user: { id: number; firstName: string; lastName: string; email: string } };
  status: { id: number; statusCode: string; statusName: string; isTerminal: number } | null;
  tasks: {
    id: number;
    actionRequired: string;
    status: { statusCode: string } | null;
  }[];
  policyApplication: { id: number; applicationNumber: string };
};

/**
 * GET /api/workflow/claims/[id]
 * v3: Uses WorkflowClaim model, WorkflowClaimTask for tasks
 */
export async function GET(
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

    const claim = await db.workflowClaim.findUnique({
      where: { id: parsedId },
      include: {
        customer: {
          include: { user: { select: { firstName: true, lastName: true, email: true } } },
        },
        policyApplication: {
          select: {
            id: true,
            applicationNumber: true,
            status: { select: { statusCode: true, statusName: true } },
          },
        },
        status: { select: { id: true, statusCode: true, statusName: true, isTerminal: true } },
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

    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    // Fetch audit logs separately
    const auditLogs = await db.auditLog.findMany({
      where: { entityType: 'WorkflowClaim', entityId: parsedId },
      orderBy: { createdAt: 'desc' },
    });

    // Access control: customer can only see their own (or admins) — use async version
    if (!(await isOwnerOrAdminAsync(auth, claim.customerId))) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({ claim, auditLogs });
  } catch (error) {
    // Ignore retrieval errors
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/workflow/claims/[id]
 * Soft-deletes a claim unless it is in a terminal state (Completed).
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

    const { id } = context.params;
    const parsedId = parseInt(id, 10);

    const claim = await db.workflowClaim.findUnique({
      where: { id: parsedId },
      include: {
        status: { select: { id: true, statusCode: true, statusName: true, isTerminal: true } },
      },
    });

    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    const currentStatusCode = claim.status?.statusCode || '';

    // Terminal state guard — cannot delete completed claims
    if (currentStatusCode === 'Completed') {
      return NextResponse.json(
        { error: 'Immutable record — deletion rejected' },
        { status: 409 }
      );
    }

    // Ownership check
    if (!(await isOwnerOrAdminAsync(auth, claim.customerId))) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Soft delete
    await db.workflowClaim.update({
      where: { id: parsedId },
      data: {
        isDeleted: 1,
        deletedAt: new Date(),
        deletedBy: auth.userIdNum,
      },
    });

    // Log the deletion
    await logAction({
      entityType: 'WorkflowClaim',
      entityId: parsedId,
      actorId: auth.userIdNum,
      action: 'Claim soft-deleted',
      actionCategory: 'WORKFLOW',
      metadata: {
        claimNumber: claim.claimNumber,
        previousStatus: currentStatusCode,
      },
    });

    return NextResponse.json({ message: 'Claim deleted successfully' });
  } catch (error) {
    // Ignore deletion errors
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/workflow/claims/[id]
 * v3: Uses WorkflowClaim, WorkflowClaimTask
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

    // Fetch the claim
    const claim = await db.workflowClaim.findUnique({
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
        policyApplication: {
          select: {
            id: true,
            applicationNumber: true,
            status: { select: { statusCode: true, statusName: true } },
          },
        },
        status: { select: { id: true, statusCode: true, statusName: true, isTerminal: true } },
      },
    });

    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    const currentStatusCode = claim.status?.statusCode || '';

    // Terminal state guard — reject modifications on any terminal state
    if (isTerminalClaimState(currentStatusCode)) {
      return NextResponse.json(
        { error: 'Terminal state — modifications forbidden' },
        { status: 409 }
      );
    }

    // Parse request body
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

    switch (action) {
      case 'submit':
        return await handleSubmit(auth, claim as unknown as WorkflowClaimWithRelations, formData, jsonBody, request);
      case 'complete':
        return await handleComplete(auth, claim as unknown as WorkflowClaimWithRelations, formData, jsonBody, request);
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof WorkflowTransitionError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    // Ignore update errors
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Helper: Look up enum claim status ID by statusCode
 */
async function getClaimStatusIdByCode(statusCode: string): Promise<number | null> {
  const status = await db.enumWorkflowClaimStatus.findFirst({
    where: { statusCode, isCurrent: 1 },
    select: { id: true },
  });
  return status?.id ?? null;
}

/**
 * Customer Step 2.2: Submit declaration of loss details
 * v3: Uses WorkflowClaimTask
 */
async function handleSubmit(
  auth: AuthInfo,
  claim: WorkflowClaimWithRelations,
  formData: FormData | null,
  jsonBody: Record<string, unknown> | null,
  request: NextRequest
) {
  const currentStatusCode = claim.status?.statusCode || '';
  const isOwner = await isOwnerOrAdminAsync(auth, claim.customerId);

  // W2-R-01 / W2-R-02: RBAC assertion
  assertClaimActionAllowed('SUBMIT', currentStatusCode, auth.role, { isOwner });

  // Idempotency key support
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
      `/api/workflow/claims/${claim.id}`,
      jsonBody || Object.fromEntries(formData || [])
    );
  }

  const getField = (name: string) => formData ? formData.get(name) as string | null : (jsonBody?.[name] as string) || null;
  const lossAmount = getField('lossAmount');
  const lossStartDate = getField('lossStartDate');
  const lossEndDate = getField('lossEndDate');
  const lossDescription = getField('lossDescription') || claim.lossDescription || '';
  const declarationPdf = formData ? formData.get('declarationPdf') as File | null : null;

  if (!lossAmount) {
    return NextResponse.json({ error: 'lossAmount is required' }, { status: 400 });
  }
  if (!lossStartDate) {
    return NextResponse.json({ error: 'lossStartDate is required' }, { status: 400 });
  }
  if (!lossEndDate) {
    return NextResponse.json({ error: 'lossEndDate is required' }, { status: 400 });
  }

  const lossAmountValue = parseFloat(lossAmount);
  if (Number.isNaN(lossAmountValue) || lossAmountValue <= 0) {
    return NextResponse.json({ error: 'lossAmount must be a positive number' }, { status: 400 });
  }

  const parsedLossStartDate = new Date(lossStartDate);
  const parsedLossEndDate = new Date(lossEndDate);
  if (Number.isNaN(parsedLossStartDate.getTime()) || Number.isNaN(parsedLossEndDate.getTime())) {
    return NextResponse.json({ error: 'lossStartDate and lossEndDate must be valid dates' }, { status: 400 });
  }

  if (parsedLossStartDate > parsedLossEndDate) {
    return NextResponse.json({ error: 'lossEndDate must be the same or later than lossStartDate' }, { status: 400 });
  }

  // Validate transition with spec-compliant error messages
  const transitionResult = validateClaimTransitionWithReason(currentStatusCode, 'Submitted');
  if (!transitionResult.valid) {
    return NextResponse.json(
      { error: transitionResult.error },
      { status: transitionResult.httpStatus }
    );
  }

  // Dynamic imports to prevent Turbopack whole-project tracing
  const { validatePdf, saveUploadedFile } = await import('@/lib/services/file-storage');
  const { generateDeclarationOfLoss } = await import('@/lib/services/pdf-generator');

  // Handle optional PDF upload
  let declarationPdfUrl = claim.declarationOfLossPdfUrl;

  if (declarationPdf) {
    const isValidPdf = await validatePdf(declarationPdf);
    if (!isValidPdf) {
      return NextResponse.json(
        { error: 'Invalid PDF file: must be application/pdf, max 10MB, with valid %PDF- header' },
        { status: 415 }
      );
    }

    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    const fileName = `COBITUN_declaration_de_sinistre_c${timestamp}${random}.pdf`;
    const uploaded = await saveUploadedFile({
      file: declarationPdf,
      fileName,
      fileCategory: 'workflow.claim.declaration',
      uploadedBy: auth.userIdNum,
      isPublic: false,
      entityRefs: { workflowClaimId: claim.id },
    });
    declarationPdfUrl = uploaded.filePath;
  }

  // Re-generate the declaration of loss PDF with the actual data
  const customerName = claim.customer.user
    ? `${claim.customer.user.firstName} ${claim.customer.user.lastName}`
    : 'Unknown Customer';
  const regeneratedPdfPath = await generateDeclarationOfLoss({
    claimId: claim.claimNumber,
    policyNumber: claim.policyApplication.applicationNumber || `WPA-${claim.policyApplication.id}`,
    customerName,
    lossAmount: lossAmountValue,
    lossStartDate,
    lossEndDate,
    lossDescription,
    declarationDate: new Date().toISOString().split('T')[0],
  });

  if (!declarationPdf) {
    declarationPdfUrl = regeneratedPdfPath;
  }

  // v3: Complete the FillDeclarationOfLoss WorkflowClaimTask
  const fillTask = claim.tasks.find(
    (t) => t.actionRequired === 'FillDeclarationOfLoss' && t.status?.statusCode === 'PENDING'
  );
  if (fillTask) {
    await completeTask(fillTask.id, 'Claim', auth.userIdNum, undefined, tx);
  }

  // Wrap the status update in a concurrency guard
  const finalDeclarationPdfUrl = declarationPdfUrl;
  const updated = await transitionWithConcurrencyGuard(
    'WorkflowClaim',
    claim.id,
    currentStatusCode,
    async (tx) => {
      const submittedStatusId = await getClaimStatusIdByCode('Submitted');
      return tx.workflowClaim.update({
        where: { id: claim.id },
        data: {
          statusId: submittedStatusId,
          lossAmount: lossAmountValue,
          lossStartDate: parsedLossStartDate,
          lossEndDate: parsedLossEndDate,
          lossDescription: lossDescription || null,
          declarationOfLossPdfUrl: finalDeclarationPdfUrl,
        },
        include: {
          tasks: { where: { isDeleted: 0 }, include: { status: { select: { statusCode: true } } } },
          status: { select: { statusCode: true, statusName: true } },
        },
      });
    }
  );

  // v3: Create ReviewClaim WorkflowClaimTask for Admin
  await createTask({
    entityType: 'Claim',
    workflowClaimId: claim.id,
    actorCode: Roles.ADMIN,
    actionRequired: 'ReviewClaim',
  });

  // Log audit
  await logAction({
    entityType: 'WorkflowClaim',
    entityId: claim.id,
    actorId: auth.userIdNum,
    action: 'Customer submitted declaration of loss',
    actionCategory: 'WORKFLOW',
    metadata: {
      lossAmount: parseFloat(lossAmount),
      lossStartDate,
      lossEndDate,
      declarationPdfUrl,
    },
  });

  // Notify all admins
  await notifyAdmins(
    `Customer ${claim.customerId} has submitted a claim declaration for claim ${claim.claimNumber}. Loss amount: ${lossAmount} TND.`,
    'action_required'
  );

  // Store idempotency response
  if (idempotencyKey) {
    await (await import('@/lib/idempotency')).default.storeResponseForKey(idempotencyKey, 200, { claim: updated });
  }

  return NextResponse.json({ claim: updated });
}

/**
 * Admin Step 2.3: Complete the claim
 * v3: Uses WorkflowClaim, WorkflowClaimTask
 */
async function handleComplete(
  auth: AuthInfo,
  claim: WorkflowClaimWithRelations,
  formData: FormData | null,
  jsonBody: Record<string, unknown> | null,
  request: NextRequest
) {
  const currentStatusCode = claim.status?.statusCode || '';

  // RBAC assertion — admin with review privilege
  assertClaimActionAllowed('COMPLETE', currentStatusCode, auth.role, { isOwner: true, hasReviewPrivilege: true });

  const getField = (name: string) => formData ? formData.get(name) as string | null : (jsonBody?.[name] as string) || null;

  // W2-D-04: Require admin notes for completion
  const adminNotes = getField('adminNotes');
  if (!adminNotes || adminNotes.trim().length === 0) {
    return NextResponse.json({ error: 'Admin notes are required for completion' }, { status: 422 });
  }

  // W2-D-05: Require completion checklist
  const completionChecklistRaw = getField('completionChecklist');
  if (completionChecklistRaw) {
    try {
      const checklist = JSON.parse(completionChecklistRaw);
      if (!Array.isArray(checklist) || checklist.some(item => item.checked !== true)) {
        return NextResponse.json({ error: 'All checklist items must be completed' }, { status: 422 });
      }
    } catch {
      return NextResponse.json({ error: 'Invalid completion checklist format' }, { status: 422 });
    }
  }

  // Validate transition with spec-compliant error messages
  const transitionResult = validateClaimTransitionWithReason(currentStatusCode, 'Completed');
  if (!transitionResult.valid) {
    return NextResponse.json(
      { error: transitionResult.error },
      { status: transitionResult.httpStatus }
    );
  }

  // v3: Complete the ReviewClaim WorkflowClaimTask
  const reviewTask = claim.tasks.find(
    (t) => t.actionRequired === 'ReviewClaim' && t.status?.statusCode === 'PENDING'
  );
  if (reviewTask) {
    await completeTask(reviewTask.id, 'Claim', auth.userIdNum, undefined, tx);
  }

  // Wrap in concurrency guard
  const updated = await transitionWithConcurrencyGuard(
    'WorkflowClaim',
    claim.id,
    currentStatusCode,
    async (tx) => {
      // Generate payout transaction ID
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 10);
      const payoutTransactionId = `PAY-C${timestamp.toUpperCase()}${random.toUpperCase()}`;

      const completedStatusId = await getClaimStatusIdByCode('Completed');
      return tx.workflowClaim.update({
        where: { id: claim.id },
        data: {
          statusId: completedStatusId,
          paidAt: new Date(),
          payoutTransactionId,
          paidBy: auth.userIdNum,
          payoutAmount: claim.lossAmount,
        },
        include: {
          tasks: { where: { isDeleted: 0 }, include: { status: { select: { statusCode: true } } } },
          status: { select: { statusCode: true, statusName: true } },
        },
      });
    }
  );

  // Log audit
  await logAction({
    entityType: 'WorkflowClaim',
    entityId: claim.id,
    actorId: auth.userIdNum,
    action: 'Admin completed claim and triggered payout',
    actionCategory: 'WORKFLOW',
    metadata: {
      payoutTransactionId: (updated as any).payoutTransactionId,
      payoutTriggeredAt: new Date().toISOString(),
      lossAmount: Number(claim.lossAmount),
      adminNotes,
      completionChecklist: completionChecklistRaw ? JSON.parse(completionChecklistRaw) : null,
    },
  });

  const customerUserId = claim.customer?.user?.id ?? null;
  if (customerUserId) {
    await notifyCustomer(
      customerUserId,
      `Your claim ${claim.claimNumber} has been approved. Payout of ${claim.lossAmount || 0} TND has been triggered.`,
      'info'
    );
  }

  return NextResponse.json({ claim: updated });
}
