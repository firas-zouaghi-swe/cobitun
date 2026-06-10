import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthInfo, isAdmin } from '@/lib/services/auth-helper';
import { Roles, isOwnerOrAdmin } from '@/lib/services/authorization';
import { createTask, completeTask, updatePolicyApplicationStatus } from '@/lib/services/workflow-engine';
import { logAction } from '@/lib/services/audit-service';
import { notifyAdmins } from '@/lib/services/notification-service';

/**
 * Generate application number using sequence_registry
 */
async function generateApplicationNumber(): Promise<string> {
  const sequenceName = 'workflow_policy_application';
  const currentYear = new Date().getFullYear();

  // Use interactive transaction to prevent race conditions on concurrent requests
  const result = await db.$transaction(async (tx) => {
    const sequence = await tx.sequenceRegistry.upsert({
      where: { sequenceName },
      create: {
        sequenceName,
        currentValue: 1,
        prefix: 'WPA',
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
 * GET /api/workflow/policy-applications
 * v3: Uses WorkflowPolicyApplication model (renamed from PolicyApplication)
 * statusId → join EnumWorkflowAppStatus
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthInfo(request);
    if (!auth) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    let applications;

    if (isAdmin(auth)) {
      // Admin and super admin see all applications
      applications = await db.workflowPolicyApplication.findMany({
        where: { isDeleted: 0 },
        include: {
          customer: {
            include: { user: { select: { firstName: true, lastName: true, email: true } } },
          },
          product: { select: { id: true, productCode: true, productName: true } },
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
      // Customer sees only own applications
      const customer = await db.customer.findUnique({
        where: { userId: auth.userIdNum },
      });

      if (!customer) {
        return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });
      }

      applications = await db.workflowPolicyApplication.findMany({
        where: { customerId: customer.id, isDeleted: 0 },
        include: {
          product: { select: { id: true, productCode: true, productName: true } },
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

    // Enrich applications with sector and recent policy values when available
    const enriched = await Promise.all(applications.map(async (app) => {
      try {
        // Only include productId in filter when present to avoid Prisma null filter errors
        const whereClause = { customerId: app.customerId, isDeleted: 0 } as any;
        if (app.productId) whereClause.productId = app.productId;
        const recentPolicy = await db.parametricPolicy.findFirst({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          select: { sector: { select: { sectorName: true } }, annualTurnoverTnd: true, finalPremium: true },
        });

        return {
          ...app,
          // expose statusCode/statusName at top-level for older clients
          statusCode: app.status?.statusCode ?? null,
          statusName: app.status?.statusName ?? null,
          sector: recentPolicy?.sector?.sectorName ?? null,
          annualTurnover: recentPolicy?.annualTurnoverTnd ?? null,
          premiumAmount: recentPolicy?.finalPremium ?? app.premiumAmount ?? null,
        } as typeof app & { statusCode?: string | null; statusName?: string | null; sector: string | null; annualTurnover?: number | string | null };
      } catch (err) {
        // Ignore enrichment errors
        return { ...app, sector: null } as typeof app & { sector: string | null };
      }
    }));

    return NextResponse.json({ applications: enriched });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/workflow/policy-applications
 * v3: Uses WorkflowPolicyApplication model
 * Creates WorkflowPolicyTask for tasks
 * Generates application number using sequence_registry
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthInfo(request);
    if (!auth) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (auth.role !== Roles.CUSTOMER) {
      return NextResponse.json({ error: 'Only customers can create policy applications' }, { status: 403 });
    }

    // Parse multipart form data
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (err) {
      return NextResponse.json(
        { error: 'Invalid multipart/form-data request. Ensure the request contains a file upload and correct Content-Type header.' },
        { status: 415 }
      );
    }

    const customerId = formData.get('customerId') as string | null;
    const providerContractPdf = formData.get('providerContractPdf') as File | null;
    const productId = formData.get('productId') as string | null;

    // Validate required fields
    if (!customerId) {
      return NextResponse.json({ error: 'customerId is required' }, { status: 400 });
    }

    if (!providerContractPdf) {
      return NextResponse.json({ error: 'providerContractPdf file is required' }, { status: 400 });
    }

    // W1-D-01: Check for 0-byte file
    if (providerContractPdf.size === 0) {
      return NextResponse.json({ error: 'File cannot be empty' }, { status: 400 });
    }

    const parsedCustomerId = parseInt(customerId, 10);

    // Verify the customer belongs to the authenticated user or admin
    const customer = await db.customer.findUnique({ where: { id: parsedCustomerId } });
    if (!customer || !isOwnerOrAdmin(auth, parsedCustomerId)) {
      return NextResponse.json({ error: 'Invalid customer ID or access denied' }, { status: 403 });
    }

    // Dynamic imports to prevent Turbopack whole-project tracing
    const { validatePdf, saveUploadedFile } = await import('@/lib/services/file-storage');

    // Validate PDF
    const isValidPdf = await validatePdf(providerContractPdf);
    if (!isValidPdf) {
      return NextResponse.json(
        { error: 'Invalid PDF file: must be application/pdf, max 10MB, with valid %PDF- header' },
        { status: 415 }
      );
    }

    // Save the uploaded file
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    const fileCuid = `c${timestamp}${random}`;
    const fileName = `COBITUN_contrat_prestataire_cloud_${fileCuid}.pdf`;
    const uploadedRecord = await saveUploadedFile({
      file: providerContractPdf,
      fileName,
      fileCategory: 'workflow.policy.application',
      uploadedBy: auth.userIdNum,
      isPublic: false,
      entityRefs: {},
    });
    const savedFilePath = uploadedRecord.filePath;

    // W1-D-02: Check for duplicate file hash
    const existingFile = await db.uploadedFile.findFirst({
      where: { fileHashSha256: uploadedRecord.fileHashSha256, isDeleted: 0 },
    });
    if (existingFile && existingFile.id !== uploadedRecord.id) {
      // Clean up the just-uploaded file
      await db.uploadedFile.update({ where: { id: uploadedRecord.id }, data: { isDeleted: 1, deletedAt: new Date() } });
      return NextResponse.json({ error: 'Duplicate file detected' }, { status: 409 });
    }

    // v3: Look up initial status
    const initialStatus = await db.enumWorkflowAppStatus.findFirst({
      where: { statusCode: 'ProviderContractUploaded', isCurrent: 1 },
      select: { id: true },
    });

    // Generate application number
    const applicationNumber = await generateApplicationNumber();

    // Create the workflow policy application (v3 model)
    const application = await db.workflowPolicyApplication.create({
      data: {
        applicationNumber,
        customerId: parsedCustomerId,
        productId: productId ? parseInt(productId, 10) : null,
        providerContractPdfUrl: savedFilePath,
        statusId: initialStatus?.id ?? null,
      },
      include: {
        tasks: true,
        status: { select: { statusCode: true, statusName: true } },
      },
    });

    // v3: Create and immediately complete a customer upload task representing 'Contract Uploaded'
    const customerUploadTask = await createTask({
      entityType: 'Policy',
      policyApplicationId: application.id,
      actorCode: Roles.CUSTOMER,
      actionRequired: 'UploadProviderContract',
    });

    // Mark the customer's upload task completed (they just uploaded the file)
    try {
      await completeTask(customerUploadTask.id, 'Policy', auth.userIdNum);
    } catch (err) {
      // Ignore task completion errors
    }

    // Transition application status to AdminReviewing now that provider contract is uploaded
    try {
      await updatePolicyApplicationStatus(application.id, 'AdminReviewing');
    } catch (err) {
      // Ignore status transition errors
    }

    // v3: Create a WorkflowPolicyTask for the Admin to review the provider contract
    await createTask({
      entityType: 'Policy',
      policyApplicationId: application.id,
      actorCode: Roles.ADMIN,
      actionRequired: 'ReviewProviderContract',
    });

    // Log the action (v3: actorId is number, entityId is number)
    await logAction({
      entityType: 'WorkflowPolicyApplication',
      entityId: application.id,
      actorId: auth.userIdNum,
      action: 'Customer uploaded provider contract and created policy application',
      actionCategory: 'WORKFLOW',
      metadata: {
        customerId: parsedCustomerId,
        productId: productId ? parseInt(productId, 10) : null,
        fileName,
        applicationNumber,
      },
    });

    // Notify all admins about the new application
    await notifyAdmins(
      `New policy application from customer ${parsedCustomerId}. Provider contract uploaded, awaiting review.`,
      'action_required'
    );

    // Link the uploaded file record to the created workflow application (if possible)
    try {
      if (uploadedRecord && uploadedRecord.id) {
        await db.uploadedFile.update({ where: { id: uploadedRecord.id }, data: { workflowPolicyAppId: application.id } });
      }
    } catch (err) {
      // Ignore file linking errors
    }

    // Re-fetch updated application with tasks and status for the response
    const updatedApplication = await db.workflowPolicyApplication.findUnique({
      where: { id: application.id },
      include: {
        customer: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        product: { select: { id: true, productCode: true, productName: true } },
        status: { select: { id: true, statusCode: true, statusName: true } },
        tasks: {
          where: { isDeleted: 0 },
          include: { actor: { select: { actorCode: true, actorName: true } }, status: { select: { statusCode: true, statusName: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const out = updatedApplication ? { ...updatedApplication, statusCode: updatedApplication.status?.statusCode ?? null, statusName: updatedApplication.status?.statusName ?? null } : { application };
    return NextResponse.json({ application: out }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

