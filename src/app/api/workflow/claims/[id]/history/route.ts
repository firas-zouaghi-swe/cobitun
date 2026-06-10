import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { isOwnerOrAdminAsync } from '@/lib/services/authorization';

interface RouteContext {
  params: { id: string };
}

/**
 * GET /api/workflow/claims/[id]/history
 * Returns the ordered state transition history for a workflow claim.
 * Cross-cutting requirement X-05.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await getAuthInfo(request);
    if (!auth) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await context.params;
    const parsedId = parseInt(id, 10);

    const claim = await db.workflowClaim.findUnique({
      where: { id: parsedId },
      select: { id: true, customerId: true, claimNumber: true },
    });

    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    if (!(await isOwnerOrAdminAsync(auth, claim.customerId))) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const history = await db.auditLog.findMany({
      where: {
        entityType: 'WorkflowClaim',
        entityId: parsedId,
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        action: true,
        actionCategory: true,
        actorId: true,
        actorType: true,
        oldValuesJson: true,
        newValuesJson: true,
        metadataJson: true,
        correlationId: true,
        createdAt: true,
      },
    });

    const parsedHistory = history.map(entry => ({
      ...entry,
      oldValues: entry.oldValuesJson ? JSON.parse(entry.oldValuesJson) : null,
      newValues: entry.newValuesJson ? JSON.parse(entry.newValuesJson) : null,
      metadata: entry.metadataJson ? JSON.parse(entry.metadataJson) : null,
      oldValuesJson: undefined,
      newValuesJson: undefined,
      metadataJson: undefined,
    }));

    return NextResponse.json({
      claimId: parsedId,
      claimNumber: claim.claimNumber,
      history: parsedHistory,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
