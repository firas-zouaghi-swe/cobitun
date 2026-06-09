import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, Roles } from '@/lib/services/authorization';

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

/**
 * GET /api/admin/audit-logs
 * Retrieves audit logs with filtering and pagination
 * Query params: 
 * - startDate: ISO date string
 * - endDate: ISO date string
 * - actorId: numeric ID
 * - action: action name or category
 * - entityType: type of entity (User, Policy, Claim, etc.)
 * - entityId: ID of the entity
 * - limit: max results (default 50, max 1000)
 * - offset: pagination offset (default 0)
 */
export async function GET(request: NextRequest) {
  try {
    const authOrResp = await requireRole(request, Roles.ADMIN);
    if ((authOrResp as any).status) return authOrResp as NextResponse;

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const actorId = searchParams.get('actorId');
    const action = searchParams.get('action');
    const actionCategory = searchParams.get('actionCategory');
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');
    let limit = parseInt(searchParams.get('limit') || '50');
    let offset = parseInt(searchParams.get('offset') || '0');

    // Validate pagination parameters
    limit = Math.min(Math.max(limit, 1), 1000); // Between 1 and 1000
    offset = Math.max(offset, 0);

    // Build where clause
    const where: any = {};

    if (startDate) {
      const start = new Date(startDate);
      if (!isNaN(start.getTime())) {
        where.createdAt = { ...where.createdAt, gte: start };
      }
    }

    if (endDate) {
      const end = new Date(endDate);
      if (!isNaN(end.getTime())) {
        // Set end to end of day
        end.setHours(23, 59, 59, 999);
        where.createdAt = { ...where.createdAt, lte: end };
      }
    }

    if (actorId) {
      where.actorId = parseInt(actorId);
    }

    if (action) {
      where.action = {
        contains: action
      };
    }

    if (actionCategory) {
      where.actionCategory = {
        contains: actionCategory
      };
    }

    if (entityType) {
      where.entityType = {
        contains: entityType
      };
    }

    if (entityId) {
      where.entityId = parseInt(entityId);
    }

    // Get total count
    const total = await prisma.auditLog.count({ where });

    // Get audit logs with pagination and sorting
    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });

    // Parse JSON fields for response
    const formattedLogs = logs.map(log => ({
      ...log,
      oldValues: log.oldValuesJson ? JSON.parse(log.oldValuesJson) : null,
      newValues: log.newValuesJson ? JSON.parse(log.newValuesJson) : null,
      metadata: log.metadataJson ? JSON.parse(log.metadataJson) : null,
      oldValuesJson: undefined, // Remove the raw JSON string
      newValuesJson: undefined,
      metadataJson: undefined
    }));

    return NextResponse.json(
      {
        data: formattedLogs,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Audit log retrieval error:', error);
    return NextResponse.json(
      { error: 'An error occurred while retrieving audit logs' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/audit-logs/export
 * Exports audit logs to CSV or JSON format
 */
export async function POST(request: NextRequest) {
  try {
    const authOrResp = await requireRole(request, Roles.ADMIN);
    if ((authOrResp as any).status) return authOrResp as NextResponse;

    const { startDate, endDate, format = 'json', action, actionCategory, entityType } = await request.json();

    // Build where clause
    const where: any = {};

    if (startDate) {
      const start = new Date(startDate);
      if (!isNaN(start.getTime())) {
        where.createdAt = { ...where.createdAt, gte: start };
      }
    }

    if (endDate) {
      const end = new Date(endDate);
      if (!isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        where.createdAt = { ...where.createdAt, lte: end };
      }
    }

    if (action) {
      where.action = { contains: action };
    }

    if (actionCategory) {
      where.actionCategory = { contains: actionCategory };
    }

    if (entityType) {
      where.entityType = { contains: entityType };
    }

    // Fetch logs (limit to 10,000 for export)
    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10000
    });

    if (format === 'csv') {
      // Convert to CSV
      const headers = [
        'ID',
        'Entity Type',
        'Entity ID',
        'Action',
        'Category',
        'Actor ID',
        'Created At',
        'IP Address',
        'Session ID'
      ];

      const rows = logs.map(log => [
        log.id,
        log.entityType,
        log.entityId,
        log.action,
        log.actionCategory,
        log.actorId,
        log.createdAt.toISOString(),
        log.ipAddress,
        log.sessionId
      ]);

      const csv = [headers, ...rows].map(row => row.map(cell => sanitizeCsvCell(cell)).join(',')).join('\n');

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString()}.csv"`
        }
      });
    } else {
      // JSON format
      const data = logs.map(log => ({
        ...log,
        oldValues: log.oldValuesJson ? JSON.parse(log.oldValuesJson) : null,
        newValues: log.newValuesJson ? JSON.parse(log.newValuesJson) : null,
        metadata: log.metadataJson ? JSON.parse(log.metadataJson) : null
      }));

      return new NextResponse(JSON.stringify(data, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString()}.json"`
        }
      });
    }
  } catch (error) {
    console.error('Audit log export error:', error);
    return NextResponse.json(
      { error: 'An error occurred while exporting audit logs' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/audit-logs
 * Always returns 403 — audit logs are immutable (X-01).
 */
export async function DELETE(request: NextRequest) {
  const authOrResp = await requireRole(request, Roles.ADMIN);
  if ((authOrResp as any).status) return authOrResp as NextResponse;

  return NextResponse.json(
    { error: 'Audit logs are immutable and cannot be deleted' },
    { status: 403 }
  );
}


