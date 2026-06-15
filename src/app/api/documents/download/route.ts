
/**
 * Document Download API
 * GET - Download a file by ID or pre-signed URL parameters
 * SECURITY: Verifies ownership and access rights before allowing download
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo, isAdmin } from '@/lib/services/auth-helper';
import { db } from '@/lib/db';
import { Errors } from '@/middleware/validation';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const fileId = url.searchParams.get('fileId');
  const presignedFileName = url.searchParams.get('fileName');
  const presignedExpires = url.searchParams.get('expires');
  const presignedSignature = url.searchParams.get('signature');

  // Try pre-signed URL verification first
  if (fileId && presignedFileName && presignedExpires && presignedSignature) {
    const { verifyPresignedUrl } = await import('@/lib/file-scanning');
    const verification = verifyPresignedUrl(fileId, presignedFileName, presignedExpires, presignedSignature);
    if (!verification.valid) {
      return NextResponse.json({ error: verification.reason }, { status: 403 });
    }
    // Pre-signed URL is valid, proceed with download
  } else {
    // Fall back to auth-based access
    const auth = await getAuthInfo(request);
    if (!auth) return Errors.unauthorized();

    // Verify access rights
    if (!fileId) {
      return NextResponse.json({ error: 'fileId is required' }, { status: 400 });
    }
  }

  if (!fileId) {
    return NextResponse.json({ error: 'fileId is required' }, { status: 400 });
  }

  try {
    const auth = await getAuthInfo(request);
    if (!auth) return Errors.unauthorized();

    const file = await db.uploadedFile.findFirst({
      where: { id: parseInt(fileId, 10), isDeleted: 0 },
      include: {
        workflowPolicyApp: { select: { customerId: true } },
        workflowClaim: { select: { customerId: true } },
        parametricPolicy: { select: { customerId: true } },
        parametricClaim: { select: { customerId: true } },
        cyberPolicy: { select: { customerId: true } },
        cyberClaim: { select: { customerId: true } },
      },
    });

    if (!file) return Errors.notFound('File');

    // SECURITY: Verify ownership/access rights
    let hasAccess = false;

    // Admin can access any file
    if (isAdmin(auth)) {
      hasAccess = true;
    }
    // Public files can be accessed by anyone
    else if (file.isPublic === 1) {
      hasAccess = true;
    }
    // Customer can access their own files
    else if (auth.role === 'CUSTOMER' && auth.customerId) {
      const customerId = auth.customerId;
      hasAccess =
        (file.workflowPolicyApp?.customerId === customerId) ||
        (file.workflowClaim?.customerId === customerId) ||
        (file.parametricPolicy?.customerId === customerId) ||
        (file.parametricClaim?.customerId === customerId) ||
        (file.cyberPolicy?.customerId === customerId) ||
        (file.cyberClaim?.customerId === customerId);
    }

    if (!hasAccess) {
      return Errors.accessDenied();
    }

    // Read file via externalized module to avoid Turbopack NFT tracing
    const { fileReader } = await import('@/lib/services/file-reader');
    let fileBuffer: Buffer;
    try {
      fileBuffer = fileReader.readFileSync(file.filePath);
    } catch {
      return Errors.notFound('File on disk');
    }

    // Determine content type
    const contentType = file.mimeType || 'application/octet-stream';
    const fileName = file.fileName;

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'private, no-store',
        'X-Content-SHA256': file.fileHashSha256 || '',
      },
    });
  } catch (error) {
    // Ignore file download errors
    return Errors.internal();
  }
}

