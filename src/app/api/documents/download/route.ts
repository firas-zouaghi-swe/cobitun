
/**
 * Document Download API
 * GET - Download a file by ID or pre-signed URL parameters
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
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
    const file = await db.uploadedFile.findFirst({
      where: { id: parseInt(fileId, 10), isDeleted: 0 },
    });

    if (!file) return Errors.notFound('File');

    // Read file via externalized module to avoid Turbopack NFT tracing
    const { fileReader } = require('@/lib/services/file-reader');
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
    console.error('Failed to download file:', error);
    return Errors.internal();
  }
}

