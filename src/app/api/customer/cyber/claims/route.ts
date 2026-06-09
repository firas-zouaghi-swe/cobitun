import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthInfo, verifyCustomerOwnership, AuthInfo } from '@/lib/services/auth-helper';
import { requireAuth } from '@/lib/services/authorization';

/**
 * Generate claim number using sequence_registry
 */
async function generateClaimNumber(): Promise<string> {
  const sequenceName = 'cyber_claim';
  const currentYear = new Date().getFullYear();

  const sequence = await db.sequenceRegistry.upsert({
    where: { sequenceName },
    create: {
      sequenceName,
      currentValue: 1,
      prefix: 'CCL',
      paddingWidth: 6,
      yearReset: 1,
      lastYear: currentYear,
    },
    update: {},
  });

  let currentValue = sequence.currentValue;
  if (sequence.yearReset === 1 && sequence.lastYear !== currentYear) {
    currentValue = 1;
    await db.sequenceRegistry.update({
      where: { sequenceName },
      data: { currentValue: 2, lastYear: currentYear },
    });
  } else {
    await db.sequenceRegistry.update({
      where: { sequenceName },
      data: { currentValue: currentValue + 1 },
    });
  }

  const padded = String(currentValue).padStart(sequence.paddingWidth, '0');
  return `${sequence.prefix}-${currentYear}-${padded}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerIdParam = searchParams.get('customerId');
    const parsedCustomerId = customerIdParam ? parseInt(customerIdParam, 10) : undefined;

    const authOrResp = await requireAuth(request);
    if ((authOrResp as any).status) return authOrResp as NextResponse;
    const auth = authOrResp as AuthInfo;

    const effectiveCustomerId = await verifyCustomerOwnership(auth, parsedCustomerId);
    if (!effectiveCustomerId) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    // v3: statusId → join EnumCyberClaimStatus, incidentTypeId → join EnumIncidentType
    const claims = await db.cyberClaim.findMany({
      where: { customerId: effectiveCustomerId, isDeleted: 0 },
      include: {
        policy: {
          include: {
            product: {
              include: {
                category: true,
              },
            },
            status: { select: { statusCode: true, statusName: true } },
          },
        },
        incidentType: { select: { id: true, typeCode: true, typeName: true } },
        status: { select: { id: true, statusCode: true, statusName: true, isTerminal: true, allowsPayment: true } },
        assignedInvestigatorUser: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ claims });
  } catch (error) {
    console.error('Get customer cyber claims error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, policyId, incidentDate, incidentTypeId, description, estimatedLoss } = body;

    if (!customerId || !policyId || !incidentDate || !incidentTypeId || !description || estimatedLoss === undefined) {
      return NextResponse.json(
        { error: 'customerId, policyId, incidentDate, incidentTypeId, description, and estimatedLoss are required' },
        { status: 400 }
      );
    }

    const parsedCustomerId = parseInt(customerId, 10);
    const parsedPolicyId = parseInt(policyId, 10);
    const parsedIncidentTypeId = parseInt(incidentTypeId, 10);

    // v3: Verify incidentTypeId exists
    const incidentType = await db.enumIncidentType.findFirst({
      where: { id: parsedIncidentTypeId, isCurrent: 1 },
    });
    if (!incidentType) {
      return NextResponse.json(
        { error: `Invalid incidentTypeId: ${incidentTypeId}. Must be a valid current incident type ID.` },
        { status: 400 }
      );
    }

    // Verify customer exists
    const customer = await db.customer.findUnique({ where: { id: parsedCustomerId } });
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Verify policy exists and belongs to customer
    const policy = await db.cyberPolicy.findFirst({
      where: { id: parsedPolicyId, customerId: parsedCustomerId, isDeleted: 0 },
      include: { status: { select: { statusCode: true } } },
    });

    if (!policy) {
      return NextResponse.json(
        { error: 'Policy not found or does not belong to this customer' },
        { status: 404 }
      );
    }

    // v3: Check status using enum FK
    if (policy.status?.statusCode !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Claims can only be filed against active policies' },
        { status: 400 }
      );
    }

    // Verify incident date is not in the future
    const incidentDateParsed = new Date(incidentDate);
    if (incidentDateParsed > new Date()) {
      return NextResponse.json(
        { error: 'Incident date cannot be in the future' },
        { status: 400 }
      );
    }

    // v3: Look up REPORTED status ID
    const reportedStatus = await db.enumCyberClaimStatus.findFirst({
      where: { statusCode: 'REPORTED', isCurrent: 1 },
      select: { id: true },
    });

    // Generate claim number
    const claimNumber = await generateClaimNumber();

    const claim = await db.cyberClaim.create({
      data: {
        claimNumber,
        customerId: parsedCustomerId,
        policyId: parsedPolicyId,
        incidentDate: incidentDateParsed,
        incidentTypeId: parsedIncidentTypeId,
        incidentDescription: description,
        estimatedLoss: parseFloat(estimatedLoss),
        statusId: reportedStatus?.id ?? null,
      },
      include: {
        policy: {
          include: {
            product: true,
          },
        },
        incidentType: true,
        status: true,
      },
    });

    return NextResponse.json({ claim }, { status: 201 });
  } catch (error) {
    console.error('Create cyber claim error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

