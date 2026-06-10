import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo, isAdmin } from '@/lib/services/auth-helper';
import { Roles, isOwnerOrAdmin } from '@/lib/services/authorization';
import { getPendingTasksForActor } from '@/lib/services/workflow-engine';

/**
 * GET /api/workflow/tasks
 * List pending tasks for the authenticated user.
 * v3: Uses Int user IDs, WorkflowPolicyTask + WorkflowClaimTask combined
 * Query params: ?actor=Customer|Admin&customerId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthInfo(request);
    if (!auth) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const actorParam = searchParams.get('actor') as 'Customer' | 'Admin' | null;
    const customerIdParam = searchParams.get('customerId');

    // Map actor param to Role constants
    let actorRole = isAdmin(auth) ? Roles.ADMIN : Roles.CUSTOMER;
    if (actorParam && ['Customer', 'Admin'].includes(actorParam)) {
      actorRole = actorParam === 'Admin' ? Roles.ADMIN : Roles.CUSTOMER;
    }

    // For customer role, verify access
    if (actorRole === Roles.CUSTOMER) {
      // Resolve customerId from the user
      let customerId: number | undefined = customerIdParam ? parseInt(customerIdParam, 10) : undefined;

      if (!customerId) {
        // Look up the customer record for this user
        const { db } = await import('@/lib/db');
        const customer = await db.customer.findUnique({
          where: { userId: auth.userIdNum },
        });
        if (customer) {
          customerId = customer.id;
        }
      } else {
        // If customerId was provided, verify it belongs to the authenticated user
        if (!isOwnerOrAdmin(auth, customerId)) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
      }

      const tasks = await getPendingTasksForActor(Roles.CUSTOMER, customerId);
      return NextResponse.json({ tasks });
    }

    // Admin: get all pending tasks for admin
    const tasks = await getPendingTasksForActor(Roles.ADMIN);
    return NextResponse.json({ tasks });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

