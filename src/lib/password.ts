import crypto from 'crypto';

/**
 * Hash a password using bcrypt-like algorithm
 * For production, use bcryptjs or argon2
 */
export async function hashPassword(password: string): Promise<string> {
  // Simple implementation - in production use bcryptjs or argon2
  // For now, use crypto with PBKDF2
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, 'sha512')
    .toString('hex');

  return `${salt}:${hash}`;
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  const [salt, storedHash] = hash.split(':');

  if (!salt || !storedHash) {
    return false;
  }

  const computedHash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, 'sha512')
    .toString('hex');

  return computedHash === storedHash;
}

