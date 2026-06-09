
/**
 * Document Versioning API
 * GET  - Get document version history
 * POST - Create new document version
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { db } from '@/lib/db';
import { Errors, errorResponse } from '@/middleware/validation';
import { logAction } from '@/lib/services/audit-service';
import crypto from 'crypto';
import { fileReader } from '@/lib/services/file-reader';

export async function GET(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();

  try {
    const url = new URL(request.url);
    const fileCategory = url.searchParams.get('fileCategory');
    const parametricPolicyId = url.searchParams.get('parametricPolicyId');
    const cyberPolicyId = url.searchParams.get('cyberPolicyId');
    const parametricClaimId = url.searchParams.get('parametricClaimId');
    const cyberClaimId = url.searchParams.get('cyberClaimId');
    const workflowPolicyAppId = url.searchParams.get('workflowPolicyAppId');
    const workflowClaimId = url.searchParams.get('workflowClaimId');

    const where: Record<string, unknown> = {
      isDeleted: 0,
    };
    if (fileCategory) where.fileCategory = fileCategory;
    if (parametricPolicyId) where.parametricPolicyId = parseInt(parametricPolicyId, 10);
    if (cyberPolicyId) where.cyberPolicyId = parseInt(cyberPolicyId, 10);
    if (parametricClaimId) where.parametricClaimId = parseInt(parametricClaimId, 10);
    if (cyberClaimId) where.cyberClaimId = parseInt(cyberClaimId, 10);
    if (workflowPolicyAppId) where.workflowPolicyAppId = parseInt(workflowPolicyAppId, 10);
    if (workflowClaimId) where.workflowClaimId = parseInt(workflowClaimId, 10);

    // Ownership check for customer role — only allow viewing documents linked to their own policies/claims
    if (auth.role === 'CUSTOMER') {
      const customer = await db.customer.findFirst({ where: { userId: auth.userIdNum } });
      if (!customer) return Errors.forbidden();

      // Verify at least one linked entity belongs to the customer
      const ownershipChecks: Promise<unknown>[] = [];
      if (parametricPolicyId) {
        ownershipChecks.push(
          db.parametricPolicy.findFirst({ where: { id: parseInt(parametricPolicyId, 10), customerId: customer.id, isDeleted: 0 } })
            .then((p) => { if (!p) throw new Error('denied'); })
        );
      }
      if (parametricClaimId) {
        ownershipChecks.push(
          db.parametricClaim.findFirst({ where: { id: parseInt(parametricClaimId, 10), customerId: customer.id, isDeleted: 0 } })
            .then((c) => { if (!c) throw new Error('denied'); })
        );
      }
      if (ownershipChecks.length > 0) {
        try { await Promise.all(ownershipChecks); }
        catch { return Errors.forbidden(); }
      }
    }

    const documents = await db.uploadedFile.findMany({
      where,
      orderBy: [{ fileCategory: 'asc' }, { createdAt: 'desc' }],
    });

    // Group by file category for versioning display
    const versionGroups: Record<string, typeof documents> = {};
    for (const doc of documents) {
      const key = doc.fileCategory || 'other';
      if (!versionGroups[key]) versionGroups[key] = [];
      versionGroups[key].push(doc);
    }

    return NextResponse.json({
      documents: documents.map((d) => ({
        id: d.id,
        fileName: d.fileName,
        fileCategory: d.fileCategory,
        fileSize: d.fileSizeBytes,
        integrityHash: d.fileHashSha256,
        virusScanStatus: d.virusScanStatus,
        uploadedBy: d.uploadedBy,
        createdAt: d.createdAt.toISOString(),
        downloadUrl: `/api/documents/download?fileId=${d.id}`,
      })),
      versionGroups: Object.fromEntries(
        Object.entries(versionGroups).map(([key, docs]) => [
          key,
          {
            totalFiles: docs.length,
            files: docs.map((d) => ({
              id: d.id,
              fileName: d.fileName,
              createdAt: d.createdAt.toISOString(),
              uploadedBy: d.uploadedBy,
            })),
          },
        ])
      ),
    });
  } catch (error) {
    console.error('Failed to get document versions:', error);
    return Errors.internal();
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const fileCategory = formData.get('fileCategory') as string || 'GENERAL';
    const parametricPolicyId = formData.get('parametricPolicyId') ? parseInt(formData.get('parametricPolicyId') as string, 10) : undefined;
    const cyberPolicyId = formData.get('cyberPolicyId') ? parseInt(formData.get('cyberPolicyId') as string, 10) : undefined;
    const parametricClaimId = formData.get('parametricClaimId') ? parseInt(formData.get('parametricClaimId') as string, 10) : undefined;
    const cyberClaimId = formData.get('cyberClaimId') ? parseInt(formData.get('cyberClaimId') as string, 10) : undefined;
    const workflowPolicyAppId = formData.get('workflowPolicyAppId') ? parseInt(formData.get('workflowPolicyAppId') as string, 10) : undefined;
    const workflowClaimId = formData.get('workflowClaimId') ? parseInt(formData.get('workflowClaimId') as string, 10) : undefined;

    if (!file) {
      return errorResponse('file is required', 'VALIDATION_ERROR', 400);
    }

    if (file.size > 10 * 1024 * 1024) {
      return errorResponse('File size exceeds 10MB limit', 'FILE_TOO_LARGE', 400);
    }

    // Ownership check for customer role — verify they own the linked policy/claim
    if (auth.role === 'CUSTOMER') {
      const customer = await db.customer.findFirst({ where: { userId: auth.userIdNum } });
      if (!customer) return Errors.forbidden();

      const ownershipChecks: Promise<unknown>[] = [];
      if (parametricPolicyId) {
        ownershipChecks.push(
          db.parametricPolicy.findFirst({ where: { id: parametricPolicyId, customerId: customer.id, isDeleted: 0 } })
            .then((p) => { if (!p) throw new Error('denied'); })
        );
      }
      if (parametricClaimId) {
        ownershipChecks.push(
          db.parametricClaim.findFirst({ where: { id: parametricClaimId, customerId: customer.id, isDeleted: 0 } })
            .then((c) => { if (!c) throw new Error('denied'); })
        );
      }
      if (ownershipChecks.length > 0) {
        try { await Promise.all(ownershipChecks); }
        catch { return Errors.forbidden(); }
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileHashSha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    // Save file via externalized module
    const uploadDir = fileReader.getUploadDir();
    const fileExt = fileReader.extname(file.name) || '.bin';
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    const storedName = `COBITUN_${fileCategory}_${timestamp}${random}${fileExt}`;
    const filePath = fileReader.join(uploadDir, storedName);

    await fileReader.promises.mkdir(uploadDir, { recursive: true });
    await fileReader.promises.writeFile(filePath, buffer);

    const uploadedFile = await db.uploadedFile.create({
      data: {
        fileName: file.name,
        filePath,
        mimeType: file.type,
        fileSizeBytes: file.size,
        fileHashSha256,
        fileCategory,
        virusScanStatus: 'PENDING',
        uploadedBy: auth.userIdNum,
        parametricPolicyId: parametricPolicyId ?? null,
        cyberPolicyId: cyberPolicyId ?? null,
        parametricClaimId: parametricClaimId ?? null,
        cyberClaimId: cyberClaimId ?? null,
        workflowPolicyAppId: workflowPolicyAppId ?? null,
        workflowClaimId: workflowClaimId ?? null,
        isPublic: 0,
      },
    });

    await logAction({
      entityType: 'UploadedFile',
      entityId: uploadedFile.id,
      action: 'UPLOAD_DOCUMENT_VERSION',
      actionCategory: 'CREATE',
      actorId: auth.userIdNum,
      actorType: auth.role,
      metadata: { fileCategory, fileName: file.name, fileSize: file.size },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json({
      document: {
        id: uploadedFile.id,
        fileName: file.name,
        fileCategory,
        integrityHash: fileHashSha256,
        createdAt: uploadedFile.createdAt.toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to upload document version:', error);
    return Errors.internal();
  }
}

