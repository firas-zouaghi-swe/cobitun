
/**
 * IODA Configuration API
 * GET    - Get IODA configuration
 * PUT    - Update IODA configuration (admin only)
 * POST   - Add provider ASN mapping
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { db } from '@/lib/db';
import { Errors, validateRequestBody } from '@/middleware/validation';
import { z } from 'zod';
import { logAction } from '@/lib/services/audit-service';

const updateConfigSchema = z.object({
  checkFrequencyMinutes: z.number().int().min(1).max(1440).optional(),
  outageThresholdScore: z.number().min(0).max(100).optional(),
  autoDraftEnabled: z.boolean().optional(),
  notificationEnabled: z.boolean().optional(),
  iodaApiEndpoint: z.string().url().optional(),
  iodaApiKey: z.string().optional(),
});

const asnMappingSchema = z.object({
  cloudProviderId: z.number().int().positive(),
  asn: z.string().min(1).max(50),
  asnName: z.string().max(200).optional(),
});

// Default config stored in memory (in production, use a config table or env vars)
let iodaConfig = {
  checkFrequencyMinutes: parseInt(process.env.IODA_CHECK_FREQUENCY_MIN || '15', 10),
  outageThresholdScore: parseInt(process.env.IODA_OUTAGE_THRESHOLD || '50', 10),
  autoDraftEnabled: process.env.IODA_AUTO_DRAFT !== 'false',
  notificationEnabled: true,
  iodaApiEndpoint: process.env.IODA_API_ENDPOINT || 'https://api.internetoutagealert.org/v1',
  iodaApiKey: process.env.IODA_API_KEY || '',
};

export async function GET(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  try {
    // Get ASN mappings from cloud providers
    const providers = await db.cloudProvider.findMany({
      where: { isDeleted: 0 },
      select: { id: true, organisationName: true, asn: true },
    });

    return NextResponse.json({
      config: {
        ...iodaConfig,
        iodaApiKey: iodaConfig.iodaApiKey ? '••••••••' : null, // Mask API key
      },
      providers: providers.map((p) => ({
        id: p.id,
        name: p.organisationName,
        asn: p.asn,
      })),
    });
  } catch (error) {
    console.error('Failed to get IODA config', error);
    return Errors.internal();
  }
}

export async function PUT(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  const result = await validateRequestBody(request, updateConfigSchema);
  if ('error' in result) return result.error;

  try {
    const data = result.data;

    if (data.checkFrequencyMinutes !== undefined) iodaConfig.checkFrequencyMinutes = data.checkFrequencyMinutes;
    if (data.outageThresholdScore !== undefined) iodaConfig.outageThresholdScore = data.outageThresholdScore;
    if (data.autoDraftEnabled !== undefined) iodaConfig.autoDraftEnabled = data.autoDraftEnabled;
    if (data.notificationEnabled !== undefined) iodaConfig.notificationEnabled = data.notificationEnabled;
    if (data.iodaApiEndpoint !== undefined) iodaConfig.iodaApiEndpoint = data.iodaApiEndpoint;
    if (data.iodaApiKey !== undefined) iodaConfig.iodaApiKey = data.iodaApiKey;

    await logAction({
      entityType: 'SystemConfig',
      entityId: 1,
      action: 'UPDATE_IODA_CONFIG',
      actorId: auth.userIdNum,
      actorType: 'ADMIN',
      metadata: { updatedFields: Object.keys(data) },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json({
      message: 'IODA configuration updated',
      config: {
        ...iodaConfig,
        iodaApiKey: iodaConfig.iodaApiKey ? '••••••••' : null,
      },
    });
  } catch (error) {
    console.error('Failed to update IODA config', error);
    return Errors.internal();
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  const result = await validateRequestBody(request, asnMappingSchema);
  if ('error' in result) return result.error;

  try {
    const data = result.data;

    const provider = await db.cloudProvider.findFirst({ where: { id: data.cloudProviderId, isDeleted: 0 } });
    if (!provider) return Errors.notFound('Cloud provider');

    // Update ASN on the provider
    await db.cloudProvider.update({
      where: { id: data.cloudProviderId },
      data: { asn: data.asn, updatedAt: new Date() },
    });

    await logAction({
      entityType: 'CloudProvider',
      entityId: data.cloudProviderId,
      action: 'UPDATE_ASN_MAPPING',
      actorId: auth.userIdNum,
      actorType: 'ADMIN',
      metadata: { asn: data.asn, asnName: data.asnName, providerName: provider.organisationName },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json({
      message: 'ASN mapping updated',
      cloudProviderId: data.cloudProviderId,
      asn: data.asn,
    });
  } catch (error) {
    console.error('Failed to update ASN mapping', error);
    return Errors.internal();
  }
}

