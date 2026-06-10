
/**
 * Claim Documents API (Customer)
 * POST   - Upload claim document with versioning
 * GET    - List claim documents
 * DELETE - Delete a document version
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAuthInfo } from '@/lib/services/auth-helper';
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
  const id = parseInt(claimId, 10);
  if (isNaN(id)) return Errors.notFound('Claim');

  try {
    const claim = await db.parametricClaim.findFirst({
      where: { id, isDeleted: 0 },
    });

    if (!claim) return Errors.notFound('Claim');

    // Check access
    if (auth.role === 'CUSTOMER') {
      const customer = await db.customer.findFirst({ where: { userId: auth.userIdNum } });
      if (!customer || customer.id !== claim.customerId) return Errors.forbidden();
    }

    const documents = await db.uploadedFile.findMany({
      where: { parametricClaimId: id, isDeleted: 0 },
      orderBy: { createdAt: 'desc' },
    });

    // Group by file category for versioning
    const grouped = documents.reduce((acc: Record<string, typeof documents>, doc) => {
      const key = doc.fileCategory || 'other';
      if (!acc[key]) acc[key] = [];
      acc[key].push(doc);
      return acc;
    }, {});

    return NextResponse.json({
      documents: documents.map((d) => ({
        id: d.id,
        fileName: d.fileName,
        fileCategory: d.fileCategory,
        mimeType: d.mimeType,
        fileSize: d.fileSizeBytes,
        integrityHash: d.fileHashSha256,
        virusScanStatus: d.virusScanStatus,
        createdAt: d.createdAt.toISOString(),
        downloadUrl: `/api/documents/download?fileId=${d.id}`,
      })),
      grouped,
      total: documents.length,
    });
  } catch (error) {
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
  const id = parseInt(claimId, 10);
  if (isNaN(id)) return Errors.notFound('Claim');

  try {
    const claim = await db.parametricClaim.findFirst({
      where: { id, isDeleted: 0 },
    });

    if (!claim) return Errors.notFound('Claim');

    // Check access
    if (auth.role === 'CUSTOMER') {
      const customer = await db.customer.findFirst({ where: { userId: auth.userIdNum } });
      if (!customer || customer.id !== claim.customerId) return Errors.forbidden();
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const documentType = formData.get('documentType') as string || 'SUPPORTING_DOCUMENT';

    // Validate documentType against allowed values
    const ALLOWED_DOCUMENT_TYPES = ['DECLARATION', 'EVIDENCE', 'SUPPORTING', 'CONTRACT', 'OTHER', 'SUPPORTING_DOCUMENT'];
    if (!ALLOWED_DOCUMENT_TYPES.includes(documentType)) {
      return errorResponse('Invalid document type', 'VALIDATION_ERROR', 400);
    }

    if (!file) {
      return errorResponse('No file provided', 'VALIDATION_ERROR', 400);
    }

    // Validate file
    if (file.size > 10 * 1024 * 1024) {
      return errorResponse('File size exceeds 10MB limit', 'FILE_TOO_LARGE', 400);
    }

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      return errorResponse('File type not allowed. Accepted: PDF, JPEG, PNG', 'INVALID_FILE_TYPE', 400);
    }

    // Read file content
    const buffer = Buffer.from(await file.arrayBuffer());

    // Compute integrity hash
    const integrityHash = crypto.createHash('sha256').update(buffer).digest('hex');

    // Count existing documents of same category for versioning
    const versionCount = await db.uploadedFile.count({
      where: { parametricClaimId: id, fileCategory: documentType, isDeleted: 0 },
    });

    const versionNumber = versionCount + 1;

    // Save file via externalized module
    const uploadDir = fileReader.getUploadDir();
    const fileExt = fileReader.extname(file.name) || '.bin';
    const storedName = `COBITUN_claim_${id}_${documentType}_v${versionNumber}${fileExt}`;
    const filePath = fileReader.join(uploadDir, storedName);

    if (!fileReader.existsSync(uploadDir)) {
      fileReader.mkdirSync(uploadDir, { recursive: true });
    }
    fileReader.writeFileSync(filePath, buffer);

    // Create file record using correct Prisma schema fields
    const uploadedFile = await db.uploadedFile.create({
      data: {
        fileName: file.name,
        filePath,
        mimeType: file.type,
        fileSizeBytes: file.size,
        fileHashSha256: integrityHash,
        fileCategory: documentType,
        virusScanStatus: 'PENDING',
        uploadedBy: auth.userIdNum,
        parametricClaimId: id,
        isPublic: 0,
      },
    });

    await logAction({
      entityType: 'UploadedFile',
      entityId: uploadedFile.id,
      action: 'UPLOAD_CLAIM_DOCUMENT',
      actionCategory: 'CREATE',
      actorId: auth.userIdNum,
      actorType: auth.role,
      metadata: { claimId: id, documentType, version: versionNumber, fileName: file.name },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json({
      document: {
        id: uploadedFile.id,
        fileName: file.name,
        fileCategory: documentType,
        version: versionNumber,
        integrityHash,
        virusScanStatus: 'PENDING',
        createdAt: uploadedFile.createdAt.toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    return Errors.internal();
  }
}

