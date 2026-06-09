
/**
 * Reference Data Bulk Import API
 * POST - Bulk import sectors or providers from CSV
 * GET  - List reference data with CRUD support
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { db } from '@/lib/db';
import { Errors, errorResponse, validateRequestBody } from '@/middleware/validation';
import { z } from 'zod';
import { logAction } from '@/lib/services/audit-service';

const importSchema = z.object({
  type: z.enum(['sectors', 'providers']),
  data: z.array(z.record(z.string(), z.unknown())).min(1).max(500),
});

const crudSchema = z.object({
  type: z.enum(['sectors', 'providers', 'businessModels', 'turnoverBands', 'resilienceProfiles']),
  action: z.enum(['create', 'update', 'delete']),
  id: z.number().int().positive().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  const result = await validateRequestBody(request, importSchema);
  if ('error' in result) return result.error;

  try {
    const { type, data } = result.data;
    const results: { row: number; success: boolean; error?: string }[] = [];

    if (type === 'sectors') {
      for (let i = 0; i < data.length; i++) {
        try {
          const row = data[i] as Record<string, unknown>;
          const code = String(row.code || row.Code || '');
          const name = String(row.name || row.Name || '');
          const nameAr = String(row.nameAr || row.NameAr || row.name_ar || '');

          if (!code || !name) {
            results.push({ row: i, success: false, error: 'Missing code or name' });
            continue;
          }

          await db.refSector.upsert({
            where: { sectorCode: code },
            create: { sectorCode: code, sectorName: name, sectorNameAr: nameAr || null, riskFactor: 1.0, isActive: 1, version: 1 },
            update: { sectorName: name, sectorNameAr: nameAr || null, updatedAt: new Date() },
          });

          results.push({ row: i, success: true });
        } catch (error) {
          results.push({ row: i, success: false, error: (error as Error).message });
        }
      }
    } else if (type === 'providers') {
      for (let i = 0; i < data.length; i++) {
        try {
          const row = data[i] as Record<string, unknown>;
          const name = String(row.name || row.Name || '');
          const asn = row.asn || row.ASN || row.asnNumber ? String(row.asn || row.ASN || row.asnNumber) : null;
          const website = String(row.website || row.Website || '');
          const category = String(row.category || row.Category || 'CLOUD');

          if (!name) {
            results.push({ row: i, success: false, error: 'Missing name' });
            continue;
          }

          if (!asn) {
            results.push({ row: i, success: false, error: 'Missing asn' });
            continue;
          }

          await db.cloudProvider.upsert({
            where: { asn },
            create: { organisationName: name, asn, slaTierId: 1, mttrHours: 0, riskScore: 0, isActive: 1, version: 1 },
            update: { organisationName: name, updatedAt: new Date() },
          });

          results.push({ row: i, success: true });
        } catch (error) {
          results.push({ row: i, success: false, error: (error as Error).message });
        }
      }
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    await logAction({
      entityType: 'SystemSetting',
      entityId: 0,
      action: 'BULK_IMPORT',
      actorId: auth.userIdNum,
      actorType: auth.role,
      metadata: { type, totalRows: data.length, succeeded, failed },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json({
      message: `Import completed: ${succeeded} succeeded, ${failed} failed`,
      results,
      summary: { total: data.length, succeeded, failed },
    }, { status: 201 });
  } catch (error) {
    console.error('Bulk import failed:', error);
    return Errors.internal();
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  const result = await validateRequestBody(request, crudSchema);
  if ('error' in result) return result.error;

  try {
    const { type, action, id, data: updateData } = result.data;

    if (action === 'delete' && id) {
      // Soft delete
      switch (type) {
        case 'sectors':
          await db.refSector.update({ where: { id }, data: { isActive: 0, updatedAt: new Date() } });
          break;
        case 'providers':
          await db.cloudProvider.update({ where: { id }, data: { isActive: 0, updatedAt: new Date() } });
          break;
        default:
          return errorResponse(`Delete not supported for type: ${type}`, 'NOT_SUPPORTED', 400);
      }

      return NextResponse.json({ message: 'Record deleted', type, id });
    }

    if (action === 'update' && id && updateData) {
      switch (type) {
        case 'sectors':
          await db.refSector.update({ where: { id }, data: { ...updateData, updatedAt: new Date() } });
          break;
        case 'providers':
          await db.cloudProvider.update({ where: { id }, data: { ...updateData, updatedAt: new Date() } });
          break;
        default:
          return errorResponse(`Update not supported for type: ${type}`, 'NOT_SUPPORTED', 400);
      }

      return NextResponse.json({ message: 'Record updated', type, id });
    }

    if (action === 'create' && updateData) {
      let record;
      switch (type) {
        case 'sectors':
          record = await db.refSector.create({ data: { sectorCode: String(updateData.code || updateData.sectorCode), sectorName: String(updateData.name || updateData.sectorName), sectorNameAr: String(updateData.nameAr || updateData.sectorNameAr || ''), riskFactor: 1.0, isActive: 1, version: 1 } });
          break;
        case 'providers':
          record = await db.cloudProvider.create({ data: { organisationName: String(updateData.name || updateData.organisationName), asn: String(updateData.asn || ''), slaTierId: Number(updateData.slaTierId) || 1, mttrHours: Number(updateData.mttrHours) || 0, riskScore: Number(updateData.riskScore) || 0, isActive: 1, version: 1 } });
          break;
        default:
          return errorResponse(`Create not supported for type: ${type}`, 'NOT_SUPPORTED', 400);
      }

      return NextResponse.json({ message: 'Record created', type, record }, { status: 201 });
    }

    return errorResponse('Invalid CRUD operation', 'INVALID_OPERATION', 400);
  } catch (error) {
    console.error('Reference data CRUD failed:', error);
    return Errors.internal();
  }
}


