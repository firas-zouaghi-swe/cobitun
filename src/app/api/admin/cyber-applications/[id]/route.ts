import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { requireRole, Roles } from '@/lib/services/authorization';
import { logAction } from '@/lib/services/audit-service';
import { notifyCustomer } from '@/lib/services/notification-service';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authOrResp = await requireRole(request, Roles.ADMIN);
    if (authOrResp instanceof NextResponse) return authOrResp;
    const auth = authOrResp;

    const { id } = await params;
    const idNum = parseInt(id, 10);
    if (isNaN(idNum)) {
      return NextResponse.json({ error: 'Invalid application ID' }, { status: 400 });
    }
    const body = await request.json();
    const { status: actionStatus, adminComment } = body;

    if (!actionStatus || !['APPROVED', 'REJECTED'].includes(actionStatus)) {
      return NextResponse.json(
        { error: 'status must be either APPROVED or REJECTED' },
        { status: 400 }
      );
    }

    // Find the application with status info
    const application = await db.cyberApplication.findUnique({
      where: { id: idNum },
      include: {
        product: {
          include: {
            coverageGrants: { where: { isDeleted: 0 } },
          },
        },
        status: true,
        customer: { include: { user: true } },
      },
    });

    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    // Only allow review of SUBMITTED or UNDER_REVIEW applications
    const currentStatusCode = application.status?.statusCode;
    if (!['SUBMITTED', 'UNDER_REVIEW'].includes(currentStatusCode || '')) {
      return NextResponse.json(
        { error: `Application is already ${currentStatusCode} and cannot be modified` },
        { status: 400 }
      );
    }

    // Look up target status
    const targetStatus = await db.enumCyberAppStatus.findFirst({
      where: { statusCode: actionStatus, isCurrent: 1 },
      select: { id: true, statusCode: true },
    });

    if (!targetStatus) {
      return NextResponse.json({ error: `Status ${actionStatus} not found in system` }, { status: 500 });
    }

    if (actionStatus === 'REJECTED') {
      // Simply reject the application
      const updated = await db.cyberApplication.update({
        where: { id: idNum },
        data: {
          statusId: targetStatus.id,
          decisionNotes: adminComment || null,
          decisionAt: new Date(),
          decisionBy: auth.userIdNum,
          updatedBy: auth.userIdNum,
        },
        include: {
          customer: { include: { user: true } },
          product: { include: { category: true } },
          status: { select: { statusCode: true, statusName: true } },
          securityPosture: { select: { postureCode: true, postureName: true } },
        },
      });

      // Notify customer
      await notifyCustomer(
        application.customer.userId,
        `Your cyber application ${application.applicationNumber} has been rejected.`,
        'info',
        {}
      );

      // Audit
      await logAction({
        entityType: 'CyberApplication',
        entityId: idNum,
        actorId: auth.userIdNum,
        action: 'REJECT',
        actionCategory: 'ADMIN',
        oldValues: { statusId: application.statusId },
        newValues: { statusId: targetStatus.id },
        requestPath: `/api/admin/cyber-applications/${id}`,
      });

      return NextResponse.json({
        application: {
          ...updated,
          answers: JSON.parse(updated.answersJson),
          waiverFlags: JSON.parse(updated.waiverFlagsJson),
          selectedCoverages: JSON.parse(updated.selectedCoveragesJson),
        },
      });
    }

    // APPROVED: Create a CyberPolicy from the application data
    const product = application.product;

    // Look up ACTIVE policy status
    const activePolicyStatus = await db.enumCyberPolicyStatus.findFirst({
      where: { statusCode: 'ACTIVE', isCurrent: 1 },
      select: { id: true },
    });

    if (!activePolicyStatus) {
      return NextResponse.json({ error: 'ACTIVE policy status not found in system' }, { status: 500 });
    }

    // Get all coverage grant codes as selected coverages
    const selectedCoverages = product.coverageGrants.map((cg) => cg.coverageCode);

    // Calculate policy dates
    const coveragePeriodMonths = product.coveragePeriodMonths || 12;
    const inceptionDate = new Date();
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + coveragePeriodMonths);

    const policyLimit = Number(product.masterPolicyLimit) || 100000;
    const premium = Number(application.calculatedPremium) || Number(product.minimumPremiumTnd) || 0;

    // Use a transaction to update application and create policy atomically
    const result = await db.$transaction(async (tx) => {
      const updatedApp = await tx.cyberApplication.update({
        where: { id: idNum },
        data: {
          statusId: targetStatus.id,
          decisionNotes: adminComment || null,
          decisionAt: new Date(),
          decisionBy: auth.userIdNum,
          updatedBy: auth.userIdNum,
        },
      });

      // Generate policy number
      const policyNumber = `CYB-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

      const policy = await tx.cyberPolicy.create({
        data: {
          policyNumber,
          customerId: application.customerId,
          applicationId: application.id,
          productId: application.productId,
          policyLimit,
          deductibleSir: 0,
          premium,
          selectedCoveragesJson: JSON.stringify(selectedCoverages),
          endorsementsJson: '[]',
          exclusionsJson: '[]',
          statusId: activePolicyStatus.id,
          effectiveDate: inceptionDate,
          expiryDate,
          createdBy: auth.userIdNum,
        },
        include: {
          customer: { include: { user: true } },
          product: {
            include: {
              category: true,
              coverageGrants: { where: { isDeleted: 0 }, orderBy: { sortOrder: 'asc' } },
            },
          },
          application: true,
          status: { select: { statusCode: true, statusName: true } },
        },
      });

      return { application: updatedApp, policy };
    });

    // Notify customer
    await notifyCustomer(
      application.customer.userId,
      `Your cyber application ${application.applicationNumber} has been approved. Policy ${result.policy.policyNumber} is now active.`,
      'action_required',
      { cyberPolicyId: result.policy.id }
    );

    // Audit
    await logAction({
      entityType: 'CyberApplication',
      entityId: idNum,
      actorId: auth.userIdNum,
      action: 'APPROVE',
      actionCategory: 'ADMIN',
      oldValues: { statusId: application.statusId },
      newValues: { statusId: targetStatus.id, policyId: result.policy.id },
      requestPath: `/api/admin/cyber-applications/${id}`,
    });

    return NextResponse.json({
      application: {
        ...result.application,
        answers: JSON.parse(result.application.answersJson),
        waiverFlags: JSON.parse(result.application.waiverFlagsJson),
        selectedCoverages: JSON.parse(result.application.selectedCoveragesJson),
      },
      policy: {
        ...result.policy,
        selectedCoverages: JSON.parse(result.policy.selectedCoveragesJson),
        endorsements: JSON.parse(result.policy.endorsementsJson),
        exclusions: JSON.parse(result.policy.exclusionsJson),
        product: {
          ...result.policy.product,
          coverageGrants: result.policy.product.coverageGrants.map((cg) => ({
            ...cg,
            exclusions: JSON.parse(cg.exclusionsJson),
          })),
        },
      },
    });
  } catch (error) {
    // Ignore cyber application update errors
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

