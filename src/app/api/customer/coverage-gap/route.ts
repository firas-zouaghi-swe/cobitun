import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthInfo } from '@/lib/services/auth-helper';

interface CoverageScenario {
  scenario: string;
  trigger: string;
  parametricResponse: string;
  cyberResponse: string;
  gap: boolean;
  gapDescription: string;
  recommendation: string;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthInfo(request);
    if (!auth) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const asn = searchParams.get('asn');
    const sectorId = searchParams.get('sectorId');
    const mttrTier = searchParams.get('mttrTier');

    // Derive hasParametric and hasCyber from the authenticated user's actual policies
    let hasParametric = false;
    let hasCyber = false;
    if (auth.role === 'ADMIN') {
      // Admins can use query params for demonstration purposes
      hasParametric = searchParams.get('hasParametric') === 'true';
      hasCyber = searchParams.get('hasCyber') === 'true';
    } else {
      const customer = await db.customer.findUnique({
        where: { userId: auth.userIdNum },
        select: { id: true },
      });
      if (customer) {
        const parametricCount = await db.parametricPolicy.count({
          where: { customerId: customer.id, isDeleted: 0, status: { statusCode: { in: ['ACTIVE', 'PENDING'] } } },
        });
        const cyberCount = await db.cyberPolicy.count({
          where: { customerId: customer.id, isDeleted: 0, status: { statusCode: { in: ['ACTIVE', 'PENDING'] } } },
        });
        hasParametric = parametricCount > 0;
        hasCyber = cyberCount > 0;
      }
    }

    // v3: Look up cloud provider MTTR via slaTierId if ASN provided
    let mttrHours = 16.0; // default
    let slaTierName = 'Bronze';
    if (asn) {
      const provider = await db.cloudProvider.findUnique({
        where: { asn },
        include: { slaTier: { select: { tierCode: true, tierName: true, mttrHours: true, thresholdHours: true } } },
      });
      if (provider) {
        mttrHours = Number(provider.slaTier?.mttrHours || provider.mttrHours);
        slaTierName = provider.slaTier?.tierCode || 'Bronze';
      }
    }

    // If mttrTier provided, override with tier defaults
    const mttrTierDefaults: Record<string, number> = {
      Bronze: 16.0,
      Silver: 8.0,
      Gold: 4.0,
      Platinum: 2.0,
    };
    if (mttrTier && mttrTierDefaults[mttrTier]) {
      mttrHours = mttrTierDefaults[mttrTier];
      slaTierName = mttrTier;
    }

    // v3: Look up sector name from ref_sector if sectorId provided
    let sectorName = 'Other';
    if (sectorId) {
      const sector = await db.refSector.findFirst({
        where: { id: parseInt(sectorId, 10), isCurrent: 1 },
        select: { sectorName: true },
      });
      if (sector) sectorName = sector.sectorName;
    }

    // Get active products for reference
    const products = await db.product.findMany({
      where: { isActive: 1, isDeleted: 0 },
      include: {
        coverageGrants: { where: { isActive: 1, isDeleted: 0 } },
        exclusions: { where: { isActive: 1, isDeleted: 0 } },
        productType: { select: { typeCode: true } },
      },
    });

    const parametricProduct = products.find((p) => p.productType.typeCode === 'PARAMETRIC');
    const cyberProduct = products.find((p) => p.productType.typeCode === 'INDEMNITY');

    // Build coverage matrix
    const scenarios: CoverageScenario[] = [
      {
        scenario: 'Cloud/ISP Outage < MTTR',
        trigger: `Outage duration < ${mttrHours}h (MTTR threshold)`,
        parametricResponse: hasParametric ? 'Not covered — below MTTR trigger' : 'N/A (no parametric policy)',
        cyberResponse: hasCyber ? 'Not covered — no direct cyber peril' : 'N/A (no cyber policy)',
        gap: true,
        gapDescription: 'Short outages below MTTR trigger are not covered by either product',
        recommendation: 'Accept as operational risk, or negotiate lower MTTR trigger with parametric insurer (increases premium)',
      },
      {
        scenario: 'Cloud/ISP Outage >= MTTR',
        trigger: `Outage duration >= ${mttrHours}h (MTTR threshold)`,
        parametricResponse: hasParametric ? 'Covered — parametric payout triggered automatically' : 'N/A (no parametric policy)',
        cyberResponse: hasCyber ? 'Not covered — infrastructure failure typically excluded' : 'N/A (no cyber policy)',
        gap: !hasParametric,
        gapDescription: hasParametric
          ? 'Parametric product fills this gap with automatic payout'
          : 'No parametric coverage — significant gap for cloud/ISP outages',
        recommendation: hasParametric
          ? 'Coverage is adequate. Consider reviewing payout per hour sufficiency.'
          : 'Strongly recommend purchasing parametric cloud outage insurance to cover this gap',
      },
      {
        scenario: 'Cyber Attack (Ransomware)',
        trigger: 'Ransomware encryption, system compromise',
        parametricResponse: hasParametric ? 'Not covered — not an outage event' : 'N/A (no parametric policy)',
        cyberResponse: hasCyber ? 'Covered — BI (Business Interruption), DR (Data Recovery), CE (Crisis Expenses), SR (System Recovery)' : 'N/A (no cyber policy)',
        gap: !hasCyber,
        gapDescription: hasCyber
          ? 'Cyber indemnity covers business interruption, data recovery, crisis expenses, and system recovery'
          : 'No cyber coverage — ransomware attacks would be entirely uninsured',
        recommendation: hasCyber
          ? 'Ensure policy limits adequately cover potential ransomware losses'
          : 'Strongly recommend purchasing cyber indemnity insurance to cover ransomware scenarios',
      },
      {
        scenario: 'Data Breach',
        trigger: 'Unauthorized access to personal/sensitive data',
        parametricResponse: hasParametric ? 'Not covered — not an outage event' : 'N/A (no parametric policy)',
        cyberResponse: hasCyber ? 'Covered — PL (Privacy Liability), CM (Crisis Management), RD (Regulatory Defense)' : 'N/A (no cyber policy)',
        gap: !hasCyber,
        gapDescription: hasCyber
          ? 'Cyber indemnity covers privacy liability, crisis management, and regulatory defense'
          : 'No cyber coverage — data breach costs (notification, legal, fines) would be uninsured',
        recommendation: hasCyber
          ? 'Review PL sub-limits against potential GDPR/privacy regulation fines'
          : 'Strongly recommend purchasing cyber indemnity insurance to cover data breach scenarios',
      },
      {
        scenario: 'Social Engineering',
        trigger: 'Phishing, BEC, funds transfer fraud',
        parametricResponse: hasParametric ? 'Not covered — not an outage event' : 'N/A (no parametric policy)',
        cyberResponse: hasCyber ? 'Covered if SE (Social Engineering) endorsement is active' : 'N/A (no cyber policy)',
        gap: true,
        gapDescription: hasCyber
          ? 'Only covered if SE endorsement is included — check policy endorsements'
          : 'No cyber coverage — social engineering losses would be uninsured',
        recommendation: hasCyber
          ? 'Verify SE endorsement is included in your cyber policy; if not, request it as an add-on'
          : 'Recommend purchasing cyber indemnity with SE endorsement to cover social engineering losses',
      },
      {
        scenario: 'Upstream Provider Failure',
        trigger: 'Critical SaaS/PaaS provider goes down',
        parametricResponse: hasParametric ? 'Partially covered — only if provider ASN is insured' : 'N/A (no parametric policy)',
        cyberResponse: hasCyber ? 'Likely excluded — upstream/infrastructure failure typically in exclusions' : 'N/A (no cyber policy)',
        gap: true,
        gapDescription: 'Upstream provider failures represent a gap — cyber excludes infrastructure, parametric only covers specific ASN',
        recommendation: 'Add additional ASN to parametric policy for critical upstream providers; negotiate dependent business interruption extension with cyber insurer',
      },
      {
        scenario: 'War / State-Sponsored Attack',
        trigger: 'Nation-state cyber attack, act of war',
        parametricResponse: hasParametric ? 'Excluded — war/force majeure exclusions apply' : 'N/A (no parametric policy)',
        cyberResponse: hasCyber ? 'Excluded — WAR_AND_STATE_SPONSORED exclusion applies' : 'N/A (no cyber policy)',
        gap: true,
        gapDescription: 'War and state-sponsored attacks are excluded from both products — no insurance coverage available',
        recommendation: 'This is a systemic risk that is uninsurable in the current market. Focus on resilience and recovery planning. Monitor regulatory developments for potential government backstop programs.',
      },
    ];

    // Calculate overall coverage score
    const coveredCount = scenarios.filter((s) => !s.gap).length;
    const totalScenarios = scenarios.length;
    const coverageScore = Math.round((coveredCount / totalScenarios) * 100);

    // Generate summary
    const summary = {
      customerProfile: {
        asn: asn ? parseInt(asn) : null,
        sectorId: sectorId ? parseInt(sectorId) : null,
        sectorName,
        mttrTier: mttrTier || slaTierName,
        mttrHours,
        hasParametric,
        hasCyber,
      },
      coverageScore,
      totalScenarios,
      coveredScenarios: coveredCount,
      gapScenarios: totalScenarios - coveredCount,
      parametricProduct: parametricProduct
        ? {
            id: parametricProduct.id,
            productCode: parametricProduct.productCode,
            productName: parametricProduct.productName,
          }
        : null,
      cyberProduct: cyberProduct
        ? {
            id: cyberProduct.id,
            productCode: cyberProduct.productCode,
            productName: cyberProduct.productName,
            // v3: CoverageGrant has coverageCode, coverageName
            coverages: cyberProduct.coverageGrants.map((cg) => ({
              code: cg.coverageCode,
              name: cg.coverageName,
            })),
            exclusions: cyberProduct.exclusions.map((e) => e.exclusionCode),
          }
        : null,
    };

    // Generate recommendations summary
    const criticalGaps = scenarios.filter((s) => s.gap && !s.recommendation.includes('adequate'));
    const recommendations = criticalGaps.map((s) => ({
      scenario: s.scenario,
      recommendation: s.recommendation,
    }));

    return NextResponse.json({
      summary,
      scenarios,
      recommendations,
    });
  } catch (error) {
    console.error('Coverage gap analysis error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

