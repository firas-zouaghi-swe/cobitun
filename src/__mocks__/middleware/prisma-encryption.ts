/**
 * Mock for @/middleware/prisma-encryption — passthrough implementation
 * that does no actual encryption/decryption. Used by the db mock chain.
 */

export function encryptModelData<T extends Record<string, unknown>>(
  _modelName: string,
  data: T
): T {
  return data;
}

export function decryptModelData<T extends Record<string, unknown>>(
  _modelName: string,
  data: T
): T {
  return data;
}

export function decryptModelDataArray<T extends Record<string, unknown>>(
  _modelName: string,
  data: T[]
): T[] {
  return data;
}
