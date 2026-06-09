import { NextRequest, NextResponse } from 'next/server';
import { db, safeTransaction } from '@/lib/db';
import { getAuthInfo, AuthInfo } from '@/lib/services/auth-helper';
import { requireRole, Roles } from '@/lib/services/authorization';
import { logAction } from '@/lib/services/audit-service';

const TYPE_MAP: Record<string, { model: string; codeField: string; nameField: string; extraFields?: string[] }> = {
  sector: { model: 'refSector', codeField: 'sectorCode', nameField: 'sectorName', extraFields: ['riskFactor'] },
  businessModel: { model: 'refBusinessModel', codeField: 'modelCode', nameField: 'modelName', extraFields: ['riskFactor'] },
  turnoverBand: { model: 'refTurnoverBand', codeField: 'bandCode', nameField: 'bandName', extraFields: ['riskFactor', 'minTurnover', 'maxTurnover'] },
  resilienceProfile: { model: 'refResilienceProfile', codeField: 'profileCode', nameField: 'profileName', extraFields: ['riskFactor'] },
  slaTier: { model: 'enumSlaTier', codeField: 'tierCode', nameField: 'tierName', extraFields: ['basePremiumFactor', 'mttrHours', 'thresholdHours'] },
  securityPosture: { model: 'enumSecurityPosture', codeField: 'postureCode', nameField: 'postureName', extraFields: ['riskMultiplier'] },
};

function getModelDelegate(type: string) {
  switch (type) {
    case 'sector': return db.refSector;
    case 'businessModel': return db.refBusinessModel;
    case 'turnoverBand': return db.refTurnoverBand;
    case 'resilienceProfile': return db.refResilienceProfile;
    case 'slaTier': return db.enumSlaTier;
    case 'securityPosture': return db.enumSecurityPosture;
    default: return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params;
    const config = TYPE_MAP[type];
    if (!config) {
      return NextResponse.json({ error: `Invalid reference type. Valid types: ${Object.keys(TYPE_MAP).join(', ')}` }, { status: 400 });
    }

    const delegate = getModelDelegate(type);
    if (!delegate) {
      return NextResponse.json({ error: 'Model not found' }, { status: 500 });
    }

    // Get current version entries
    const entries = await (delegate as any).findMany({
      where: { isCurrent: 1, isActive: 1 },
      orderBy: { createdAt: 'desc' },
    });

    // For each entry, also get version history
    // Build select object with only common + type-specific fields
    const commonSelect: Record<string, boolean> = {
      id: true,
      version: true,
      validFrom: true,
      validTo: true,
      isCurrent: true,
      createdBy: true,
    };
    // Add type-specific fields to select
    if (config.extraFields) {
      for (const field of config.extraFields) {
        commonSelect[field] = true;
      }
    }

    const entriesWithHistory = await Promise.all(
      entries.map(async (entry: any) => {
        const history = await (delegate as any).findMany({
          where: { [config.codeField]: entry[config.codeField] },
          orderBy: { validFrom: 'desc' },
          select: commonSelect,
        });
        return { ...entry, versionHistory: history };
      })
    );

    return NextResponse.json({ entries: entriesWithHistory, config });
  } catch (error) {
    console.error('Get reference data error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const authOrResp = await requireRole(request, Roles.ADMIN);
    if ((authOrResp as any).status) return authOrResp as NextResponse;
    const auth = authOrResp as AuthInfo;

    const { type } = await params;
    const config = TYPE_MAP[type];
    if (!config) {
      return NextResponse.json({ error: `Invalid reference type. Valid types: ${Object.keys(TYPE_MAP).join(', ')}` }, { status: 400 });
    }

    const delegate = getModelDelegate(type);
    if (!delegate) {
      return NextResponse.json({ error: 'Model not found' }, { status: 500 });
    }

    const body = await request.json();
    const { code, name, nameAr, description, riskFactor, riskMultiplier, basePremiumFactor, mttrHours, thresholdHours, minTurnover, maxTurnover } = body;

    if (!code || !name) {
      return NextResponse.json({ error: 'Code and name are required' }, { status: 400 });
    }

    // Close the current version of this entry if it exists
    const current = await (delegate as any).findFirst({
      where: { [config.codeField]: code, isCurrent: 1, isActive: 1 },
    });

    if (current) {
      // Close current version + create new version in a transaction
      const entry = await safeTransaction(async (tx) => {
        // Close current version
        await (tx as any)[type].update({
          where: { id: current.id },
          data: { isCurrent: 0, validTo: new Date(), updatedBy: auth?.userIdNum },
        });

        // Build data object based on type
        const data: Record<string, unknown> = {
          [config.codeField]: code,
          [config.nameField]: name,
          description: description || null,
          isActive: 1,
          isCurrent: 1,
          validFrom: new Date(),
          validTo: null,
          version: current ? current.version + 1 : 1,
          createdBy: auth?.userIdNum,
        };

        // Add nameAr field if it exists
        if ('sectorNameAr' in (current || {})) data.sectorNameAr = nameAr || null;
        if ('modelNameAr' in (current || {})) data.modelNameAr = nameAr || null;
        if ('bandNameAr' in (current || {})) data.bandNameAr = nameAr || null;
        if ('profileNameAr' in (current || {})) data.profileNameAr = nameAr || null;
        if ('tierNameAr' in (current || {})) data.tierNameAr = nameAr || null;
        if ('postureNameAr' in (current || {})) data.postureNameAr = nameAr || null;

        // Add type-specific fields
        if (riskFactor !== undefined) data.riskFactor = riskFactor;
        if (riskMultiplier !== undefined) data.riskMultiplier = riskMultiplier;
        if (basePremiumFactor !== undefined) data.basePremiumFactor = basePremiumFactor;
        if (mttrHours !== undefined) data.mttrHours = mttrHours;
        if (thresholdHours !== undefined) data.thresholdHours = thresholdHours;
        if (minTurnover !== undefined) data.minTurnover = minTurnover;
        if (maxTurnover !== undefined) data.maxTurnover = maxTurnover;

        return (tx as any)[type].create({ data });
      });

      await logAction({
        entityType: config.model,
        entityId: entry.id,
        actorId: auth?.userIdNum,
        action: current ? 'VERSION' : 'CREATE',
        actionCategory: 'ADMIN',
        newValues: { code, name, version: entry.version },
        requestPath: `/api/admin/reference/${type}`,
      });

      return NextResponse.json({ entry });
    }

    // No current version — just create
    const data: Record<string, unknown> = {
      [config.codeField]: code,
      [config.nameField]: name,
      description: description || null,
      isActive: 1,
      isCurrent: 1,
      validFrom: new Date(),
      validTo: null,
      version: 1,
      createdBy: auth?.userIdNum,
    };

    // Add type-specific fields
    if (riskFactor !== undefined) data.riskFactor = riskFactor;
    if (riskMultiplier !== undefined) data.riskMultiplier = riskMultiplier;
    if (basePremiumFactor !== undefined) data.basePremiumFactor = basePremiumFactor;
    if (mttrHours !== undefined) data.mttrHours = mttrHours;
    if (thresholdHours !== undefined) data.thresholdHours = thresholdHours;
    if (minTurnover !== undefined) data.minTurnover = minTurnover;
    if (maxTurnover !== undefined) data.maxTurnover = maxTurnover;

    const entry = await (delegate as any).create({ data });

    await logAction({
      entityType: config.model,
      entityId: entry.id,
      actorId: auth?.userIdNum,
      action: current ? 'VERSION' : 'CREATE',
      actionCategory: 'ADMIN',
      newValues: { code, name, version: entry.version },
      requestPath: `/api/admin/reference/${type}`,
    });

    return NextResponse.json({ entry });
  } catch (error) {
    console.error('Create reference data error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

