import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthInfo, AuthInfo } from '@/lib/services/auth-helper';
import { requireAuth, isOwnerOrAdminAsync } from '@/lib/services/authorization';
import {
  SECTORS,
  BUSINESS_MODELS,
  RESILIENCE_PROFILE_OPTIONS,
  SECTOR_FACTORS,
  BM_FACTORS,
  RESILIENCE_PROFILES,
  ASN_RISK_FACTORS,
  calculateFullPremiumV3,
  MIN_TURNOVER_TND,
  MAX_TURNOVER_TND,
} from '@/lib/parametric-engine';

/**
 * GET /api/customer/apply-parametric
 * Return dropdown options from ref tables (where isCurrent=1)
 * Also include cloud providers and legacy hardcoded factors for fallback
 */
export async function GET() {
  try {
    // Fetch current reference data from DB
    const [sectors, businessModels, turnoverBands, resilienceProfiles, providers] = await Promise.all([
      db.refSector.findMany({
        where: { isCurrent: 1, isActive: 1 },
        select: { id: true, sectorCode: true, sectorName: true, riskFactor: true },
        orderBy: { sectorName: 'asc' },
      }),
      db.refBusinessModel.findMany({
        where: { isCurrent: 1, isActive: 1 },
        select: { id: true, modelCode: true, modelName: true, riskFactor: true },
        orderBy: { modelName: 'asc' },
      }),
      db.refTurnoverBand.findMany({
        where: { isCurrent: 1, isActive: 1 },
        select: { id: true, bandCode: true, bandName: true, riskFactor: true, minTurnover: true, maxTurnover: true },
        orderBy: { minTurnover: 'asc' },
      }),
      db.refResilienceProfile.findMany({
        where: { isCurrent: 1, isActive: 1 },
        select: { id: true, profileCode: true, profileName: true, riskFactor: true, description: true },
        orderBy: { riskFactor: 'asc' },
      }),
      db.cloudProvider.findMany({
        where: { isActive: 1, isDeleted: 0 },
        orderBy: { organisationName: 'asc' },
        include: { slaTier: { select: { tierCode: true, tierName: true, mttrHours: true, basePremiumFactor: true } } },
      }),
    ]);

    // Get a parametric product for reference
    const parametricType = await db.enumProductType.findFirst({
      where: { typeCode: 'PARAMETRIC', isCurrent: 1 },
      select: { id: true },
    });

    const parametricProduct = parametricType
      ? await db.product.findFirst({
          where: { productTypeId: parametricType.id, isActive: 1, isDeleted: 0 },
          select: { id: true, productCode: true, productName: true },
        })
      : null;

    return NextResponse.json({
      // v3 DB-based reference data
      sectors: sectors.map((s) => ({ id: s.id, code: s.sectorCode, name: s.sectorName, riskFactor: Number(s.riskFactor) })),
      businessModels: businessModels.map((b) => ({ id: b.id, code: b.modelCode, name: b.modelName, riskFactor: Number(b.riskFactor) })),
      turnoverBands: turnoverBands.map((t) => ({
        id: t.id,
        code: t.bandCode,
        name: t.bandName,
        riskFactor: Number(t.riskFactor),
        minTurnover: Number(t.minTurnover),
        maxTurnover: Number(t.maxTurnover),
      })),
      resilienceProfiles: resilienceProfiles.map((r) => ({
        id: r.id,
        code: r.profileCode,
        name: r.profileName,
        riskFactor: Number(r.riskFactor),
        description: r.description,
      })),
      providers: providers.map((p) => ({
        id: p.id,
        asn: p.asn,
        organisationName: p.organisationName,
        isActive: Number(p.isActive),
        mttrHours: Number(p.mttrHours),
        riskScore: Number(p.riskScore),
        premiumFactor: Number(p.premiumFactor),
        slaTier: p.slaTier
          ? {
              tierCode: p.slaTier.tierCode,
              tierName: p.slaTier.tierName,
              mttrHours: Number(p.slaTier.mttrHours),
              basePremiumFactor: Number(p.slaTier.basePremiumFactor),
            }
          : null,
      })),
      parametricProduct,
      // Legacy hardcoded factors for fallback
      legacySectors: SECTORS,
      legacySectorFactors: SECTOR_FACTORS,
      legacyBusinessModels: BUSINESS_MODELS,
      legacyBmFactors: BM_FACTORS,
      legacyResilienceProfiles: RESILIENCE_PROFILE_OPTIONS,
      legacyResilienceProfilesDetail: Object.fromEntries(
        Object.entries(RESILIENCE_PROFILES).map(([k, v]) => [k, { label: v.label, description: v.description, factor: v.factor }])
      ),
      asnRiskFactors: ASN_RISK_FACTORS,
      eligibility: {
        minTurnoverTnd: MIN_TURNOVER_TND,
        maxTurnoverTnd: MAX_TURNOVER_TND,
      },
    });
  } catch (error) {
    console.error('Get parametric form data error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/customer/apply-parametric
 * Accept sectorId, businessModelId, turnoverBandId, resilienceProfileId (integer IDs)
 * Look up current risk factors from ref tables
 * Call calculateFullPremiumV3() with the new inputs
 * Create ParametricPolicy with all FK IDs and snapshot factor values
 * Generate policyNumber using sequence_registry
 */
export async function POST(request: NextRequest) {
  try {
    const authOrResp = await requireAuth(request);
    if ((authOrResp as any).status) return authOrResp as NextResponse;
    const auth = authOrResp as AuthInfo;

    const currentUser = await db.user.findUnique({
      where: { id: auth.userIdNum },
      select: { emailVerified: true },
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'Authenticated user not found' }, { status: 404 });
    }

    if (auth.role !== 'ADMIN' && currentUser.emailVerified !== 1) {
      return NextResponse.json({ error: 'Email verification required before applying for a policy' }, { status: 403 });
    }

    const body = await request.json();
    const {
      customerId,
      cloudProviderId,
      sectorId,
      businessModelId,
      turnoverBandId,
      resilienceProfileId,
      annualTurnoverTnd,
      productId,
    } = body;

    if (!customerId || !cloudProviderId || !annualTurnoverTnd) {
      return NextResponse.json(
        { error: 'Customer ID, Cloud Provider ID, and Annual Turnover are required' },
        { status: 400 }
      );
    }

    if (!sectorId || !businessModelId || !turnoverBandId || !resilienceProfileId) {
      return NextResponse.json(
        { error: 'sectorId, businessModelId, turnoverBandId, and resilienceProfileId are required' },
        { status: 400 }
      );
    }

    const turnover = Number(annualTurnoverTnd);
    if (isNaN(turnover) || turnover <= 0) {
      return NextResponse.json({ error: 'Annual turnover must be a positive number' }, { status: 400 });
    }

    // Verify customer exists
    const parsedCustomerId = parseInt(customerId, 10);
    const customer = await db.customer.findUnique({ where: { id: parsedCustomerId } });
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }
    if (!(await isOwnerOrAdminAsync(auth, parsedCustomerId))) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Verify provider exists
    const provider = await db.cloudProvider.findUnique({
      where: { id: parseInt(cloudProviderId, 10) },
      include: { slaTier: true },
    });
    if (!provider) {
      return NextResponse.json({ error: 'Cloud provider not found' }, { status: 404 });
    }

    // Find a parametric product if not provided
    let parametricProductId = productId ? parseInt(productId, 10) : null;
    if (!parametricProductId) {
      const parametricType = await db.enumProductType.findFirst({
        where: { typeCode: 'PARAMETRIC', isCurrent: 1 },
        select: { id: true },
      });
      if (parametricType) {
        const prod = await db.product.findFirst({
          where: { productTypeId: parametricType.id, isActive: 1, isDeleted: 0 },
          select: { id: true },
        });
        parametricProductId = prod?.id ?? null;
      }
    }

    if (!parametricProductId) {
      return NextResponse.json({ error: 'No parametric product available' }, { status: 400 });
    }

    // Run the v3 pricing engine
    const pricingInput = {
      sectorId: parseInt(sectorId, 10),
      businessModelId: parseInt(businessModelId, 10),
      annualTurnoverTnd: turnover,
      turnoverBandId: parseInt(turnoverBandId, 10),
      resilienceProfileId: parseInt(resilienceProfileId, 10),
      cloudProviderId: provider.id,
    };

    // Validate turnover
    const validationErrors: string[] = [];
    if (turnover < MIN_TURNOVER_TND) {
      validationErrors.push(`Annual turnover must be at least ${MIN_TURNOVER_TND.toLocaleString()} TND`);
    }
    if (turnover > MAX_TURNOVER_TND) {
      validationErrors.push(`Annual turnover exceeds ${MAX_TURNOVER_TND.toLocaleString()} TND — out of SME scope`);
    }
    if (validationErrors.length > 0) {
      return NextResponse.json({ error: 'Validation failed', validationErrors }, { status: 400 });
    }

    // Calculate full premium with v3 engine
    const breakdown = await calculateFullPremiumV3(pricingInput);

    // Look up status IDs
    const pendingStatus = await db.enumParamPolicyStatus.findFirst({
      where: { statusCode: 'PENDING', isCurrent: 1 },
      select: { id: true },
    });
    const rejectedStatus = await db.enumParamPolicyStatus.findFirst({
      where: { statusCode: 'REJECTED', isCurrent: 1 },
      select: { id: true },
    });

    // Generate policyNumber using sequence_registry (atomic transaction to prevent race conditions)
    const sequenceName = 'parametric_policy';
    const currentYear = new Date().getFullYear();
    const policyNumber = await db.$transaction(async (tx) => {
      const sequence = await tx.sequenceRegistry.upsert({
        where: { sequenceName },
        create: {
          sequenceName,
          currentValue: 1,
          prefix: 'PAR',
          paddingWidth: 6,
          yearReset: 1,
          lastYear: currentYear,
        },
        update: {},
      });

      let currentValue = sequence.currentValue;
      if (sequence.yearReset === 1 && sequence.lastYear !== currentYear) {
        currentValue = 1;
        await tx.sequenceRegistry.update({
          where: { sequenceName },
          data: { currentValue: 2, lastYear: currentYear },
        });
      } else {
        await tx.sequenceRegistry.update({
          where: { sequenceName },
          data: { currentValue: currentValue + 1 },
        });
      }
      return `${sequence.prefix}-${currentYear}-${String(currentValue).padStart(sequence.paddingWidth, '0')}`;
    });

    // Check for underwriting auto-decline
    if (breakdown.underwritingDecision === 'DECLINE') {
      const policy = await db.parametricPolicy.create({
        data: {
          policyNumber,
          customerId: parsedCustomerId,
          cloudProviderId: provider.id,
          productId: parametricProductId,
          sectorId: pricingInput.sectorId,
          businessModelId: pricingInput.businessModelId,
          turnoverBandId: pricingInput.turnoverBandId,
          resilienceProfileId: pricingInput.resilienceProfileId,
          annualTurnoverTnd: turnover,
          hourlyRevenue: breakdown.hourlyRevenue,
          basePremium: breakdown.purePremium,
          commercialPremium: breakdown.commercialPremium,
          providerAdjustedPremium: breakdown.commercialPremium * breakdown.providerFactor,
          finalPremium: breakdown.finalPremium,
          premiumRatePct: breakdown.premiumRatePct,
          maxInsuredHours: 168.0,
          hourlyPayoutRate: breakdown.payoutPerHour,
          maxPayoutAmount: breakdown.maxPayoutPerEvent,
          sectorFactorAtCreation: breakdown.sectorFactorAtCreation,
          businessModelFactorAtCreation: breakdown.businessModelFactorAtCreation,
          turnoverBandFactorAtCreation: breakdown.turnoverBandFactorAtCreation,
          resilienceFactorAtCreation: breakdown.resilienceFactorAtCreation,
          providerFactorAtCreation: breakdown.providerFactorAtCreation,
          underwritingDecision: breakdown.underwritingDecision,
          underwritingNotes: breakdown.underwritingReason,
          statusId: rejectedStatus?.id ?? null,
          effectiveDate: null,
          expiryDate: null,
        },
        include: {
          cloudProvider: true,
          status: true,
        },
      });

      return NextResponse.json({
        policy,
        breakdown,
        message: 'Application auto-declined based on underwriting thresholds.',
      });
    }

    // Check for existing active policy with same provider
    const pendingAndApproved = [pendingStatus?.id, rejectedStatus?.id].filter((id): id is number => id != null);
    const existingPolicy = await db.parametricPolicy.findFirst({
      where: {
        customerId: parsedCustomerId,
        cloudProviderId: provider.id,
        statusId: { in: pendingAndApproved.length > 0 ? pendingAndApproved : undefined },
        isDeleted: 0,
      },
    });

    if (existingPolicy) {
      return NextResponse.json(
        { error: 'You already have an active or pending policy with this provider' },
        { status: 400 }
      );
    }

    // Create the policy
    const policy = await db.parametricPolicy.create({
      data: {
        policyNumber,
        customerId: parsedCustomerId,
        cloudProviderId: provider.id,
        productId: parametricProductId,
        sectorId: pricingInput.sectorId,
        businessModelId: pricingInput.businessModelId,
        turnoverBandId: pricingInput.turnoverBandId,
        resilienceProfileId: pricingInput.resilienceProfileId,
        annualTurnoverTnd: turnover,
        hourlyRevenue: breakdown.hourlyRevenue,
        basePremium: breakdown.purePremium,
        commercialPremium: breakdown.commercialPremium,
        providerAdjustedPremium: breakdown.commercialPremium * breakdown.providerFactor,
        finalPremium: breakdown.finalPremium,
        premiumRatePct: breakdown.premiumRatePct,
        maxInsuredHours: 168.0,
        hourlyPayoutRate: breakdown.payoutPerHour,
        maxPayoutAmount: breakdown.maxPayoutPerEvent,
        sectorFactorAtCreation: breakdown.sectorFactorAtCreation,
        businessModelFactorAtCreation: breakdown.businessModelFactorAtCreation,
        turnoverBandFactorAtCreation: breakdown.turnoverBandFactorAtCreation,
        resilienceFactorAtCreation: breakdown.resilienceFactorAtCreation,
        providerFactorAtCreation: breakdown.providerFactorAtCreation,
        underwritingDecision: breakdown.underwritingDecision,
        underwritingNotes: breakdown.underwritingReason,
        statusId: pendingStatus?.id ?? null,
        effectiveDate: null,
        expiryDate: null,
      },
      include: {
        cloudProvider: { include: { slaTier: true } },
        status: true,
        sector: true,
        businessModel: true,
        turnoverBand: true,
        resilienceProfile: true,
      },
    });

    return NextResponse.json({
      policy,
      breakdown,
    });
  } catch (error) {
    console.error('Apply parametric policy error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

