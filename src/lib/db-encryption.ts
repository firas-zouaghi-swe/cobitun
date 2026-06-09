
/**
 * Database-Level Encryption Utilities
 * - Local storage encryption / OS-managed disk encryption
 * - Backup encryption
 * - Key rotation policy
 */

import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-dev-key-change-in-production-32ch';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * Encrypt data for local storage (database-level encryption)
 */
export function encryptData(data: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'cobitun-salt', 32);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt data from local storage
 */
export function decryptData(encryptedData: string): string {
  const parts = encryptedData.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted data format');

  const iv = Buffer.from(parts[0], 'hex');
  const tag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'cobitun-salt', 32);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Encrypt a backup file buffer
 */
export function encryptBackup(buffer: Buffer): Buffer {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'cobitun-backup-salt', 32);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    iv,
    cipher.update(buffer),
    cipher.final(),
    cipher.getAuthTag(),
  ]);

  return encrypted;
}

/**
 * Decrypt a backup file buffer
 */
export function decryptBackup(buffer: Buffer): Buffer {
  const iv = buffer.subarray(0, IV_LENGTH);
  const tag = buffer.subarray(buffer.length - TAG_LENGTH);
  const encrypted = buffer.subarray(IV_LENGTH, buffer.length - TAG_LENGTH);
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'cobitun-backup-salt', 32);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
}

/**
 * Key rotation: re-encrypt data with a new key
 */
export function rotateKey(encryptedData: string, newKey: string): string {
  const decrypted = decryptData(encryptedData);
  const oldKey = ENCRYPTION_KEY;

  // Temporarily use new key for encryption
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = crypto.scryptSync(newKey, 'cobitun-salt', 32);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(decrypted, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
}

/**
 * Generate a new encryption key for rotation
 */
export function generateNewKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Check if key rotation is needed based on policy
 * Default: rotate every 90 days
 */
export function isKeyRotationNeeded(lastRotationDate: Date): boolean {
  const ROTATION_INTERVAL_DAYS = parseInt(process.env.KEY_ROTATION_DAYS || '90', 10);
  const now = new Date();
  const daysSinceRotation = (now.getTime() - lastRotationDate.getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceRotation >= ROTATION_INTERVAL_DAYS;
}

