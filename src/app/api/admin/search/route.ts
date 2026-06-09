
/**
 * Advanced Search API
 * GET - Full-text search across policies and claims with filters and export
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { db } from '@/lib/db';
import { Errors } from '@/middleware/validation';
import { logAction } from '@/lib/services/audit-service';

export async function GET(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('q') || '';
    const type = url.searchParams.get('type') || 'all';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const format = url.searchParams.get('format') || 'json';

    // Filters
    const status = url.searchParams.get('status');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const minAmount = url.searchParams.get('minAmount') ? parseFloat(url.searchParams.get('minAmount')!) : undefined;
    const maxAmount = url.searchParams.get('maxAmount') ? parseFloat(url.searchParams.get('maxAmount')!) : undefined;

    const results: { policies?: unknown[]; claims?: unknown[] } = {};
    let total = 0;

    if (type === 'all' || type === 'policies') {
      const policyWhere: Record<string, unknown> = { isDeleted: 0 };

      if (query) {
        policyWhere.OR = [
          { policyNumber: { contains: query } },
          { customer: { companyName: { contains: query } } },
          { cloudProvider: { organisationName: { contains: query } } },
        ];
      }
      if (status) policyWhere.status = { statusCode: status };
      if (startDate || endDate) {
        policyWhere.createdAt = {};
        if (startDate) (policyWhere.createdAt as Record<string, unknown>).gte = new Date(startDate);
        if (endDate) (policyWhere.createdAt as Record<string, unknown>).lte = new Date(endDate);
      }
      if (minAmount !== undefined || maxAmount !== undefined) {
        policyWhere.finalPremium = {};
        if (minAmount !== undefined) (policyWhere.finalPremium as Record<string, unknown>).gte = minAmount;
        if (maxAmount !== undefined) (policyWhere.finalPremium as Record<string, unknown>).lte = maxAmount;
      }

      const [policies, policyCount] = await Promise.all([
        db.parametricPolicy.findMany({
          where: policyWhere,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            status: { select: { statusCode: true, statusName: true } },
            customer: { select: { id: true, companyName: true } },
            cloudProvider: { select: { id: true, organisationName: true } },
          },
        }),
        db.parametricPolicy.count({ where: policyWhere }),
      ]);

      results.policies = policies.map((p) => ({
        id: p.id,
        policyNumber: p.policyNumber,
        status: p.status?.statusCode,
        statusLabel: p.status?.statusName,
        customer: p.customer,
        provider: p.cloudProvider,
        premiumAmount: Number(p.finalPremium || 0),
        startDate: p.effectiveDate?.toISOString(),
        endDate: p.expiryDate?.toISOString(),
        createdAt: p.createdAt?.toISOString(),
      }));
      total += policyCount;
    }

    if (type === 'all' || type === 'claims') {
      const claimWhere: Record<string, unknown> = { isDeleted: 0 };

      if (query) {
        claimWhere.OR = [
          { claimNumber: { contains: query } },
          { customer: { companyName: { contains: query } } },
          { policy: { cloudProvider: { organisationName: { contains: query } } } },
        ];
      }
      if (status) claimWhere.status = { statusCode: status };
      if (startDate || endDate) {
        claimWhere.createdAt = {};
        if (startDate) (claimWhere.createdAt as Record<string, unknown>).gte = new Date(startDate);
        if (endDate) (claimWhere.createdAt as Record<string, unknown>).lte = new Date(endDate);
      }
      if (minAmount !== undefined || maxAmount !== undefined) {
        claimWhere.payoutAmount = {};
        if (minAmount !== undefined) (claimWhere.payoutAmount as Record<string, unknown>).gte = minAmount;
        if (maxAmount !== undefined) (claimWhere.payoutAmount as Record<string, unknown>).lte = maxAmount;
      }

      const [claims, claimCount] = await Promise.all([
        db.parametricClaim.findMany({
          where: claimWhere,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            status: { select: { statusCode: true, statusName: true } },
            customer: { select: { id: true, companyName: true } },
            policy: { select: { id: true, cloudProvider: { select: { id: true, organisationName: true } } } },
          },
        }),
        db.parametricClaim.count({ where: claimWhere }),
      ]);

      results.claims = claims.map((c) => ({
        id: c.id,
        claimNumber: c.claimNumber,
        status: c.status?.statusCode,
        statusLabel: c.status?.statusName,
        customer: c.customer,
        claimAmount: Number(c.payoutAmount || 0),
        payoutAmount: Number(c.payoutAmount || 0),
        providerName: c.policy?.cloudProvider?.organisationName,
        createdAt: c.createdAt?.toISOString(),
      }));
      total += claimCount;
    }

    await logAction({
      entityType: 'SystemSetting',
      entityId: 0,
      action: 'ADVANCED_SEARCH',
      actorId: auth.userIdNum,
      actorType: auth.role,
      metadata: { query, type, filters: { status, startDate, endDate, minAmount, maxAmount } },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    });

    if (format === 'csv') {
      const rows: string[][] = [];
      if (results.policies) {
        rows.push(['Type', 'ID', 'Number', 'Status', 'Customer', 'Amount', 'Created At']);
        for (const p of results.policies as Record<string, unknown>[]) {
          rows.push(['Policy', String(p.id), String(p.policyNumber), String(p.status || ''), String((p.customer as Record<string, unknown>)?.companyName || ''), String(p.premiumAmount), String(p.createdAt || '')]);
        }
      }
      if (results.claims) {
        if (rows.length === 0) rows.push(['Type', 'ID', 'Number', 'Status', 'Customer', 'Amount', 'Created At']);
        for (const c of results.claims as Record<string, unknown>[]) {
          rows.push(['Claim', String(c.id), String(c.claimNumber), String(c.status || ''), String((c.customer as Record<string, unknown>)?.companyName || ''), String(c.claimAmount), String(c.createdAt || '')]);
        }
      }
      const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
      return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="search-results.csv"' } });
    }

    return NextResponse.json({
      query,
      results,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Advanced search failed:', error);
    return Errors.internal();
  }
}

