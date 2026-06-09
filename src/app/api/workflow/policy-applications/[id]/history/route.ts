import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { isOwnerOrAdminAsync } from '@/lib/services/authorization';

interface RouteContext {
  params: { id: string };
}

/**
 * GET /api/workflow/policy-applications/[id]/history
 * Returns the ordered state transition history for a policy application.
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

    // Fetch the application
    const application = await db.workflowPolicyApplication.findUnique({
      where: { id: parsedId },
      select: { id: true, customerId: true, applicationNumber: true },
    });

    if (!application) {
      return NextResponse.json({ error: 'Policy application not found' }, { status: 404 });
    }

    // Access control
    if (!(await isOwnerOrAdminAsync(auth, application.customerId))) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Fetch audit log entries for this application, ordered chronologically
    const history = await db.auditLog.findMany({
      where: {
        entityType: 'WorkflowPolicyApplication',
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

    // Parse JSON fields
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
      applicationId: parsedId,
      applicationNumber: application.applicationNumber,
      history: parsedHistory,
    });
  } catch (error) {
    console.error('Error fetching policy application history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
