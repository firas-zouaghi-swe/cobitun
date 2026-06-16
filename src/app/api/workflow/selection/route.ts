import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { Roles } from '@/lib/services/authorization';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthInfo(request);
    if (!auth) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (auth.role !== Roles.CUSTOMER) {
      return NextResponse.json({ error: 'Only customers can fetch workflow selection' }, { status: 403 });
    }

    const customerId = auth.customerId ?? null;
    if (!customerId) {
      return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });
    }

    const customer = await db.customer.findUnique({
      where: { id: customerId },
      select: {
        lastViewedWorkflowPolicyApplicationId: true,
        lastViewedWorkflowClaimId: true,
      },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });
    }

    return NextResponse.json({ selection: customer });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await getAuthInfo(request);
    if (!auth) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (auth.role !== Roles.CUSTOMER) {
      return NextResponse.json({ error: 'Only customers can update workflow selection' }, { status: 403 });
    }

    const customerId = auth.customerId ?? null;
    if (!customerId) {
      return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const updates: Record<string, number | null> = {};
    if (Object.prototype.hasOwnProperty.call(body, 'lastViewedWorkflowPolicyApplicationId')) {
      updates.lastViewedWorkflowPolicyApplicationId = body.lastViewedWorkflowPolicyApplicationId
        ? Number(body.lastViewedWorkflowPolicyApplicationId)
        : null;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'lastViewedWorkflowClaimId')) {
      updates.lastViewedWorkflowClaimId = body.lastViewedWorkflowClaimId
        ? Number(body.lastViewedWorkflowClaimId)
        : null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No workflow selection values provided' }, { status: 400 });
    }

    if (updates.lastViewedWorkflowPolicyApplicationId != null) {
      const policyApp = await db.workflowPolicyApplication.findUnique({
        where: { id: updates.lastViewedWorkflowPolicyApplicationId },
        select: { customerId: true },
      });
      if (!policyApp || policyApp.customerId !== customerId) {
        return NextResponse.json({ error: 'Policy application not found or access denied' }, { status: 404 });
      }
    }

    if (updates.lastViewedWorkflowClaimId != null) {
      const claim = await db.workflowClaim.findUnique({
        where: { id: updates.lastViewedWorkflowClaimId },
        select: { customerId: true },
      });
      if (!claim || claim.customerId !== customerId) {
        return NextResponse.json({ error: 'Claim not found or access denied' }, { status: 404 });
      }
    }

    const updatedCustomer = await db.customer.update({
      where: { id: customerId },
      data: updates,
      select: {
        lastViewedWorkflowPolicyApplicationId: true,
        lastViewedWorkflowClaimId: true,
      },
    });

    return NextResponse.json({ selection: updatedCustomer });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
