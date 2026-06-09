import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { Roles, isOwnerOrAdmin } from '@/lib/services/authorization';

interface RouteContext {
  params: { id: string };
}

/**
 * GET /api/workflow/policy-applications/[id]/download?type=provider|policy|signed
 * v3: Uses WorkflowPolicyApplication model with Int IDs
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
    const downloadType = request.nextUrl.searchParams.get('type');

    if (!downloadType || !['provider', 'policy', 'signed'].includes(downloadType)) {
      return NextResponse.json(
        { error: 'Invalid or missing type parameter. Must be: provider, policy, or signed' },
        { status: 400 }
      );
    }

    // Fetch the application
    const application = await db.workflowPolicyApplication.findUnique({
      where: { id: parsedId },
    });

    if (!application) {
      return NextResponse.json({ error: 'Policy application not found' }, { status: 404 });
    }

    // Access control: customer can only download their own or admin
    if (!isOwnerOrAdmin(auth, application.customerId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Determine file path based on type
    let filePath: string | null = null;
    let downloadName: string = '';

    switch (downloadType) {
      case 'provider':
        filePath = application.providerContractPdfUrl;
        downloadName = `COBITUN_contrat_prestataire_cloud_${id}.pdf`;
        break;
      case 'policy':
        filePath = application.insurancePolicyContractPdfUrl;
        downloadName = `COBITUN_police_assurance_parametrique_${id}.pdf`;
        break;
      case 'signed':
        filePath = application.signedPolicyContractPdfUrl;
        downloadName = `COBITUN_police_assurance_parametrique_signee_${id}.pdf`;
        break;
    }

    if (!filePath) {
      return NextResponse.json(
        { error: `No ${downloadType} PDF available for this application` },
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

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${downloadName}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error downloading file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

