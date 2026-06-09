/**
 * Field-Level Encryption using AES-256-GCM
 * Encrypts PII fields (taxId, registrationNumber, mobile) at rest.
 * Key is managed via ENCRYPTION_KEY environment variable.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

// Ensure this module is only used on the server side
if (typeof window !== 'undefined') {
  throw new Error('encryption.ts is a server-side module and should not be imported on the client side');
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

function getEncryptionKey(): Buffer {
  const keyEnv = process.env.ENCRYPTION_KEY;
  if (keyEnv) {
    // If key is provided as hex, use it directly (must be 32 bytes)
    if (keyEnv.length === 64) {
      return Buffer.from(keyEnv, 'hex');
    }
    // Derive key from passphrase
    const salt = process.env.ENCRYPTION_SALT || 'cobitun-default-salt';
    return scryptSync(keyEnv, salt, 32);
  }
  // Dev fallback - NOT for production
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ENCRYPTION_KEY environment variable is required in production');
  }
  return scryptSync('cobitun-dev-encryption-key', 'cobitun-dev-salt', 32);
}

export interface EncryptedPayload {
  iv: string;       // hex encoded initialization vector
  authTag: string;  // hex encoded authentication tag
  encrypted: string; // hex encoded ciphertext
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a JSON string containing iv, authTag, and encrypted data.
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return plaintext;

  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  const payload: EncryptedPayload = {
    iv: iv.toString('hex'),
    authTag,
    encrypted,
  };

  return JSON.stringify(payload);
}

/**
 * Decrypt a previously encrypted string.
 * Expects the JSON string format produced by encrypt().
 */
export function decrypt(ciphertext: string): string {
  if (!ciphertext) return ciphertext;

  try {
    const payload: EncryptedPayload = JSON.parse(ciphertext);
    const key = getEncryptionKey();
    const iv = Buffer.from(payload.iv, 'hex');
    const authTag = Buffer.from(payload.authTag, 'hex');

    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(payload.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    // If decryption fails, the data might be unencrypted (legacy)
    // Return as-is in dev, throw in production
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Decryption failed, returning raw value:', err);
      return ciphertext;
    }
    throw new Error('Failed to decrypt field value');
  }
}

/**
 * Check if a string looks like an encrypted payload.
 */
export function isEncrypted(value: string): boolean {
  if (!value) return false;
  try {
    const parsed = JSON.parse(value);
    return !!(parsed.iv && parsed.authTag && parsed.encrypted);
  } catch {
    return false;
  }
}

/**
 * Encrypt PII fields in a data object based on field names.
 */
export function encryptPIIFields<T extends Record<string, unknown>>(
  data: T,
  fields: string[] = ['taxId', 'registrationNumber', 'mobile']
): T {
  const result = { ...data };
  for (const field of fields) {
    if (field in result && typeof result[field] === 'string' && result[field]) {
      const value = result[field] as string;
      if (!isEncrypted(value)) {
        (result as Record<string, unknown>)[field] = encrypt(value);
      }
    }
  }
  return result;
}

/**
 * Decrypt PII fields in a data object based on field names.
 */
export function decryptPIIFields<T extends Record<string, unknown>>(
  data: T,
  fields: string[] = ['taxId', 'registrationNumber', 'mobile']
): T {
  const result = { ...data };
  for (const field of fields) {
    if (field in result && typeof result[field] === 'string' && result[field]) {
      const value = result[field] as string;
      if (isEncrypted(value)) {
        (result as Record<string, unknown>)[field] = decrypt(value);
      }
    }
  }
  return result;
}

