import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/services/authorization';
import { AuthInfo } from '@/lib/services/auth-helper';

/**
 * GET /api/customer/claims/ioda-suggestions
 * Retrieves IODA auto-claim suggestions for a customer
 * These are DRAFT suggestions, not automatically filed claims
 */
export async function GET(request: NextRequest) {
  try {
    const authOrResp = await requireAuth(request);
    if ((authOrResp as any).status) return authOrResp as NextResponse;
    const auth = authOrResp as AuthInfo;

    // Get customer associated with user
    const customer = await prisma.customer.findFirst({
      where: { user: { id: auth.userIdNum } }
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Get IODA suggestions for this customer
    const suggestions = await prisma.iODAClaimSuggestion.findMany({
      where: {
        customerId: customer.id,
        isDeleted: 0,
        draftClaimStatus: { in: ['DRAFT', 'IGNORED'] }
      },
      include: {
        parametricPolicy: {
          select: {
            id: true,
            policyNumber: true,
            effectiveDate: true,
            expiryDate: true
          }
        }
      },
      orderBy: { detectionTimestamp: 'desc' }
    });

    const formattedSuggestions = suggestions.map(suggestion => ({
      id: suggestion.id,
      iodalertId: suggestion.iodalertId,
      policyId: suggestion.parametricPolicyId,
      policyNumber: suggestion.parametricPolicy?.policyNumber,
      outageDescription: suggestion.outageDescription,
      affectedProviders: JSON.parse(suggestion.affectedProviders),
      detectionTimestamp: suggestion.detectionTimestamp,
      impactLevel: suggestion.impactLevel,
      estimatedAffectedUsers: suggestion.estAffectedUsers,
      estimatedDowntimeMins: suggestion.estDowntimeMins,
      suggestedClaimAmount: suggestion.suggestedClaimAmount,
      status: suggestion.draftClaimStatus,
      flaggedAsFalsePositive: suggestion.flaggedAsFalsePositive === 1,
      createdAt: suggestion.createdAt
    }));

    return NextResponse.json(
      {
        suggestions: formattedSuggestions,
        count: formattedSuggestions.length
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'An error occurred while retrieving IODA suggestions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/customer/claims/ioda-suggestions/[suggestionId]/claim
 * Customer converts a DRAFT IODA suggestion into an actual claim
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { suggestionId: string } }
) {
  try {
    const authOrResp = await requireAuth(request);
    if ((authOrResp as any).status) return authOrResp as NextResponse;
    const auth = authOrResp as AuthInfo;

    const { suggestionId } = params;
    const suggestionIdNum = parseInt(suggestionId);

    // Get customer associated with user
    const customer = await prisma.customer.findFirst({
      where: { user: { id: auth.userIdNum } }
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Get IODA suggestion
    const suggestion = await prisma.iODAClaimSuggestion.findUnique({
      where: { id: suggestionIdNum },
      include: { parametricPolicy: true }
    });

    if (!suggestion) {
      return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 });
    }

    // Verify suggestion belongs to this customer
    if (suggestion.customerId !== customer.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check if suggestion is still DRAFT
    if (suggestion.draftClaimStatus !== 'DRAFT') {
      return NextResponse.json(
        {
          error: `Suggestion cannot be claimed. Current status: ${suggestion.draftClaimStatus}`
        },
        { status: 400 }
      );
    }

    // Get the related workflow application/policy
    const workflowApp = await prisma.workflowPolicyApplication.findFirst({
      where: {
        customerId: customer.id,
        // Find the most recent active workflow
        status: { statusCode: { in: ['PAYMENT_PENDING', 'UNDERWRITING_COMPLETED', 'SIGNED', 'ACTIVE'] } }
      },
      orderBy: { createdAt: 'desc' },
      take: 1
    });

    if (!workflowApp) {
      return NextResponse.json(
        {
          error: 'No active policy found. Cannot create claim without an active policy.'
        },
        { status: 400 }
      );
    }

    // Create actual claim from suggestion (transactional)
    const claim = await prisma.$transaction(async (tx) => {
      // Generate claim number
      const sequenceRegistry = await tx.sequenceRegistry.findUnique({
        where: { sequenceName: 'WORKFLOW_CLAIM_NUMBER' }
      });

      let claimNumber = 'CLM-001';
      if (sequenceRegistry) {
        const newValue = sequenceRegistry.currentValue + 1;
        const paddedValue = String(newValue).padStart(6, '0');
        claimNumber = `CLM-${paddedValue}`;

        await tx.sequenceRegistry.update({
          where: { sequenceName: 'WORKFLOW_CLAIM_NUMBER' },
          data: { currentValue: newValue }
        });
      }

      // Create workflow claim
      const claim = await tx.workflowClaim.create({
        data: {
          claimNumber,
          policyApplicationId: workflowApp.id,
          customerId: customer.id,
          lossAmount: suggestion.suggestedClaimAmount,
          payoutAmount: suggestion.suggestedClaimAmount,
          createdBy: auth.userIdNum
        }
      });

      // Update IODA suggestion status
      await tx.iODAClaimSuggestion.update({
        where: { id: suggestion.id },
        data: {
          draftClaimStatus: 'CLAIMED',
          claimedAt: new Date(),
          claimedBy: auth.userIdNum
        }
      });

      return claim;
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        entityType: 'IODAClaimSuggestion',
        entityId: suggestion.id,
        action: 'IODA_SUGGESTION_CONVERTED_TO_CLAIM',
        actionCategory: 'CLAIMS_MANAGEMENT',
        actorId: auth.userIdNum,
        newValuesJson: JSON.stringify({
          claimId: claim.id,
          claimNumber: claim.claimNumber,
          sourceIODAAlert: suggestion.iodalertId
        })
      }
    });

    return NextResponse.json(
      {
        message: 'Claim created from IODA suggestion',
        claim: {
          id: claim.id,
          claimNumber: claim.claimNumber,
          lossAmount: claim.lossAmount,
          payoutAmount: claim.payoutAmount,
          status: 'SUBMITTED'
        }
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'An error occurred while creating the claim from IODA suggestion' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/customer/claims/ioda-suggestions/[suggestionId]/ignore
 * Customer marks an IODA suggestion as false positive
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { suggestionId: string } }
) {
  try {
    const authOrResp = await requireAuth(request);
    if ((authOrResp as any).status) return authOrResp as NextResponse;
    const auth = authOrResp as AuthInfo;

    const { suggestionId } = params;
    const { action } = await request.json(); // 'ignore' or 'mark_as_false_positive'

    const suggestionIdNum = parseInt(suggestionId);

    // Get customer associated with user
    const customer = await prisma.customer.findFirst({
      where: { user: { id: auth.userIdNum } }
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Get IODA suggestion
    const suggestion = await prisma.iODAClaimSuggestion.findUnique({
      where: { id: suggestionIdNum }
    });

    if (!suggestion) {
      return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 });
    }

    // Verify suggestion belongs to this customer
    if (suggestion.customerId !== customer.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (action === 'ignore') {
      // Mark as ignored
      const updated = await prisma.iODAClaimSuggestion.update({
        where: { id: suggestionIdNum },
        data: {
          draftClaimStatus: 'IGNORED',
          ignoredAt: new Date(),
          ignoredBy: auth.userIdNum
        }
      });

      return NextResponse.json(
        { message: 'Suggestion marked as ignored', suggestion: updated },
        { status: 200 }
      );
    } else if (action === 'mark_as_false_positive') {
      // Mark as false positive (admin review)
      const updated = await prisma.iODAClaimSuggestion.update({
        where: { id: suggestionIdNum },
        data: {
          flaggedAsFalsePositive: 1,
          falsePositiveBy: auth.userIdNum
        }
      });

      // Create audit log for false positive flag
      await prisma.auditLog.create({
        data: {
          entityType: 'IODAClaimSuggestion',
          entityId: suggestion.id,
          action: 'IODA_SUGGESTION_FLAGGED_FALSE_POSITIVE',
          actionCategory: 'IODA_MANAGEMENT',
          actorId: auth.userIdNum
        }
      });

      return NextResponse.json(
        { message: 'Suggestion flagged as false positive for admin review', suggestion: updated },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { error: 'Invalid action. Must be "ignore" or "mark_as_false_positive"' },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'An error occurred while updating the IODA suggestion' },
      { status: 500 }
    );
  }
}

