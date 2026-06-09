import { createHash, randomBytes, scryptSync } from 'crypto';
const SALT_LENGTH = 16;
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  try {
    const a = await import('@node-rs/argon2');
    // @ts-expect-error argon2 Options type doesn't expose 'type' in its public signature
    return await a.hash(password, { type: a.argon2id });
  } catch (err) {
    // If argon2 not available, fall back to scrypt-based hash (legacy)
    const salt = randomBytes(SALT_LENGTH).toString('hex');
    const derivedKey = scryptSync(password, salt, KEY_LENGTH).toString('hex');
    return `${salt}:${derivedKey}`;
  }
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    if (!storedHash) return false;

    // If storedHash looks like an Argon2 encoded string, try using argon2
    if (storedHash.startsWith('$argon2')) {
      try {
        const a = await import('@node-rs/argon2');
        return await a.verify(storedHash, password);
      } catch (e) {
        console.error('Argon2 not available to verify argon2 hash');
        return false;
      }
    }

    // Fallback for legacy salt:derivedKey format (scrypt)
    const [salt, storedKey] = storedHash.split(':');
    if (!salt || !storedKey) return false;
    const derivedKey = scryptSync(password, salt, KEY_LENGTH).toString('hex');
    // Use timing-safe comparison to prevent timing attacks
    const bufA = Buffer.from(derivedKey, 'hex');
    const bufB = Buffer.from(storedKey, 'hex');
    if (bufA.length !== bufB.length) return false;
    return bufA.equals(bufB);
  } catch (err) {
    console.error('Password verification error', err);
    return false;
  }
}

export function splitPasswordHash(hashedPassword: string): { passwordSalt: string; passwordHash: string } {
  if (hashedPassword.startsWith('$argon2')) {
    return { passwordSalt: '', passwordHash: hashedPassword };
  }

  const [salt, derivedKey] = hashedPassword.split(':');
  if (!salt || !derivedKey) {
    return { passwordSalt: '', passwordHash: hashedPassword };
  }

  return { passwordSalt: salt, passwordHash: derivedKey };
}

export function createSimpleHash(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}
