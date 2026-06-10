
/**
 * Claim Document Download API
 * GET - Download a specific document
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { db } from '@/lib/db';
import { Errors } from '@/middleware/validation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();

  const { documentId } = await params;
  const docId = parseInt(documentId, 10);
  if (isNaN(docId)) return Errors.notFound('Document');

  try {
    const document = await db.uploadedFile.findFirst({
      where: { id: docId, isDeleted: 0 },
    });

    if (!document) return Errors.notFound('Document');

    // Check access - customer can only download their own documents
    if (auth.role === 'CUSTOMER') {
      const claim = await db.parametricClaim.findFirst({
        where: { id: document.parametricClaimId!, customerId: auth.customerId! },
      });
      if (!claim) return Errors.forbidden();
    }

    // Read file via externalized module to avoid Turbopack NFT tracing
    const { fileReader } = await import('@/lib/services/file-reader');
    const readFile = fileReader.promises.readFile;
    const filePath = document.filePath;
    if (!filePath) {
      return Errors.notFound('File path not stored');
    }

    try {
      const fileBuffer = await readFile(filePath);

      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': document.mimeType || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${document.fileName}"`,
          'Content-Length': String(fileBuffer.length),
          'X-Document-Version': String(document.fileHashSha256 ? 1 : 1),
          'X-Integrity-Checksum': document.fileHashSha256 || '',
        },
      });
    } catch {
      return Errors.notFound('File on disk');
    }
  } catch (error) {
    // Ignore download errors
    return Errors.internal();
  }
}

