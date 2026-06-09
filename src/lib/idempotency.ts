import { db } from './db';
import { createHash } from 'crypto';

export async function getCachedResponse(key: string) {
  const row = await db.idempotencyKey.findUnique({ where: { key } });
  if (!row) return null;
  if (row.responseStatus == null || row.responseBody == null) return null;
  return { status: row.responseStatus, body: JSON.parse(row.responseBody) };
}

export async function reserveKey(key: string, userId: number | null, method: string, path: string, body: any, ttlSeconds = 24 * 3600) {
  const requestHash = createHash('sha256').update(JSON.stringify(body || {})).digest('hex');
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  try {
    const created = await db.idempotencyKey.create({
      data: {
        key,
        userId: userId ?? undefined,
        method,
        path,
        payloadHash: requestHash,
        createdAt: new Date(),
        expiresAt,
      },
    });
    return created;
  } catch (err) {
    // likely already exists
    return await db.idempotencyKey.findUnique({ where: { key } });
  }
}

export async function storeResponseForKey(key: string, status: number, body: any) {
  try {
    await db.idempotencyKey.update({ where: { key }, data: { responseStatus: status, responseBody: JSON.stringify(body), usedAt: new Date() } });
  } catch (err) {
    console.error('Failed to store idempotency response', err);
  }
}

export async function cleanupExpiredKeys() {
  await db.idempotencyKey.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}

export default {
  getCachedResponse,
  reserveKey,
  storeResponseForKey,
  cleanupExpiredKeys,
};

