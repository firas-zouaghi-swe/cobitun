import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthInfo, AuthInfo } from '@/lib/services/auth-helper';
import { requireAuth, isOwnerOrAdmin } from '@/lib/services/authorization';

// v3: Risk multipliers from EnumSecurityPosture table (fallback)
const RISK_MULTIPLIERS: Record<string, number> = {
  EXCELLENT: 0.8,
  GOOD: 1.0,
  FAIR: 1.5,
  POOR: 2.5,
};

// Patch cadence scoring
const PATCH_CADENCE_SCORES: Record<string, number> = {
  'Ad-hoc': -10,
  Monthly: -5,
  Weekly: 0,
  Daily: 5,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function mapSecurityPosture(score: number): string {
  if (score >= 80) return 'EXCELLENT';
  if (score >= 60) return 'GOOD';
  if (score >= 40) return 'FAIR';
  return 'POOR';
}

/**
 * Generate application number using sequence_registry
 */
async function generateApplicationNumber(): Promise<string> {
  const sequenceName = 'cyber_application';
  const currentYear = new Date().getFullYear();

  const sequence = await db.sequenceRegistry.upsert({
    where: { sequenceName },
    create: {
      sequenceName,
      currentValue: 1,
      prefix: 'CYB',
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

export async function POST(request: NextRequest) {
  try {
    const authOrResp = await requireAuth(request);
    if (authOrResp instanceof NextResponse) return authOrResp;
    const auth = authOrResp as AuthInfo;

    const body = await request.json();
    const { customerId, productId, answers, securityPostureId } = body;

    if (!customerId || !productId || !answers) {
      return NextResponse.json(
        { error: 'customerId, productId, and answers are required' },
        { status: 400 }
      );
    }

    const parsedCustomerId = parseInt(customerId, 10);
    const parsedProductId = parseInt(productId, 10);

    // Verify customer exists
    const customer = await db.customer.findUnique({ where: { id: parsedCustomerId } });
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }
    if (!isOwnerOrAdmin(auth, parsedCustomerId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get product with underwriting questions
    const product = await db.product.findUnique({
      where: { id: parsedProductId },
      include: {
        underwritingQuestions: {
          where: { isDeleted: 0 },
          orderBy: { sortOrder: 'asc' },
        },
        coverageGrants: { where: { isActive: 1, isDeleted: 0 } },
        exclusions: { where: { isActive: 1, isDeleted: 0 } },
      },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (!product.isActive) {
      return NextResponse.json({ error: 'Product is not active' }, { status: 400 });
    }

    // Validate all required underwriting questions are answered
    const requiredQuestions = product.underwritingQuestions.filter((q) => q.isRequired === 1);
    const missingFields: string[] = [];

    for (const q of requiredQuestions) {
      if (answers[q.fieldName] === undefined || answers[q.fieldName] === null || answers[q.fieldName] === '') {
        missingFields.push(q.fieldName);
      }
    }

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: 'Missing required answers', missingFields },
        { status: 400 }
      );
    }

    // Calculate risk score
    let riskScore = 100;
    const waiverFlags: string[] = [];

    for (const q of product.underwritingQuestions) {
      const answer = answers[q.fieldName];

      // v3: questionType is FK - check by questionTypeId
      if (q.questionTypeId && q.expectedAnswer) {
        const questionType = await db.enumQuestionType.findUnique({
          where: { id: q.questionTypeId },
        });
        if (questionType?.typeCode === 'BOOLEAN' && q.expectedAnswer === 'true') {
          if (answer === false || answer === 'false') {
            riskScore -= 15;
            waiverFlags.push(q.fieldName);
          }
        }
      }
    }

    // Patch cadence adjustment
    const patchCadence = answers['patchCadence'];
    if (patchCadence && PATCH_CADENCE_SCORES[patchCadence] !== undefined) {
      riskScore += PATCH_CADENCE_SCORES[patchCadence];
    }

    // IT security team size adjustment
    const itSecurityTeamSize = Number(answers['itSecurityTeamSize']) || 0;
    if (itSecurityTeamSize > 10) {
      riskScore += 10;
    } else if (itSecurityTeamSize > 5) {
      riskScore += 5;
    }

    // Prior incidents adjustment
    const priorIncidents = answers['priorIncidents'];
    if (priorIncidents && priorIncidents !== 'None' && priorIncidents !== 'none') {
      riskScore -= 10;
    }

    // Clamp to 0-100
    riskScore = clamp(Math.round(riskScore), 0, 100);

    // Map to security posture
    const postureCode = mapSecurityPosture(riskScore);

    // v3: Look up securityPostureId from EnumSecurityPosture
    let resolvedSecurityPostureId: number;

    if (securityPostureId) {
      // If provided, use it directly
      resolvedSecurityPostureId = parseInt(securityPostureId, 10);
    } else {
      // Look up by postureCode
      const posture = await db.enumSecurityPosture.findFirst({
        where: { postureCode, isCurrent: 1 },
        select: { id: true, riskMultiplier: true },
      });

      if (!posture) {
        return NextResponse.json(
          { error: `Security posture '${postureCode}' not found in enum table` },
          { status: 500 }
        );
      }
      resolvedSecurityPostureId = posture.id;
    }

    // Get the posture's risk multiplier
    const postureRecord = await db.enumSecurityPosture.findUnique({
      where: { id: resolvedSecurityPostureId },
      select: { postureCode: true, riskMultiplier: true },
    });
    const riskMultiplier = postureRecord
      ? Number(postureRecord.riskMultiplier)
      : RISK_MULTIPLIERS[postureCode] || 1.0;

    // Calculate preliminary premium
    const policyLimit = Number(product.masterPolicyLimit) || 100000;
    const baseRatePer1000 = Number(product.baseRatePer1000) || 0;
    let calculatedPremium = baseRatePer1000 * (policyLimit / 1000) * riskMultiplier;

    // Enforce minimum premium
    if (calculatedPremium < Number(product.minimumPremiumTnd)) {
      calculatedPremium = Number(product.minimumPremiumTnd);
    }

    // Round to 2 decimal places
    calculatedPremium = Math.round(calculatedPremium * 100) / 100;

    // Look up SUBMITTED status ID
    const submittedStatus = await db.enumCyberAppStatus.findFirst({
      where: { statusCode: 'SUBMITTED', isCurrent: 1 },
      select: { id: true },
    });

    // Generate application number
    const applicationNumber = await generateApplicationNumber();

    // Create CyberApplication (v3: uses securityPostureId, statusId, applicationNumber)
    const application = await db.cyberApplication.create({
      data: {
        applicationNumber,
        customerId: parsedCustomerId,
        productId: parsedProductId,
        answersJson: JSON.stringify(answers),
        riskScore,
        securityPostureId: resolvedSecurityPostureId,
        calculatedPremium,
        waiverFlagsJson: JSON.stringify(waiverFlags),
        statusId: submittedStatus?.id ?? null,
        submittedAt: new Date(),
      },
      include: {
        customer: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        product: {
          include: {
            category: true,
            coverageGrants: { where: { isActive: 1, isDeleted: 0 } },
            exclusions: { where: { isActive: 1, isDeleted: 0 } },
          },
        },
        securityPosture: true,
        status: true,
      },
    });

    return NextResponse.json({
      application: {
        ...application,
        answers: JSON.parse(application.answersJson),
        waiverFlags: JSON.parse(application.waiverFlagsJson),
        riskScore: Number(application.riskScore),
        calculatedPremium: Number(application.calculatedPremium),
      },
    });
  } catch (error) {
    console.error('Apply for cyber indemnity error:', error);
    // In development return the error message to help debugging; in production keep generic.
    const message = (error && (error as any).message) ? (error as any).message : String(error);
    const safeMessage = process.env.NODE_ENV === 'production' ? 'Internal server error' : message;
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}

