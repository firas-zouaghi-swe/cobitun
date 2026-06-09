
/**
 * Financial Reporting API
 * GET - Generate financial reports (premium revenue, claims paid, loss ratio, combined ratio)
 * Supports CSV and PDF export
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { db } from '@/lib/db';
import { Errors } from '@/middleware/validation';
import { logAction } from '@/lib/services/audit-service';
import { Decimal } from '@prisma/client/runtime/library';

export async function GET(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  try {
    const url = new URL(request.url);
    const reportType = url.searchParams.get('type') || 'summary';
    const startDate = url.searchParams.get('startDate') ? new Date(url.searchParams.get('startDate')!) : new Date(new Date().getFullYear(), 0, 1);
    const endDate = url.searchParams.get('endDate') ? new Date(url.searchParams.get('endDate')!) : new Date();
    const format = url.searchParams.get('format') || 'json';

    let reportData: Record<string, unknown>;

    switch (reportType) {
      case 'premium_revenue':
        reportData = await generatePremiumRevenueReport(startDate, endDate);
        break;
      case 'claims_paid':
        reportData = await generateClaimsPaidReport(startDate, endDate);
        break;
      case 'loss_ratio':
        reportData = await generateLossRatioReport(startDate, endDate);
        break;
      case 'combined_ratio':
        reportData = await generateCombinedRatioReport(startDate, endDate);
        break;
      case 'summary':
      default:
        reportData = await generateSummaryReport(startDate, endDate);
        break;
    }

    await logAction({
      entityType: 'SystemSetting',
      entityId: 0,
      action: 'GENERATE_FINANCIAL_REPORT',
      actorId: auth.userIdNum,
      actorType: auth.role,
      metadata: { reportType, startDate: startDate.toISOString(), endDate: endDate.toISOString(), format },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    });

    if (format === 'csv') {
      return returnAsCSV(reportData, reportType);
    }

    return NextResponse.json({
      reportType,
      period: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
      generatedAt: new Date().toISOString(),
      data: reportData,
    });
  } catch (error) {
    console.error('Failed to generate financial report:', error);
    return Errors.internal();
  }
}

async function generatePremiumRevenueReport(startDate: Date, endDate: Date) {
  const policies = await db.parametricPolicy.findMany({
    where: {
      isDeleted: 0,
      createdAt: { gte: startDate, lte: endDate },
    },
    include: { status: { select: { statusCode: true } }, customer: { select: { companyName: true } } },
  });

  const totalPremium = policies.reduce((sum, p) => sum + Number(p.finalPremium || 0), 0);
  const activePolicies = policies.filter((p) => p.status?.statusCode === 'ACTIVE');
  const cancelledPolicies = policies.filter((p) => p.status?.statusCode === 'CANCELLED');

  return {
    totalPolicies: policies.length,
    activePolicies: activePolicies.length,
    cancelledPolicies: cancelledPolicies.length,
    totalPremiumRevenue: totalPremium,
    averagePremium: policies.length > 0 ? totalPremium / policies.length : 0,
    policies: policies.map((p) => ({
      policyNumber: p.policyNumber,
      status: p.status?.statusCode,
      premium: Number(p.finalPremium || 0),
      customer: p.customer?.companyName,
      createdAt: p.createdAt?.toISOString(),
    })),
  };
}

async function generateClaimsPaidReport(startDate: Date, endDate: Date) {
  const claims = await db.parametricClaim.findMany({
    where: {
      isDeleted: 0,
      createdAt: { gte: startDate, lte: endDate },
    },
    include: { status: { select: { statusCode: true } }, customer: { select: { companyName: true } } },
  });

  const totalClaimAmount = claims.reduce((sum, c) => sum + Number(c.payoutAmount || 0), 0);
  const paidClaims = claims.filter((c) => c.status?.statusCode === 'PAID');
  const totalPaidAmount = paidClaims.reduce((sum, c) => sum + Number(c.payoutAmount || 0), 0);

  return {
    totalClaims: claims.length,
    paidClaims: paidClaims.length,
    pendingClaims: claims.filter((c) => ['SUBMITTED', 'UNDER_REVIEW'].includes(c.status?.statusCode || '')).length,
    rejectedClaims: claims.filter((c) => c.status?.statusCode === 'REJECTED').length,
    totalClaimAmount,
    totalPaidAmount,
    averageClaimAmount: claims.length > 0 ? totalClaimAmount / claims.length : 0,
    claims: claims.map((c) => ({
      claimNumber: c.claimNumber,
      status: c.status?.statusCode,
      claimAmount: Number(c.payoutAmount || 0),
      payoutAmount: Number(c.payoutAmount || 0),
      customer: c.customer?.companyName,
      createdAt: c.createdAt?.toISOString(),
    })),
  };
}

async function generateLossRatioReport(startDate: Date, endDate: Date) {
  const [policies, claims] = await Promise.all([
    db.parametricPolicy.findMany({
      where: { isDeleted: 0, createdAt: { gte: startDate, lte: endDate } },
      include: { status: { select: { statusCode: true } } },
    }),
    db.parametricClaim.findMany({
      where: { isDeleted: 0, createdAt: { gte: startDate, lte: endDate } },
      include: { status: { select: { statusCode: true } } },
    }),
  ]);

  const totalEarnedPremium = policies.reduce((sum, p) => sum + Number(p.finalPremium || 0), 0);
  const totalIncurredClaims = claims
    .filter((c) => ['PAID', 'APPROVED'].includes(c.status?.statusCode || ''))
    .reduce((sum, c) => sum + Number(c.payoutAmount || 0), 0);

  const lossRatio = totalEarnedPremium > 0 ? (totalIncurredClaims / totalEarnedPremium) * 100 : 0;

  return {
    totalEarnedPremium,
    totalIncurredClaims,
    lossRatio: Math.round(lossRatio * 100) / 100,
    interpretation: lossRatio < 60 ? 'Excellent' : lossRatio < 80 ? 'Good' : lossRatio < 100 ? 'Warning' : 'Critical',
    monthlyBreakdown: generateMonthlyBreakdown(startDate, endDate, policies, claims),
  };
}

async function generateCombinedRatioReport(startDate: Date, endDate: Date) {
  const [policies, claims] = await Promise.all([
    db.parametricPolicy.findMany({
      where: { isDeleted: 0, createdAt: { gte: startDate, lte: endDate } },
      include: { status: { select: { statusCode: true } } },
    }),
    db.parametricClaim.findMany({
      where: { isDeleted: 0, createdAt: { gte: startDate, lte: endDate } },
      include: { status: { select: { statusCode: true } } },
    }),
  ]);

  const totalEarnedPremium = policies.reduce((sum, p) => sum + Number(p.finalPremium || 0), 0);
  const totalIncurredClaims = claims
    .filter((c) => ['PAID', 'APPROVED'].includes(c.status?.statusCode || ''))
    .reduce((sum, c) => sum + Number(c.payoutAmount || 0), 0);

  // TODO: Replace with actual operating expense tracking from DB
  const OPERATING_EXPENSE_RATIO = 0.20; // Placeholder: 20% of earned premium
  const operatingExpenses = totalEarnedPremium * OPERATING_EXPENSE_RATIO;

  const lossRatio = totalEarnedPremium > 0 ? (totalIncurredClaims / totalEarnedPremium) * 100 : 0;
  const expenseRatio = totalEarnedPremium > 0 ? (operatingExpenses / totalEarnedPremium) * 100 : 0;
  const combinedRatio = lossRatio + expenseRatio;

  return {
    totalEarnedPremium,
    totalIncurredClaims,
    operatingExpenses,
    lossRatio: Math.round(lossRatio * 100) / 100,
    expenseRatio: Math.round(expenseRatio * 100) / 100,
    combinedRatio: Math.round(combinedRatio * 100) / 100,
    profitability: combinedRatio < 100 ? 'Profitable' : 'Unprofitable',
    underwritingProfit: totalEarnedPremium - totalIncurredClaims - operatingExpenses,
  };
}

async function generateSummaryReport(startDate: Date, endDate: Date) {
  const [premiumReport, claimsReport, lossRatioReport] = await Promise.all([
    generatePremiumRevenueReport(startDate, endDate),
    generateClaimsPaidReport(startDate, endDate),
    generateLossRatioReport(startDate, endDate),
  ]);

  return {
    premium: {
      totalRevenue: (premiumReport as Record<string, unknown>).totalPremiumRevenue,
      totalPolicies: (premiumReport as Record<string, unknown>).totalPolicies,
      activePolicies: (premiumReport as Record<string, unknown>).activePolicies,
    },
    claims: {
      totalClaims: (claimsReport as Record<string, unknown>).totalClaims,
      paidClaims: (claimsReport as Record<string, unknown>).paidClaims,
      totalPaidAmount: (claimsReport as Record<string, unknown>).totalPaidAmount,
    },
    ratios: {
      lossRatio: (lossRatioReport as Record<string, unknown>).lossRatio,
      interpretation: (lossRatioReport as Record<string, unknown>).interpretation,
    },
  };
}

function generateMonthlyBreakdown(
  startDate: Date,
  endDate: Date,
  policies: { finalPremium: Decimal; createdAt: Date; status?: { statusCode: string } | null }[],
  claims: { payoutAmount: Decimal; createdAt: Date; status?: { statusCode: string } | null }[]
) {
  const months: Record<string, { premium: number; claims: number }> = {};
  const current = new Date(startDate);

  while (current <= endDate) {
    const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
    months[key] = { premium: 0, claims: 0 };
    current.setMonth(current.getMonth() + 1);
  }

  for (const p of policies) {
    const key = `${p.createdAt.getFullYear()}-${String(p.createdAt.getMonth() + 1).padStart(2, '0')}`;
    if (months[key]) months[key].premium += Number(p.finalPremium || 0);
  }

  for (const c of claims) {
    if (['PAID', 'APPROVED'].includes(c.status?.statusCode || '')) {
      const key = `${c.createdAt.getFullYear()}-${String(c.createdAt.getMonth() + 1).padStart(2, '0')}`;
      if (months[key]) months[key].claims += Number(c.payoutAmount || 0);
    }
  }

  return months;
}

function returnAsCSV(data: Record<string, unknown>, reportType: string): NextResponse {
  // Flatten data for CSV export
  const rows: string[][] = [];

  if (Array.isArray(data.policies)) {
    rows.push(['Policy Number', 'Status', 'Premium', 'Customer', 'Created At']);
    for (const p of data.policies as Record<string, unknown>[]) {
      rows.push([String(p.policyNumber || ''), String(p.status || ''), String(p.premium || ''), String(p.customer || ''), String(p.createdAt || '')]);
    }
  } else if (Array.isArray(data.claims)) {
    rows.push(['Claim Number', 'Status', 'Claim Amount', 'Payout Amount', 'Customer', 'Created At']);
    for (const c of data.claims as Record<string, unknown>[]) {
      rows.push([String(c.claimNumber || ''), String(c.status || ''), String(c.claimAmount || ''), String(c.payoutAmount || ''), String(c.customer || ''), String(c.createdAt || '')]);
    }
  } else {
    rows.push(['Metric', 'Value']);
    for (const [key, value] of Object.entries(data)) {
      if (typeof value !== 'object') rows.push([key, String(value)]);
    }
  }

  const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="cobitun-${reportType}-report-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  });
}

