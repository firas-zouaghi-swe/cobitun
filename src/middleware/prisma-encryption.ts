/**
 * Prisma Encryption Middleware
 * Automatically encrypts/decrypts PII fields on database read/write operations.
 * Fields: taxId, registrationNumber, mobile
 */

import { encrypt, decrypt, isEncrypted } from '@/lib/encryption';

// Ensure this module is only used on the server side
if (typeof window !== 'undefined') {
  throw new Error('prisma-encryption.ts is a server-side module and should not be imported on the client side');
}

const PII_FIELDS = ['taxId', 'registrationNumber', 'mobile'];
const ENCRYPTED_MODELS = ['Customer'];

/**
 * Encrypt PII fields in a data object before writing to database.
 */
export function encryptModelData<T extends Record<string, unknown>>(
  modelName: string,
  data: T
): T {
  if (!ENCRYPTED_MODELS.includes(modelName)) return data;

  const result = { ...data };
  for (const field of PII_FIELDS) {
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
 * Decrypt PII fields in a data object after reading from database.
 */
export function decryptModelData<T extends Record<string, unknown>>(
  modelName: string,
  data: T
): T {
  if (!ENCRYPTED_MODELS.includes(modelName)) return data;

  const result = { ...data } as Record<string, unknown>;
  for (const field of PII_FIELDS) {
    if (field in result && typeof result[field] === 'string' && result[field]) {
      const value = result[field] as string;
      if (isEncrypted(value)) {
        result[field] = decrypt(value);
      }
    }
  }
  return result as T;
}

/**
 * Decrypt PII fields in an array of model data.
 */
export function decryptModelDataArray<T extends Record<string, unknown>>(
  modelName: string,
  data: T[]
): T[] {
  return data.map((item) => decryptModelData(modelName, item));
}

