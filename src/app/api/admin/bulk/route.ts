
/**
 * Bulk Operations API
 * POST - Bulk approve/reject applications, export policies/claims
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { db } from '@/lib/db';
import { Errors, errorResponse, validateRequestBody } from '@/middleware/validation';
import { z } from 'zod';
import { logAction } from '@/lib/services/audit-service';
import { notifyCustomerObject } from '@/lib/services/notification-service';

/**
 * Sanitize a CSV cell value to prevent CSV injection attacks.
 * - Escapes double quotes by doubling them
 * - Prefixes cells starting with =, +, -, @ with a single quote
 * - Wraps in double quotes
 */
function sanitizeCsvCell(value: unknown): string {
  const str = String(value ?? '');
  const escaped = str.replace(/"/g, '""');
  if (/^[=+\-@]/.test(escaped)) {
    return `"${escaped.substring(0, 1)}'${escaped.substring(1)}"`;
  }
  return `"${escaped}"`;
}

const bulkApproveSchema = z.object({
  type: z.enum(['applications', 'claims']),
  ids: z.array(z.number().int().positive()).min(1).max(100),
  notes: z.string().max(1000).optional(),
});

const bulkRejectSchema = z.object({
  type: z.enum(['applications', 'claims']),
  ids: z.array(z.number().int().positive()).min(1).max(100),
  reason: z.string().min(1).max(500),
  notes: z.string().max(1000).optional(),
});

const bulkExportSchema = z.object({
  type: z.enum(['policies', 'claims']),
  format: z.enum(['json', 'csv']).default('json'),
  filters: z.object({
    status: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    minAmount: z.number().optional(),
    maxAmount: z.number().optional(),
  }).optional(),
});

export async function POST(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  try {
    const body = await request.json();
    const action = body.action as string;

    switch (action) {
      case 'approve':
        return await bulkApprove(request, body, auth);
      case 'reject':
        return await bulkReject(request, body, auth);
      case 'export':
        return await bulkExport(request, body, auth);
      default:
        return errorResponse('Invalid action. Use: approve, reject, export', 'INVALID_ACTION', 400);
    }
  } catch (error) {
    console.error('Bulk operation failed:', error);
    return Errors.internal();
  }
}

async function bulkApprove(request: NextRequest, body: Record<string, unknown>, auth: Awaited<ReturnType<typeof getAuthInfo>>) {
  const result = await validateRequestBody(
    new NextRequest(request.url, { body: JSON.stringify(body), method: 'POST' }),
    bulkApproveSchema
  );
  if ('error' in result) return result.error;

  const { type, ids, notes } = result.data;
  const results: { id: number; success: boolean; error?: string }[] = [];

  if (type === 'applications') {
    for (const id of ids) {
      try {
        const app = await db.workflowPolicyApplication.findFirst({ where: { id } });
        if (!app) { results.push({ id, success: false, error: 'Not found' }); continue; }

        const approvedStatus = await db.enumWorkflowAppStatus.findFirst({ where: { statusCode: 'APPROVED' } });
        if (!approvedStatus) { results.push({ id, success: false, error: 'Status not configured' }); continue; }

        await db.workflowPolicyApplication.update({
          where: { id },
          data: { statusId: approvedStatus.id, adminFinalizedBy: auth!.userIdNum, adminFinalSignatureAt: new Date() },
        });

        if (app.customerId) {
          await notifyCustomerObject({
            customerId: app.customerId,
            type: 'policy_update',
            title: 'Application Approved',
            message: `Your policy application has been approved.${notes ? ` Note: ${notes}` : ''}`,
            metadata: { applicationId: id },
          });
        }

        results.push({ id, success: true });
      } catch (error) {
        results.push({ id, success: false, error: (error as Error).message });
      }
    }
  } else if (type === 'claims') {
    for (const id of ids) {
      try {
        const claim = await db.parametricClaim.findFirst({ where: { id, isDeleted: 0 } });
        if (!claim) { results.push({ id, success: false, error: 'Not found' }); continue; }

        const approvedStatus = await db.enumParamClaimStatus.findFirst({ where: { statusCode: 'APPROVED', isCurrent: 1 } });
        if (!approvedStatus) { results.push({ id, success: false, error: 'Status not configured' }); continue; }

        await db.parametricClaim.updateMany({
          where: { id, version: claim.version },
          data: { statusId: approvedStatus.id, updatedAt: new Date() },
        });

        if (claim.customerId) {
          await notifyCustomerObject({
            customerId: claim.customerId,
            type: 'claim_update',
            title: 'Claim Approved',
            message: `Your claim #${claim.claimNumber} has been approved.${notes ? ` Note: ${notes}` : ''}`,
            metadata: { claimId: id },
          });
        }

        results.push({ id, success: true });
      } catch (error) {
        results.push({ id, success: false, error: (error as Error).message });
      }
    }
  }

  await logAction({
    entityType: type === 'applications' ? 'WorkflowPolicyApplication' : 'ParametricClaim',
    entityId: 0,
    action: 'BULK_APPROVE',
    actorId: auth!.userIdNum,
    actorType: auth!.role,
    metadata: { type, ids, notes, results: results.map((r) => ({ id: r.id, success: r.success })) },
    ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
  });

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return NextResponse.json({
    message: `Bulk approve completed: ${succeeded} succeeded, ${failed} failed`,
    results,
    summary: { total: ids.length, succeeded, failed },
  });
}

async function bulkReject(request: NextRequest, body: Record<string, unknown>, auth: Awaited<ReturnType<typeof getAuthInfo>>) {
  const result = await validateRequestBody(
    new NextRequest(request.url, { body: JSON.stringify(body), method: 'POST' }),
    bulkRejectSchema
  );
  if ('error' in result) return result.error;

  const { type, ids, reason, notes } = result.data;
  const results: { id: number; success: boolean; error?: string }[] = [];

  if (type === 'applications') {
    for (const id of ids) {
      try {
        const app = await db.workflowPolicyApplication.findFirst({ where: { id } });
        if (!app) { results.push({ id, success: false, error: 'Not found' }); continue; }

        const rejectedStatus = await db.enumWorkflowAppStatus.findFirst({ where: { statusCode: 'REJECTED' } });
        if (!rejectedStatus) { results.push({ id, success: false, error: 'Status not configured' }); continue; }

        await db.workflowPolicyApplication.update({
          where: { id },
          data: { statusId: rejectedStatus.id, rejectedBy: auth!.userIdNum, rejectedAt: new Date(), rejectionReason: reason },
        });

        if (app.customerId) {
          await notifyCustomerObject({
            customerId: app.customerId,
            type: 'policy_update',
            title: 'Application Rejected',
            message: `Your policy application has been rejected. Reason: ${reason}`,
            metadata: { applicationId: id, reason },
          });
        }

        results.push({ id, success: true });
      } catch (error) {
        results.push({ id, success: false, error: (error as Error).message });
      }
    }
  } else if (type === 'claims') {
    for (const id of ids) {
      try {
        const claim = await db.parametricClaim.findFirst({ where: { id, isDeleted: 0 } });
        if (!claim) { results.push({ id, success: false, error: 'Not found' }); continue; }

        const rejectedStatus = await db.enumParamClaimStatus.findFirst({ where: { statusCode: 'REJECTED', isCurrent: 1 } });
        if (!rejectedStatus) { results.push({ id, success: false, error: 'Status not configured' }); continue; }

        await db.parametricClaim.updateMany({
          where: { id, version: claim.version },
          data: { statusId: rejectedStatus.id, reviewNotes: reason, updatedAt: new Date() },
        });

        if (claim.customerId) {
          await notifyCustomerObject({
            customerId: claim.customerId,
            type: 'warning',
            title: 'Claim Rejected',
            message: `Your claim #${claim.claimNumber} has been rejected. Reason: ${reason}`,
            metadata: { claimId: id, reason },
          });
        }

        results.push({ id, success: true });
      } catch (error) {
        results.push({ id, success: false, error: (error as Error).message });
      }
    }
  }

  await logAction({
    entityType: type === 'applications' ? 'WorkflowPolicyApplication' : 'ParametricClaim',
    entityId: 0,
    action: 'BULK_REJECT',
    actorId: auth!.userIdNum,
    actorType: auth!.role,
    metadata: { type, ids, reason, results: results.map((r) => ({ id: r.id, success: r.success })) },
    ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
  });

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return NextResponse.json({
    message: `Bulk reject completed: ${succeeded} succeeded, ${failed} failed`,
    results,
    summary: { total: ids.length, succeeded, failed },
  });
}

async function bulkExport(request: NextRequest, body: Record<string, unknown>, auth: Awaited<ReturnType<typeof getAuthInfo>>) {
  const result = await validateRequestBody(
    new NextRequest(request.url, { body: JSON.stringify(body), method: 'POST' }),
    bulkExportSchema
  );
  if ('error' in result) return result.error;

  const { type, format, filters } = result.data;

  const where: Record<string, unknown> = { isDeleted: 0 };
  if (filters?.status) where.status = { statusCode: filters.status };
  if (filters?.startDate || filters?.endDate) {
    where.createdAt = {};
    if (filters.startDate) (where.createdAt as Record<string, unknown>).gte = new Date(filters.startDate);
    if (filters.endDate) (where.createdAt as Record<string, unknown>).lte = new Date(filters.endDate);
  }

  if (type === 'policies') {
    const policies = await db.parametricPolicy.findMany({
      where,
      include: {
        status: { select: { statusCode: true } },
        customer: { select: { companyName: true } },
        cloudProvider: { select: { organisationName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    const exportData = policies.map((p) => ({
      id: p.id,
      policyNumber: p.policyNumber,
      status: p.status?.statusCode,
      customer: p.customer?.companyName,
      provider: p.cloudProvider?.organisationName,
      premiumAmount: Number(p.finalPremium || 0),
      startDate: p.effectiveDate?.toISOString(),
      endDate: p.expiryDate?.toISOString(),
      createdAt: p.createdAt?.toISOString(),
    }));

    if (format === 'csv') {
      const headers = ['ID', 'Policy Number', 'Status', 'Customer', 'Provider', 'Premium', 'Start Date', 'End Date', 'Created At'];
      const rows = exportData.map((p) => [p.id, p.policyNumber, p.status, p.customer, p.provider, p.premiumAmount, p.startDate, p.endDate, p.createdAt]);
      const csv = [headers, ...rows].map((r) => r.map((c) => sanitizeCsvCell(c)).join(',')).join('\n');
      return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="policies-export.csv"' } });
    }

    return NextResponse.json({ policies: exportData, total: exportData.length });
  } else {
    const claims = await db.parametricClaim.findMany({
      where,
      include: {
        status: { select: { statusCode: true } },
        customer: { select: { companyName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    const exportData = claims.map((c) => ({
      id: c.id,
      claimNumber: c.claimNumber,
      status: c.status?.statusCode,
      customer: c.customer?.companyName,
      claimAmount: Number(c.payoutAmount || 0),
      payoutAmount: Number(c.payoutAmount || 0),
      createdAt: c.createdAt?.toISOString(),
    }));

    if (format === 'csv') {
      const headers = ['ID', 'Claim Number', 'Status', 'Customer', 'Claim Amount', 'Payout Amount', 'Created At'];
      const rows = exportData.map((c) => [c.id, c.claimNumber, c.status, c.customer, c.claimAmount, c.payoutAmount, c.createdAt]);
      const csv = [headers, ...rows].map((r) => r.map((c) => sanitizeCsvCell(c)).join(',')).join('\n');
      return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="claims-export.csv"' } });
    }

    return NextResponse.json({ claims: exportData, total: exportData.length });
  }
}

