// ============================================================================
// Parametric Cloud Outage Insurance — Granular Pricing Engine for Tunisian SMEs
// Based on actuarial study "Parametric_Cloud_Insurance_Tunisian_Startups" (v0.0)
// Pipeline: Raw Events → Cap at 168h → Merge within 2h gap → SLA-Strict trigger → Auto-create claims
// Refactored for v3 Prisma schema: integer FKs, DB-based reference data, concrete associations
// ============================================================================

import { db } from '@/lib/db';
import { fetchRecentForProvider } from './ioda-client';

// ==================== ACTUARIAL CONSTANTS (from study) ====================

export const MAX_OUTAGE_HOURS = 168.0; // 7-day cap (Type-I censoring)
export const MERGE_GAP_HOURS = 2.0; // Merge events within 2h gap
export const LOADING_FACTOR = 1.32; // 32% loading (Study Partie XVI)
export const BASE_FREQUENCY = 1.1212; // Annual frequency per SME (Part XV)
export const BASE_SEVERITY = 107.07; // Mean insured hours per event (Part XIII)
export const HOURS_PER_YEAR = 8760; // 365.25 days × 24 hours
export const MIN_TURNOVER_TND = 50000; // Minimum eligible turnover
export const MAX_TURNOVER_TND = 15000000; // Maximum eligible turnover
export const MIN_PREMIUM_RATE_PCT = 0.05; // Soft lower bound
export const MAX_PREMIUM_RATE_PCT = 2.0; // Soft upper bound
export const RANDOM_SEED = 42; // Reproducibility

// ==================== 1. SECTOR FACTORS (16 categories) ====================
// Source: Part XIV, pages 34–35
// Kept as fallback when DB reference data is not available

export interface SectorFactors {
  gm: number; // Gross Margin
  cd: number; // Cloud Dependency
  cr: number; // Criticality
}

export const SECTOR_FACTORS: Record<string, SectorFactors> = {
  'E-commerce': { gm: 0.30, cd: 0.85, cr: 0.80 },
  'EdTech': { gm: 0.68, cd: 0.75, cr: 0.60 },
  'Business Software': { gm: 0.75, cd: 0.90, cr: 0.85 },
  'AI': { gm: 0.70, cd: 0.80, cr: 0.75 },
  'Creative Content': { gm: 0.55, cd: 0.60, cr: 0.50 },
  'FinTech': { gm: 0.65, cd: 0.95, cr: 0.95 },
  'Biotechnology': { gm: 0.62, cd: 0.55, cr: 0.55 },
  'IoT': { gm: 0.50, cd: 0.70, cr: 0.70 },
  'Energy': { gm: 0.32, cd: 0.40, cr: 0.65 },
  'Logistics': { gm: 0.25, cd: 0.65, cr: 0.75 },
  'Cleantech': { gm: 0.45, cd: 0.50, cr: 0.45 },
  'Social Platforms': { gm: 0.65, cd: 0.95, cr: 0.90 },
  'Agritech': { gm: 0.40, cd: 0.45, cr: 0.40 },
  'Blockchain': { gm: 0.70, cd: 0.85, cr: 0.80 },
  'InsurTech': { gm: 0.65, cd: 0.90, cr: 0.85 },
  'Other': { gm: 0.45, cd: 0.60, cr: 0.55 },
};

export const SECTORS: string[] = Object.keys(SECTOR_FACTORS);

// ==================== 2. BUSINESS MODEL FACTORS (5 types) ====================
// Source: Part XIV, page 35

export interface BusinessModelInfo {
  factor: number; // BM multiplier
  share: number; // Market share %
}

export const BM_FACTORS: Record<string, BusinessModelInfo> = {
  'B2C': { factor: 1.00, share: 28.16 },
  'B2B': { factor: 0.80, share: 46.55 },
  'B2B2C': { factor: 0.95, share: 10.34 },
  'Mixed (B2B/B2C)': { factor: 0.90, share: 14.94 },
  'Other': { factor: 0.85, share: 0.01 },
};

export const BUSINESS_MODELS: string[] = Object.keys(BM_FACTORS);

// ==================== 3. TURNOVER BANDS (5 bands, adapted for SMEs) ====================

export interface TurnoverBand {
  min: number;
  max: number;
  share: number;
  midpoint: number;
  label: string;
}

export const TURNOVER_BANDS: TurnoverBand[] = [
  { min: 0, max: 500000, share: 25, midpoint: 250000, label: '< 500,000 TND' },
  { min: 500000, max: 2000000, share: 35, midpoint: 1250000, label: '500K – 2M TND' },
  { min: 2000000, max: 5000000, share: 20, midpoint: 3500000, label: '2M – 5M TND' },
  { min: 5000000, max: 10000000, share: 15, midpoint: 7500000, label: '5M – 10M TND' },
  { min: 10000000, max: 15000000, share: 5, midpoint: 12500000, label: '10M – 15M TND' },
];

// ==================== 4. RESILIENCE PROFILES (3 levels) ====================
// Source: Part XIV, page 34

export interface ResilienceProfile {
  resilience: number; // R value
  factor: number; // 1/R
  label: string;
  description: string;
}

export const RESILIENCE_PROFILES: Record<string, ResilienceProfile> = {
  'High': { resilience: 0.50, factor: 2.00, label: 'High', description: 'Strong disaster recovery, redundancy, and failover systems' },
  'Medium': { resilience: 0.75, factor: 1.3333, label: 'Medium', description: 'Basic backup and recovery procedures in place' },
  'Low': { resilience: 1.00, factor: 1.00, label: 'Low', description: 'Minimal recovery capability, single points of failure' },
};

export const RESILIENCE_PROFILE_OPTIONS: string[] = Object.keys(RESILIENCE_PROFILES);

// Default: Medium (portfolio average was 0.775, factor ~1.29)
export const DEFAULT_RESILIENCE_PROFILE = 'Medium';

// ==================== 5. PROVIDER (ASN) RISK FACTORS ====================
// Source: Part XIX, page 49

export const ASN_RISK_FACTORS: Record<number, { riskScore: number; premiumFactor: number; tier: string }> = {
  37492: { riskScore: 76.1, premiumFactor: 1.38, tier: 'Gold' },   // Orange Tunisie
  37693: { riskScore: 37.9, premiumFactor: 1.19, tier: 'Gold' },   // Ooredoo Tunisie
  37504: { riskScore: 92.5, premiumFactor: 1.46, tier: 'Silver' }, // EO Data Center
  37717: { riskScore: 5.2, premiumFactor: 1.03, tier: 'Silver' },  // El Khawarizmi
  37671: { riskScore: 58.6, premiumFactor: 1.29, tier: 'Silver' }, // 3S INF (Globalnet)
  37703: { riskScore: 0, premiumFactor: 1.00, tier: 'Bronze' },    // ATLAX (not enough data)
  328880: { riskScore: 76.1, premiumFactor: 1.38, tier: 'Bronze' }, // SMART SOLUTIONS
  327934: { riskScore: 34.7, premiumFactor: 1.17, tier: 'Gold' },   // Tunisie Telecom
  328414: { riskScore: 54.5, premiumFactor: 1.27, tier: 'Bronze' }, // Next Step IT
  50624: { riskScore: 54.5, premiumFactor: 1.27, tier: 'Bronze' },  // NeoLedge (Outscale)
  53306: { riskScore: 54.5, premiumFactor: 1.27, tier: 'Bronze' },  // NeoLedge (Outscale)
  49584: { riskScore: 0, premiumFactor: 1.00, tier: 'Platinum' },   // DATAXION (not enough data)
  328394: { riskScore: 0, premiumFactor: 1.00, tier: 'Bronze' },    // RFC (not enough data)
};

// ==================== 6. FIXED BASE PARAMETERS ====================
// Portfolio averages — same for all SMEs (known limitation MR-003)

export const BASE_PARAMS = {
  frequency: BASE_FREQUENCY,           // 1.1212 events/year
  severity: BASE_SEVERITY,             // 107.07 hours
  portfolioHourlyRevenue: 39.39,       // TND/h (345k / 8760)
  portfolioGM: 0.500,                  // Average gross margin
  portfolioCD: 0.754,                  // Average cloud dependency
  portfolioCR: 0.719,                  // Average criticality
  portfolioResilienceFactor: 1.2903,   // 1/0.775
  loadingMultiplier: LOADING_FACTOR,   // 1.32
} as const;

// ==================== MTTR BY SLA TIER ====================

export const MTTR_BY_TIER: Record<string, number> = {
  Bronze: 16.0,
  Silver: 12.0,
  Gold: 8.0,
  Platinum: 4.0,
};

// ==================== 7. DB-BASED FACTOR LOOKUPS (v3) ====================

/**
 * Look up current sector risk factor from ref_sector table by ID.
 * Falls back to hardcoded constants if DB lookup fails.
 */
export async function getSectorFactorsById(sectorId: number): Promise<{ riskFactor: number; sectorCode: string }> {
  try {
    const sector = await db.refSector.findFirst({
      where: { id: sectorId, isCurrent: 1 },
      select: { riskFactor: true, sectorCode: true },
    });
    if (sector) {
      return { riskFactor: Number(sector.riskFactor), sectorCode: sector.sectorCode };
    }
  } catch {
    // Fall through to fallback
  }
  return { riskFactor: 1.0, sectorCode: 'OTHER' };
}

/**
 * Look up current business model risk factor from ref_business_model table by ID.
 * Falls back to hardcoded constants if DB lookup fails.
 */
export async function getBusinessModelFactorById(businessModelId: number): Promise<{ riskFactor: number; modelCode: string }> {
  try {
    const bm = await db.refBusinessModel.findFirst({
      where: { id: businessModelId, isCurrent: 1 },
      select: { riskFactor: true, modelCode: true },
    });
    if (bm) {
      return { riskFactor: Number(bm.riskFactor), modelCode: bm.modelCode };
    }
  } catch {
    // Fall through to fallback
  }
  return { riskFactor: 0.85, modelCode: 'OTHER' };
}

/**
 * Look up current turnover band risk factor from ref_turnover_band table by ID.
 * Falls back to hardcoded constants if DB lookup fails.
 */
export async function getTurnoverBandFactorById(turnoverBandId: number): Promise<{ riskFactor: number; bandCode: string; minTurnover: number; maxTurnover: number }> {
  try {
    const band = await db.refTurnoverBand.findFirst({
      where: { id: turnoverBandId, isCurrent: 1 },
      select: { riskFactor: true, bandCode: true, minTurnover: true, maxTurnover: true },
    });
    if (band) {
      return { riskFactor: Number(band.riskFactor), bandCode: band.bandCode, minTurnover: Number(band.minTurnover), maxTurnover: Number(band.maxTurnover) };
    }
  } catch {
    // Fall through to fallback
  }
  return { riskFactor: 1.0, bandCode: 'UNKNOWN', minTurnover: 0, maxTurnover: 0 };
}

/**
 * Look up current resilience profile risk factor from ref_resilience_profile table by ID.
 * Falls back to hardcoded constants if DB lookup fails.
 */
export async function getResilienceProfileFactorById(resilienceProfileId: number): Promise<{ riskFactor: number; profileCode: string }> {
  try {
    const profile = await db.refResilienceProfile.findFirst({
      where: { id: resilienceProfileId, isCurrent: 1 },
      select: { riskFactor: true, profileCode: true },
    });
    if (profile) {
      return { riskFactor: Number(profile.riskFactor), profileCode: profile.profileCode };
    }
  } catch {
    // Fall through to fallback
  }
  return { riskFactor: 1.3333, profileCode: 'MEDIUM' };
}

/**
 * Get sector factors — defaults to "Other" if sector not found
 */
export function getSectorFactors(sector: string): SectorFactors {
  return SECTOR_FACTORS[sector] || SECTOR_FACTORS['Other'];
}

/**
 * Get business model factor — defaults to 0.85 ("Other") if not found
 */
export function getBMFactor(businessModel: string): number {
  return BM_FACTORS[businessModel]?.factor || BM_FACTORS['Other'].factor;
}

/**
 * Get resilience profile — defaults to "Medium" if not found
 */
export function getResilienceProfile(profile: string): ResilienceProfile {
  return RESILIENCE_PROFILES[profile] || RESILIENCE_PROFILES[DEFAULT_RESILIENCE_PROFILE];
}

/**
 * Get provider risk factor from ASN — defaults to 1.00 if not found or not enabled
 */
export function getProviderFactor(asn?: number, enable?: boolean): number {
  if (!enable || !asn) return 1.00;
  return ASN_RISK_FACTORS[asn]?.premiumFactor || 1.00;
}

/**
 * Find which turnover band applies
 */
export function findTurnoverBand(annualTurnoverTnd: number): TurnoverBand {
  for (const band of TURNOVER_BANDS) {
    if (annualTurnoverTnd >= band.min && annualTurnoverTnd < band.max) {
      return band;
    }
  }
  // Above 15M → last band (but will be declined by validation)
  if (annualTurnoverTnd >= 15000000) return TURNOVER_BANDS[TURNOVER_BANDS.length - 1];
  return TURNOVER_BANDS[0];
}

/**
 * Look up the turnover band DB record by turnover amount.
 * Finds the current ref_turnover_band where the turnover falls within min/max range.
 */
export async function findTurnoverBandDb(annualTurnoverTnd: number): Promise<{ id: number; riskFactor: number; bandCode: string } | null> {
  try {
    const band = await db.refTurnoverBand.findFirst({
      where: {
        isCurrent: 1,
        minTurnover: { lte: annualTurnoverTnd },
        maxTurnover: { gt: annualTurnoverTnd },
      },
      select: { id: true, riskFactor: true, bandCode: true },
    });
    return band ? { id: band.id, riskFactor: Number(band.riskFactor), bandCode: band.bandCode } : null;
  } catch {
    return null;
  }
}

// ==================== 8. PRICING CALCULATION — Step-by-step ====================

export interface PricingInput {
  sector: string;
  businessModel: string;
  annualTurnoverTnd: number;
  resilienceProfile: string;
  providerAsn?: number;
  enableProviderFactor?: boolean;
}

/**
 * v3 pricing input using integer FK IDs for reference data.
 */
export interface PricingInputV3 {
  sectorId: number;
  businessModelId: number;
  annualTurnoverTnd: number;
  turnoverBandId: number;
  resilienceProfileId: number;
  cloudProviderId?: number;
}

export interface PricingBreakdown {
  // Step 1
  hourlyRevenue: number;
  // Step 2 — looked-up factors
  gm: number;
  cd: number;
  cr: number;
  bmFactor: number;
  resilienceFactor: number;
  providerFactor: number;
  // Step 3
  purePremium: number;
  // Step 4
  commercialPremium: number;
  // Step 5
  finalPremium: number;
  // Step 6
  premiumRatePct: number;
  // Additional
  payoutPerHour: number;
  maxPayoutPerEvent: number;
  turnoverBand: string;
  underwritingDecision: string;
  underwritingReason: string;
  validationErrors: string[];
}

/**
 * v3 pricing breakdown with snapshot factor values for DB storage.
 */
export interface PricingBreakdownV3 extends PricingBreakdown {
  sectorFactorAtCreation: number;
  businessModelFactorAtCreation: number;
  turnoverBandFactorAtCreation: number;
  resilienceFactorAtCreation: number;
  providerFactorAtCreation: number;
}

/**
 * Validate application inputs
 */
export function validateApplication(input: PricingInput): string[] {
  const errors: string[] = [];

  if (!input.annualTurnoverTnd || input.annualTurnoverTnd < MIN_TURNOVER_TND) {
    errors.push(`Annual turnover must be at least ${MIN_TURNOVER_TND.toLocaleString()} TND`);
  }

  if (input.annualTurnoverTnd > MAX_TURNOVER_TND) {
    errors.push(`Annual turnover exceeds ${MAX_TURNOVER_TND.toLocaleString()} TND — out of SME scope`);
  }

  if (!input.sector) {
    errors.push('Sector is required');
  }

  if (!input.businessModel) {
    errors.push('Business model is required');
  }

  if (!input.resilienceProfile) {
    errors.push('Resilience profile is required');
  }

  return errors;
}

/**
 * Determine underwriting decision based on premium rate vs. portfolio distribution.
 * The engine maintains dynamic Q25/Q75 thresholds computed from the portfolio.
 * Falls back to fixed defaults if insufficient portfolio data.
 */
export async function determineUnderwritingDecision(
  premiumRatePct: number
): Promise<{ decision: string; reason: string; q25: number; q75: number }> {
  // Default thresholds (will be overridden by portfolio distribution if available)
  let q25 = 0.20;
  let q75 = 0.45;

  // Try to compute from existing portfolio
  try {
    // In v3 schema, we need to look up the status by statusCode
    const pendingStatus = await db.enumParamPolicyStatus.findFirst({
      where: { statusCode: 'PENDING', isCurrent: 1 },
      select: { id: true },
    });
    const approvedStatus = await db.enumParamPolicyStatus.findFirst({
      where: { statusCode: 'APPROVED', isCurrent: 1 },
      select: { id: true },
    });

    const statusIds: number[] = [];
    if (pendingStatus) statusIds.push(pendingStatus.id);
    if (approvedStatus) statusIds.push(approvedStatus.id);

    const activePolicies = await db.parametricPolicy.findMany({
      where: {
        statusId: { in: statusIds },
      },
      select: { premiumRatePct: true },
      orderBy: { premiumRatePct: 'asc' },
    });

    if (activePolicies.length >= 10) {
      const rates = activePolicies
        .map((p) => Number(p.premiumRatePct))
        .filter((r) => r > 0)
        .sort((a, b) => a - b);

      if (rates.length >= 10) {
        const q25Idx = Math.floor(rates.length * 0.25);
        const q75Idx = Math.floor(rates.length * 0.75);
        q25 = rates[q25Idx];
        q75 = rates[q75Idx];
      }
    }
  } catch {
    // Use defaults if DB query fails
  }

  let decision: string;
  let reason: string;

  if (premiumRatePct < q25) {
    decision = 'AUTO_ACCEPT';
    reason = `Premium rate ${premiumRatePct.toFixed(4)}% is below Q25 (${q25.toFixed(4)}%) — auto-accept`;
  } else if (premiumRatePct < q75) {
    decision = 'MANUAL_REVIEW';
    reason = `Premium rate ${premiumRatePct.toFixed(4)}% is between Q25 (${q25.toFixed(4)}%) and Q75 (${q75.toFixed(4)}%) — manual underwriting review`;
  } else if (premiumRatePct < 1.5 * q75) {
    decision = 'SURCHARGE';
    reason = `Premium rate ${premiumRatePct.toFixed(4)}% is between Q75 (${q75.toFixed(4)}%) and 1.5×Q75 (${(1.5 * q75).toFixed(4)}%) — surcharge 50% or decline (case-by-case)`;
  } else {
    decision = 'DECLINE';
    reason = `Premium rate ${premiumRatePct.toFixed(4)}% is at or above 1.5×Q75 (${(1.5 * q75).toFixed(4)}%) — automatic decline`;
  }

  // Additional soft bounds check
  if (premiumRatePct < MIN_PREMIUM_RATE_PCT) {
    reason += '. Warning: below soft lower bound (0.05%) — triggers manual review';
    if (decision === 'AUTO_ACCEPT') decision = 'MANUAL_REVIEW';
  } else if (premiumRatePct > MAX_PREMIUM_RATE_PCT) {
    reason += '. Warning: above soft upper bound (2.0%) — triggers manual review';
    decision = 'DECLINE';
  }

  return { decision, reason, q25, q75 };
}

/**
 * Calculate payout per hour
 */
export function calculatePayoutPerHour(
  hourlyRevenue: number,
  gm: number,
  cd: number,
  cr: number,
  resilienceFactor: number,
  bmFactor: number
): number {
  return hourlyRevenue * gm * cd * cr * resilienceFactor * bmFactor;
}

/**
 * COMPLETE 7-Step Premium Calculation (legacy string-based version)
 * Returns full breakdown for transparency and storage
 */
export async function calculateFullPremium(input: PricingInput): Promise<PricingBreakdown> {
  const validationErrors = validateApplication(input);
  const sectorFactors = getSectorFactors(input.sector);
  const bmFactor = getBMFactor(input.businessModel);
  const resilienceProfile = getResilienceProfile(input.resilienceProfile);
  const providerFactor = getProviderFactor(input.providerAsn, input.enableProviderFactor);

  // Step 1: Calculate hourly revenue
  const hourlyRevenue = input.annualTurnoverTnd / HOURS_PER_YEAR;

  // Step 2: Look up factors
  const gm = sectorFactors.gm;
  const cd = sectorFactors.cd;
  const cr = sectorFactors.cr;
  const resilienceFactor = resilienceProfile.factor;

  // Step 3: Compute pure premium (expected loss)
  const purePremium =
    BASE_FREQUENCY *
    BASE_SEVERITY *
    hourlyRevenue *
    gm *
    cd *
    cr *
    resilienceFactor *
    bmFactor;

  // Step 4: Apply commercial loading
  const commercialPremium = purePremium * LOADING_FACTOR;

  // Step 5: Apply provider risk factor (optional)
  const finalPremium = commercialPremium * providerFactor;

  // Step 6: Calculate premium rate (as % of turnover)
  const premiumRatePct = input.annualTurnoverTnd > 0
    ? (finalPremium / input.annualTurnoverTnd) * 100
    : 0;

  // Additional calculations
  const payoutPerHour = calculatePayoutPerHour(hourlyRevenue, gm, cd, cr, resilienceFactor, bmFactor);
  const maxPayoutPerEvent = payoutPerHour * MAX_OUTAGE_HOURS;
  const turnoverBand = findTurnoverBand(input.annualTurnoverTnd);

  // Step 7: Underwriting decision (dynamic thresholds)
  let underwritingDecision = 'DECLINE';
  let underwritingReason = 'Validation errors prevent calculation';

  if (validationErrors.length === 0) {
    const uw = await determineUnderwritingDecision(premiumRatePct);
    underwritingDecision = uw.decision;
    underwritingReason = uw.reason;
  }

  return {
    hourlyRevenue: round4(hourlyRevenue),
    gm,
    cd,
    cr,
    bmFactor,
    resilienceFactor,
    providerFactor,
    purePremium: round2(purePremium),
    commercialPremium: round2(commercialPremium),
    finalPremium: round2(finalPremium),
    premiumRatePct: round4(premiumRatePct),
    payoutPerHour: round4(payoutPerHour),
    maxPayoutPerEvent: round2(maxPayoutPerEvent),
    turnoverBand: turnoverBand.label,
    underwritingDecision,
    underwritingReason,
    validationErrors,
  };
}

/**
 * v3 COMPLETE Premium Calculation using integer FK IDs.
 * Looks up factors from DB reference tables and returns snapshot values for storage.
 */
export async function calculateFullPremiumV3(input: PricingInputV3): Promise<PricingBreakdownV3> {
  // Look up factors from DB
  const [sectorInfo, bmInfo, turnoverBandInfo, resilienceInfo] = await Promise.all([
    getSectorFactorsById(input.sectorId),
    getBusinessModelFactorById(input.businessModelId),
    getTurnoverBandFactorById(input.turnoverBandId),
    getResilienceProfileFactorById(input.resilienceProfileId),
  ]);

  // Look up provider factor from CloudProvider if provided
  let providerFactor = 1.0;
  if (input.cloudProviderId) {
    try {
      const provider = await db.cloudProvider.findUnique({
        where: { id: input.cloudProviderId },
        select: { premiumFactor: true },
      });
      if (provider) {
        providerFactor = Number(provider.premiumFactor);
      }
    } catch {
      // Use default
    }
  }

  // Step 1: Calculate hourly revenue
  const hourlyRevenue = input.annualTurnoverTnd / HOURS_PER_YEAR;

  // Step 2: Get sector sub-factors from hardcoded (or DB-based sector code)
  const sectorCode = sectorInfo.sectorCode;
  const sectorFactors = getSectorFactors(sectorCode);
  const gm = sectorFactors.gm;
  const cd = sectorFactors.cd;
  const cr = sectorFactors.cr;

  // For v3, the DB riskFactor replaces the legacy composite factor
  const bmFactor = bmInfo.riskFactor;
  const resilienceFactor = resilienceInfo.riskFactor;

  // Step 3: Compute pure premium (expected loss)
  const purePremium =
    BASE_FREQUENCY *
    BASE_SEVERITY *
    hourlyRevenue *
    gm *
    cd *
    cr *
    resilienceFactor *
    bmFactor;

  // Step 4: Apply commercial loading
  const commercialPremium = purePremium * LOADING_FACTOR;

  // Step 5: Apply provider risk factor
  const finalPremium = commercialPremium * providerFactor;

  // Step 6: Calculate premium rate (as % of turnover)
  const premiumRatePct = input.annualTurnoverTnd > 0
    ? (finalPremium / input.annualTurnoverTnd) * 100
    : 0;

  // Additional calculations
  const payoutPerHour = calculatePayoutPerHour(hourlyRevenue, gm, cd, cr, resilienceFactor, bmFactor);
  const maxPayoutPerEvent = payoutPerHour * MAX_OUTAGE_HOURS;
  const turnoverBand = findTurnoverBand(input.annualTurnoverTnd);

  // Step 7: Underwriting decision (dynamic thresholds)
  let underwritingDecision = 'DECLINE';
  let underwritingReason = 'Validation errors prevent calculation';
  const validationErrors: string[] = [];

  if (input.annualTurnoverTnd < MIN_TURNOVER_TND) {
    validationErrors.push(`Annual turnover must be at least ${MIN_TURNOVER_TND.toLocaleString()} TND`);
  }
  if (input.annualTurnoverTnd > MAX_TURNOVER_TND) {
    validationErrors.push(`Annual turnover exceeds ${MAX_TURNOVER_TND.toLocaleString()} TND — out of SME scope`);
  }

  if (validationErrors.length === 0) {
    const uw = await determineUnderwritingDecision(premiumRatePct);
    underwritingDecision = uw.decision;
    underwritingReason = uw.reason;
  }

  return {
    hourlyRevenue: round4(hourlyRevenue),
    gm,
    cd,
    cr,
    bmFactor,
    resilienceFactor,
    providerFactor,
    purePremium: round2(purePremium),
    commercialPremium: round2(commercialPremium),
    finalPremium: round2(finalPremium),
    premiumRatePct: round4(premiumRatePct),
    payoutPerHour: round4(payoutPerHour),
    maxPayoutPerEvent: round2(maxPayoutPerEvent),
    turnoverBand: turnoverBand.label,
    underwritingDecision,
    underwritingReason,
    validationErrors,
    // Snapshot factors for DB storage
    sectorFactorAtCreation: sectorInfo.riskFactor,
    businessModelFactorAtCreation: bmInfo.riskFactor,
    turnoverBandFactorAtCreation: turnoverBandInfo.riskFactor,
    resilienceFactorAtCreation: resilienceInfo.riskFactor,
    providerFactorAtCreation: providerFactor,
  };
}

// ==================== LEGACY COMPATIBILITY FUNCTIONS ====================
// These are kept for backward compatibility with existing code

export function calculateHourlyRevenue(annualTurnoverTnd: number): number {
  return annualTurnoverTnd / HOURS_PER_YEAR;
}

export function calculateExpectedLoss(
  annualTurnoverTnd: number,
  grossMargin: number,
  cloudDependency: number,
  criticality: number,
  resilience: number
): number {
  const hourlyRevenue = calculateHourlyRevenue(annualTurnoverTnd);
  return BASE_FREQUENCY * BASE_SEVERITY * hourlyRevenue * grossMargin * cloudDependency * criticality * resilience;
}

export function calculateCommercialPremium(
  annualTurnoverTnd: number,
  grossMargin: number,
  cloudDependency: number,
  criticality: number,
  resilience: number
): number {
  const expectedLoss = calculateExpectedLoss(annualTurnoverTnd, grossMargin, cloudDependency, criticality, resilience);
  return expectedLoss * LOADING_FACTOR;
}

export function calculatePremiumRatePct(
  annualTurnoverTnd: number,
  commercialPremium: number
): number {
  if (annualTurnoverTnd === 0) return 0;
  return (commercialPremium / annualTurnoverTnd) * 100;
}

export function calculateInsuredHours(durationHours: number, mttrHours: number): number {
  const capped = Math.min(durationHours, MAX_OUTAGE_HOURS);
  return Math.max(0, capped - mttrHours);
}

// ==================== ROUNDING HELPERS ====================

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// ==================== SEQUENCE NUMBER GENERATION ====================

/**
 * Generate the next policy number using the sequence_registry.
 * Format: {prefix}{YEAR}{padding} e.g., PAR-2026-000001
 */
export async function generatePolicyNumber(): Promise<string> {
  const sequenceName = 'parametric_policy';
  const currentYear = new Date().getFullYear();

  const sequence = await db.sequenceRegistry.upsert({
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

  // Check if year reset is needed
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

/**
 * Generate the next claim number using the sequence_registry.
 * Format: {prefix}{YEAR}{padding} e.g., PCL-2026-000001
 */
async function generateClaimNumber(): Promise<string> {
  const sequenceName = 'parametric_claim';
  const currentYear = new Date().getFullYear();

  const sequence = await db.sequenceRegistry.upsert({
    where: { sequenceName },
    create: {
      sequenceName,
      currentValue: 1,
      prefix: 'PCL',
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

// ==================== PROCESSING PIPELINE ====================

interface RawEvent {
  startTs: number;
  endTs: number;
  durationSeconds: number;
  durationHours: number;
  datasource: string;
  score: number;
}

/**
 * Step 1: Cap individual event durations at MAX_OUTAGE_HOURS
 */
function capEventDurations(events: RawEvent[]): RawEvent[] {
  return events.map((e) => {
    const cappedHours = Math.min(e.durationHours, MAX_OUTAGE_HOURS);
    const cappedSeconds = cappedHours * 3600;
    return {
      ...e,
      durationHours: cappedHours,
      durationSeconds: cappedSeconds,
    };
  });
}

/**
 * Step 2: Merge events within MERGE_GAP_HOURS gap
 */
function mergeEvents(events: RawEvent[]): RawEvent[] {
  if (events.length === 0) return [];

  const sorted = [...events].sort((a, b) => a.startTs - b.startTs);
  const merged: RawEvent[] = [];
  let current = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const gapHours = (sorted[i].startTs - current.endTs) / (3600 * 1000);

    if (gapHours <= MERGE_GAP_HOURS) {
      current.endTs = Math.max(current.endTs, sorted[i].endTs);
      current.durationSeconds = Math.round((current.endTs - current.startTs) / 1000);
      current.durationHours = current.durationSeconds / 3600;
      current.score = Math.max(current.score, sorted[i].score);
    } else {
      merged.push(current);
      current = { ...sorted[i] };
    }
  }
  merged.push(current);

  return merged;
}

/**
 * Step 3: SLA-Strict trigger check - insured hours > 0
 */
function shouldTrigger(durationHours: number, mttrHours: number): boolean {
  return calculateInsuredHours(durationHours, mttrHours) > 0;
}

/**
 * Main processing pipeline for a single provider (v3 schema).
 * Uses CloudProvider.slaTierId instead of string slaTier.
 * Creates OutageEvent records with new fields (iodaEventId, severity, etc.).
 * Creates TriggerEvent with slaTierId FK.
 * Creates ParametricClaim with statusId FK, claimNumber, payoutCalculationJson.
 */
export async function processProvider(providerId: number): Promise<{ triggers: number; claims: number }> {
  const provider = await db.cloudProvider.findUnique({
    where: { id: providerId },
    include: { slaTier: true },
  });

  if (!provider || !provider.isActive) {
    return { triggers: 0, claims: 0 };
  }

  // Get MTTR from the SLA tier relation or fallback
  const mttr = Number(provider.slaTier?.mttrHours) || MTTR_BY_TIER[provider.slaTier?.tierCode || 'Bronze'] || MTTR_BY_TIER.Bronze;

  // Fetch recent outages from IODA - use 30 day window for comprehensive coverage
  let rawIodaEvents: RawEvent[] = [];
  try {
    const iodaEvents = await fetchRecentForProvider(Number(provider.asn), 720);
    rawIodaEvents = iodaEvents.map((e) => ({
      startTs: e.startTs,
      endTs: e.endTs,
      durationSeconds: e.durationSeconds,
      durationHours: e.durationHours,
      datasource: e.datasource,
      score: e.score,
    }));
  } catch (error) {
    // IODA fetch failed, will use empty events list
  }

  // Step 0: Store raw events in DB
  for (const raw of rawIodaEvents) {
    try {
      // Check for existing event by provider + eventStart to dedup
      const existing = await db.outageEvent.findFirst({
        where: {
          cloudProviderId: provider.id,
          eventStart: new Date(raw.startTs),
        },
      });

      if (existing) {
        // Update score if changed
        await db.outageEvent.update({
          where: { id: existing.id },
          data: {
            score: raw.score,
            durationSeconds: Math.round(raw.durationSeconds),
            durationHours: raw.durationHours,
            eventEnd: new Date(raw.endTs),
          },
        });
      } else {
        await db.outageEvent.create({
          data: {
            cloudProviderId: provider.id,
            eventStart: new Date(raw.startTs),
            eventEnd: new Date(raw.endTs),
            durationSeconds: Math.round(raw.durationSeconds),
            durationHours: raw.durationHours,
            datasource: raw.datasource,
            score: raw.score,
            severity: raw.score > 80 ? 'CRITICAL' : raw.score > 50 ? 'HIGH' : raw.score > 20 ? 'MEDIUM' : 'LOW',
            processed: 0,
          },
        });
      }
    } catch {
      // Skip duplicates or errors
    }
  }

  // Get unprocessed events from DB
  const unprocessedEvents = await db.outageEvent.findMany({
    where: { cloudProviderId: provider.id, processed: 0 },
    orderBy: { eventStart: 'asc' },
  });

  if (unprocessedEvents.length === 0) {
    return { triggers: 0, claims: 0 };
  }

  const rawEvents: RawEvent[] = unprocessedEvents.map((e) => ({
    startTs: e.eventStart.getTime(),
    endTs: (e.eventEnd || new Date()).getTime(),
    durationSeconds: e.durationSeconds || 0,
    durationHours: Number(e.durationHours || 0),
    datasource: e.datasource,
    score: Number(e.score || 0),
  }));

  // Pipeline Step 1: Cap durations
  const capped = capEventDurations(rawEvents);

  // Pipeline Step 2: Merge events
  const merged = mergeEvents(capped);

  let triggerCount = 0;
  let claimCount = 0;

  // Look up the "DETECTED" claim status ID
  let detectedStatusId: number | null = null;
  try {
    const detectedStatus = await db.enumParamClaimStatus.findFirst({
      where: { statusCode: 'DETECTED', isCurrent: 1 },
      select: { id: true },
    });
    detectedStatusId = detectedStatus?.id ?? null;
  } catch {
    // Will create claims without statusId if enum not found
  }

  // Look up "APPROVED" policy status ID for finding active policies
  let approvedStatusId: number | null = null;
  try {
    const approvedStatus = await db.enumParamPolicyStatus.findFirst({
      where: { statusCode: 'APPROVED', isCurrent: 1 },
      select: { id: true },
    });
    approvedStatusId = approvedStatus?.id ?? null;
  } catch {
    // Will not filter by status if enum not found
  }

  // Process each merged event
  for (const me of merged) {
    const nRawEvents = rawEvents.filter(
      (r) => r.startTs >= me.startTs && r.endTs <= me.endTs
    ).length;

    // Collect the raw event IDs that are part of this merged incident
    const incidentEventIds = unprocessedEvents
      .filter((e) => e.eventStart.getTime() >= me.startTs && (e.eventEnd || new Date()).getTime() <= me.endTs)
      .map((e) => e.id);

    const mergedIncident = await db.mergedIncident.create({
      data: {
        cloudProviderId: provider.id,
        incidentStart: new Date(me.startTs),
        incidentEnd: new Date(me.endTs),
        durationSeconds: Math.round(me.durationSeconds),
        durationHours: me.durationHours,
        nRawEvents,
        maxScore: me.score,
        isTriggerChecked: 0,
      },
    });

    // Create incident-event links
    for (const eventId of incidentEventIds) {
      await db.incidentEventLink.create({
        data: {
          incidentId: mergedIncident.id,
          eventId,
        },
      });
    }

    // Step 3: Check trigger
    if (shouldTrigger(me.durationHours, mttr)) {
      const insuredHours = calculateInsuredHours(me.durationHours, mttr);

      // Get threshold from SLA tier
      const thresholdHours = Number(provider.slaTier?.thresholdHours) || mttr;

      const trigger = await db.triggerEvent.create({
        data: {
          cloudProviderId: provider.id,
          mergedIncidentId: mergedIncident.id,
          slaTierId: provider.slaTierId,
          insuredHours,
          thresholdHours,
          claimCreated: 0,
          adminReviewed: 0,
        },
      });

      triggerCount++;

      // Step 4: Auto-create claims for all active policies
      const whereClause: Record<string, unknown> = {
        cloudProviderId: provider.id,
        isDeleted: 0,
      };

      if (approvedStatusId !== null) {
        whereClause.statusId = approvedStatusId;
      }

      const activePolicies = await db.parametricPolicy.findMany({
        where: whereClause,
      });

      for (const policy of activePolicies) {
        const hourlyPayoutRate = Number(policy.hourlyPayoutRate);
        if (hourlyPayoutRate > 0) {
          const payoutAmount = hourlyPayoutRate * insuredHours;

          // Build payout calculation JSON
          const payoutCalculation = {
            policyId: policy.id,
            policyNumber: policy.policyNumber,
            triggerEventId: trigger.id,
            insuredHours,
            outageDurationHours: me.durationHours,
            mttrHours: mttr,
            hourlyPayoutRate,
            payoutAmount,
            calculationTimestamp: new Date().toISOString(),
            calculationMethod: 'parametric_auto',
          };

          const claimNumber = await generateClaimNumber();

          await db.parametricClaim.create({
            data: {
              claimNumber,
              customerId: policy.customerId,
              policyId: policy.id,
              triggerEventId: trigger.id,
              outageDurationHours: me.durationHours,
              hourlyPayoutRate,
              payoutAmount,
              payoutCalculationJson: JSON.stringify(payoutCalculation),
              statusId: detectedStatusId,
              autoApproved: 1,
              autoApprovedAt: new Date(),
            },
          });

          claimCount++;
        }
      }

      // Mark trigger as having claims created
      if (claimCount > 0) {
        await db.triggerEvent.update({
          where: { id: trigger.id },
          data: {
            claimCreated: 1,
            claimsCreatedAt: new Date(),
            affectedPoliciesCount: activePolicies.length,
            totalEstimatedPayout: activePolicies.reduce((sum, p) => sum + Number(p.hourlyPayoutRate) * insuredHours, 0),
          },
        });
      }
    }

    // Mark incident as trigger checked
    await db.mergedIncident.update({
      where: { id: mergedIncident.id },
      data: {
        isTriggerChecked: 1,
        triggerCheckedAt: new Date(),
      },
    });
  }

  // Mark all unprocessed events as processed
  await db.outageEvent.updateMany({
    where: { cloudProviderId: provider.id, processed: 0 },
    data: {
      processed: 1,
      processedAt: new Date(),
    },
  });

  return { triggers: triggerCount, claims: claimCount };
}

/**
 * Dispute a claim - admin overrides auto-approval.
 * Updates status using enum FK and sets admin override fields.
 */
export async function disputeClaim(claimId: number, adminOverrideReason: string): Promise<void> {
  // Look up "DISPUTED" status
  const disputedStatus = await db.enumParamClaimStatus.findFirst({
    where: { statusCode: 'DISPUTED', isCurrent: 1 },
    select: { id: true },
  });

  await db.parametricClaim.update({
    where: { id: claimId },
    data: {
      statusId: disputedStatus?.id ?? null,
      adminOverride: 1,
      adminOverrideReason,
      adminOverrideAt: new Date(),
    },
  });
}

/**
 * Manually approve a claim.
 * Updates status using enum FK.
 */
export async function manuallyApproveClaim(claimId: number): Promise<void> {
  // Look up "APPROVED" status
  const approvedStatus = await db.enumParamClaimStatus.findFirst({
    where: { statusCode: 'APPROVED', isCurrent: 1 },
    select: { id: true },
  });

  await db.parametricClaim.update({
    where: { id: claimId },
    data: {
      statusId: approvedStatus?.id ?? null,
      adminOverride: 1,
      adminOverrideAt: new Date(),
    },
  });
}

// ==================== POLICY CREATION HELPER (v3) ====================

/**
 * Create a ParametricPolicy from v3 pricing input and breakdown.
 * Auto-generates policyNumber, stores snapshot factors, and sets status.
 */
export async function createParametricPolicyV3(
  input: PricingInputV3,
  breakdown: PricingBreakdownV3,
  options?: {
    createdBy?: number;
    payoutFunctionConfigId?: number;
    effectiveDate?: Date;
  }
) {
  const policyNumber = await generatePolicyNumber();

  // Look up "PENDING" status for new policies
  let pendingStatusId: number | null = null;
  try {
    const pendingStatus = await db.enumParamPolicyStatus.findFirst({
      where: { statusCode: 'PENDING', isCurrent: 1 },
      select: { id: true },
    });
    pendingStatusId = pendingStatus?.id ?? null;
  } catch {
    // Will create without statusId if enum not found
  }

  const hourlyRevenue = input.annualTurnoverTnd / HOURS_PER_YEAR;

  return db.parametricPolicy.create({
    data: {
      policyNumber,
      customerId: 0, // Must be set by caller or use a different path
      cloudProviderId: input.cloudProviderId ?? 0,
      productId: 0, // Must be set by caller
      sectorId: input.sectorId,
      businessModelId: input.businessModelId,
      turnoverBandId: input.turnoverBandId,
      resilienceProfileId: input.resilienceProfileId,
      annualTurnoverTnd: input.annualTurnoverTnd,
      hourlyRevenue,
      basePremium: breakdown.purePremium,
      commercialPremium: breakdown.commercialPremium,
      providerAdjustedPremium: breakdown.commercialPremium * breakdown.providerFactor,
      finalPremium: breakdown.finalPremium,
      premiumRatePct: breakdown.premiumRatePct,
      maxInsuredHours: MAX_OUTAGE_HOURS,
      hourlyPayoutRate: breakdown.payoutPerHour,
      maxPayoutAmount: breakdown.maxPayoutPerEvent,
      payoutFunctionConfigId: options?.payoutFunctionConfigId ?? null,
      sectorFactorAtCreation: breakdown.sectorFactorAtCreation,
      businessModelFactorAtCreation: breakdown.businessModelFactorAtCreation,
      turnoverBandFactorAtCreation: breakdown.turnoverBandFactorAtCreation,
      resilienceFactorAtCreation: breakdown.resilienceFactorAtCreation,
      providerFactorAtCreation: breakdown.providerFactorAtCreation,
      loadingFactorAtCreation: LOADING_FACTOR,
      underwritingDecision: breakdown.underwritingDecision,
      underwritingNotes: breakdown.underwritingReason,
      statusId: pendingStatusId,
      effectiveDate: options?.effectiveDate ?? null,
      createdBy: options?.createdBy ?? null,
    },
  });
}

