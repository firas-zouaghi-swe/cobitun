import { db } from '@/lib/db';
import crypto from 'crypto';

// ==================== TYPE DEFINITIONS ====================

export interface LogActionParams {
  entityType: string;
  entityId: number;
  entityVersion?: number;
  actorId?: number;
  actorType?: string;
  action: string;
  actionCategory?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  requestPath?: string;
  correlationId?: string;
  sessionId?: string;
}

export interface AuditLogEntry {
  id: number;
  entityType: string;
  entityId: number;
  entityVersion: number;
  actorId: number | null;
  actorType: string;
  action: string;
  actionCategory: string;
  oldValuesJson: string | null;
  newValuesJson: string | null;
  metadataJson: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestPath: string | null;
  correlationId: string | null;
  sessionId: string | null;
  previousHash: string | null;
  rowHash: string | null;
  createdAt: Date;
}

// ==================== HASH CALCULATION ====================

/**
 * Calculates the row hash for an audit log entry.
 * Format: `${id}|${entityType}|${entityId}|${entityVersion}|${action}|${newValues||''}|${previousHash||''}`
 *
 * Since we don't know the ID before insert, we use a placeholder
 * and recalculate after the record is created.
 */
function calculateRowHash(
  id: number,
  entityType: string,
  entityId: number,
  entityVersion: number,
  action: string,
  newValuesJson: string | null,
  previousHash: string | null
): string {
  const raw = `${id}|${entityType}|${entityId}|${entityVersion}|${action}|${newValuesJson || ''}|${previousHash || ''}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// ==================== CORE AUDIT FUNCTIONS ====================

/**
 * Logs an action to the AuditLog table with full v3 schema support.
 *
 * - Fetches the previous audit log entry for the same entity to set previousHash
 * - Calculates rowHash for tamper detection
 * - Stores old/new values and metadata as JSON strings
 */
export async function logAction(params: LogActionParams): Promise<AuditLogEntry> {
  const {
    entityType,
    entityId,
    entityVersion = 1,
    actorId,
    actorType = 'USER',
    action,
    actionCategory = 'GENERAL',
    oldValues,
    newValues,
    metadata,
    ipAddress,
    userAgent,
    requestPath,
    correlationId,
    sessionId,
  } = params;

  // Fetch the previous audit log entry for this entity to set previousHash
  const previousEntry = await db.auditLog.findFirst({
    where: {
      entityType,
      entityId,
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      rowHash: true,
    },
  });

  const previousHash = previousEntry?.rowHash || null;

  const oldValuesJson = oldValues ? JSON.stringify(oldValues) : null;
  const newValuesJson = newValues ? JSON.stringify(newValues) : null;
  const metadataJson = metadata ? JSON.stringify(metadata) : null;

  // Insert the audit log entry first (without rowHash, since we need the ID)
  const entry = await db.auditLog.create({
    data: {
      entityType,
      entityId,
      entityVersion,
      actorId: actorId ?? null,
      actorType,
      action,
      actionCategory,
      oldValuesJson,
      newValuesJson,
      metadataJson,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
      requestPath: requestPath ?? null,
      correlationId: correlationId ?? null,
      sessionId: sessionId ?? null,
      previousHash,
      rowHash: '', // Placeholder, will update below
    },
  });

  // Calculate the row hash with the actual ID
  const rowHash = calculateRowHash(
    entry.id,
    entityType,
    entityId,
    entityVersion,
    action,
    newValuesJson,
    previousHash
  );

  // Update the entry with the correct row hash
  const updated = await db.auditLog.update({
    where: { id: entry.id },
    data: { rowHash },
  });

  return updated as AuditLogEntry;
}

// ==================== QUERY HELPERS ====================

/**
 * Get the full audit trail for a specific entity, ordered chronologically.
 */
export async function getEntityAuditTrail(
  entityType: string,
  entityId: number
): Promise<AuditLogEntry[]> {
  return db.auditLog.findMany({
    where: {
      entityType,
      entityId,
    },
    orderBy: {
      createdAt: 'asc',
    },
  }) as Promise<AuditLogEntry[]>;
}

/**
 * Get audit logs by actor.
 */
export async function getAuditLogsByActor(
  actorId: number,
  options?: { limit?: number; offset?: number; actionCategory?: string }
): Promise<AuditLogEntry[]> {
  return db.auditLog.findMany({
    where: {
      actorId,
      ...(options?.actionCategory ? { actionCategory: options.actionCategory } : {}),
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: options?.limit ?? 100,
    skip: options?.offset ?? 0,
  }) as Promise<AuditLogEntry[]>;
}

/**
 * Get audit logs by correlation ID (useful for tracking request flows).
 */
export async function getAuditLogsByCorrelationId(
  correlationId: string
): Promise<AuditLogEntry[]> {
  return db.auditLog.findMany({
    where: {
      correlationId,
    },
    orderBy: {
      createdAt: 'asc',
    },
  }) as Promise<AuditLogEntry[]>;
}

/**
 * Verify the integrity of an audit trail for a given entity.
 * Returns true if all hashes chain correctly, false otherwise.
 */
export async function verifyAuditIntegrity(
  entityType: string,
  entityId: number
): Promise<{ valid: boolean; brokenAt: number | null }> {
  const trail = await db.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: 'asc' },
  });

  if (trail.length === 0) {
    return { valid: true, brokenAt: null };
  }

  for (let i = 0; i < trail.length; i++) {
    const entry = trail[i];
    const expectedPreviousHash = i === 0 ? null : trail[i - 1].rowHash;

    // Verify previousHash links correctly
    if (entry.previousHash !== expectedPreviousHash) {
      return { valid: false, brokenAt: entry.id };
    }

    // Verify rowHash
    const computedHash = calculateRowHash(
      entry.id,
      entry.entityType,
      entry.entityId,
      entry.entityVersion,
      entry.action,
      entry.newValuesJson,
      entry.previousHash
    );

    if (entry.rowHash !== computedHash) {
      return { valid: false, brokenAt: entry.id };
    }
  }

  return { valid: true, brokenAt: null };
}

/**
 * Get recent audit logs across all entities.
 */
export async function getRecentAuditLogs(options?: {
  limit?: number;
  offset?: number;
  actionCategory?: string;
  entityType?: string;
}): Promise<AuditLogEntry[]> {
  return db.auditLog.findMany({
    where: {
      ...(options?.actionCategory ? { actionCategory: options.actionCategory } : {}),
      ...(options?.entityType ? { entityType: options.entityType } : {}),
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: options?.limit ?? 50,
    skip: options?.offset ?? 0,
  }) as Promise<AuditLogEntry[]>;
}

