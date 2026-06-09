
/**
 * Claim Documents API
 * GET  - List claim documents
 * POST - Upload document to claim (with versioning)
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { isOwnerOrAdminAsync } from '@/lib/services/authorization';
import { db } from '@/lib/db';
import { Errors, errorResponse } from '@/middleware/validation';
import { logAction } from '@/lib/services/audit-service';
import { fileReader } from '@/lib/services/file-reader';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ claimId: string }> }
) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();

  const { claimId } = await params;
  const claimIdNum = parseInt(claimId, 10);
  if (isNaN(claimIdNum)) return Errors.notFound('Claim');

  try {
    const claim = await db.parametricClaim.findFirst({ where: { id: claimIdNum, isDeleted: 0 } });
    if (!claim) return Errors.notFound('Claim');

    // Customer can only see their own claims (properly resolve Customer.userId → Customer.id)
    if (!(await isOwnerOrAdminAsync(auth, claim.customerId))) return Errors.forbidden();

    const documents = await db.uploadedFile.findMany({
      where: { parametricClaimId: claimIdNum, isDeleted: 0 },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        fileSizeBytes: true,
        mimeType: true,
        virusScanStatus: true,
        fileHashSha256: true,
        fileCategory: true,
        uploadedBy: true,
        createdAt: true,
        uploadedByUser: { select: { id: true, username: true, firstName: true, lastName: true } },
      },
    });

    return NextResponse.json({
      documents: documents.map((d) => ({
        ...d,
        fileSize: Number(d.fileSizeBytes),
        integrityChecksum: d.fileHashSha256,
        createdAt: d.createdAt.toISOString(),
        uploader: d.uploadedByUser ? `${d.uploadedByUser.firstName} ${d.uploadedByUser.lastName}` : null,
      })),
    });
  } catch (error) {
    console.error('Failed to list claim documents', error);
    return Errors.internal();
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ claimId: string }> }
) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();

  const { claimId } = await params;
  const claimIdNum = parseInt(claimId, 10);
  if (isNaN(claimIdNum)) return Errors.notFound('Claim');

  try {
    const claim = await db.parametricClaim.findFirst({ where: { id: claimIdNum, isDeleted: 0 } });
    if (!claim) return Errors.notFound('Claim');

    if (!(await isOwnerOrAdminAsync(auth, claim.customerId))) return Errors.forbidden();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const description = formData.get('description') as string | null;

    if (!file) return errorResponse('No file provided', 'VALIDATION_ERROR', 400);

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      return errorResponse('Only PDF, JPEG, PNG files are allowed', 'INVALID_FILE_TYPE', 400);
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return errorResponse('File size exceeds 10MB limit', 'FILE_TOO_LARGE', 400);
    }

    // Count all existing versions of same-named file
    const versionCount = await db.uploadedFile.count({
      where: { parametricClaimId: claimIdNum, fileName: file.name, isDeleted: 0 },
    });

    const nextVersion = versionCount + 1;

    // Read file content
    const buffer = Buffer.from(await file.arrayBuffer());

    // Calculate SHA-256 integrity hash
    const fileHashSha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    // Store file via externalized module (local storage for zero-cost mode)
    const uploadDir = fileReader.join(process.cwd(), 'uploads', 'claims', String(claimIdNum));
    await fileReader.promises.mkdir(uploadDir, { recursive: true });
    const storedFilename = `v${nextVersion}_${Date.now()}_${file.name}`;
    const filePath = fileReader.join(uploadDir, storedFilename);
    await fileReader.promises.writeFile(filePath, buffer);

    const document = await db.uploadedFile.create({
      data: {
        fileName: file.name,
        filePath,
        fileSizeBytes: file.size,
        mimeType: file.type,
        parametricClaimId: claimIdNum,
        uploadedBy: auth.userIdNum,
        fileCategory: 'CLAIM_DOCUMENT',
        fileHashSha256,
        virusScanStatus: 'PENDING',
      },
    });

    await logAction({
      entityType: 'FileUpload',
      entityId: document.id,
      action: 'UPLOAD_CLAIM_DOCUMENT',
      actorId: auth.userIdNum,
      actorType: auth.role,
      metadata: { claimId: claimIdNum, filename: file.name, version: nextVersion, size: file.size },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json({
      message: 'Document uploaded',
      documentId: document.id,
      filename: file.name,
      version: nextVersion,
      integrityChecksum: fileHashSha256,
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to upload claim document', error);
    return Errors.internal();
  }
}
