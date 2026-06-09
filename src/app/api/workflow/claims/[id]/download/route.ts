import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { Roles, isOwnerOrAdmin } from '@/lib/services/authorization';

interface RouteContext {
  params: { id: string };
}

/**
 * GET /api/workflow/claims/[id]/download
 * v3: Uses WorkflowClaim model with Int IDs
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

    // Fetch the claim
    const claim = await db.workflowClaim.findUnique({
      where: { id: parsedId },
    });

    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    // Access control: customer can only download their own or admin
    if (!isOwnerOrAdmin(auth, claim.customerId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get the declaration PDF path
    const filePath = claim.declarationOfLossPdfUrl;

    if (!filePath) {
      return NextResponse.json(
        { error: 'No declaration of loss PDF available for this claim' },
        { status: 404 }
      );
    }

    // Read file via externalized module to avoid Turbopack NFT tracing
    const { fileReader } = require('@/lib/services/file-reader');
    let fileBuffer: Buffer;
    try {
      fileBuffer = await fileReader.promises.readFile(filePath) as Buffer;
    } catch {
      return NextResponse.json(
        { error: 'File not found on disk' },
        { status: 404 }
      );
    }
    const downloadName = `COBITUN_declaration_de_sinistre_${claim.claimNumber || id}.pdf`;

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${downloadName}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error downloading declaration PDF:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

