import { createHmac, randomBytes } from 'crypto';

// Ensure this module is only used on the server side
if (typeof window !== 'undefined') {
  throw new Error('jwt.ts is a server-side module and should not be imported on the client side');
}

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? (() => { throw new Error('JWT_SECRET environment variable is required in production'); })() : 'dev-jwt-secret');
export const JWT_COOKIE_NAME = 'cobitun_session';
export const JWT_ACCESS_MAX_AGE = 60 * 15; // 15 minutes for access token
export const JWT_MAX_AGE = 60 * 15; // 15 minutes (access token cookie maxAge)
// Note: Refresh tokens use REFRESH_MAX_AGE from session.ts (7-30 days)

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(value: string) {
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), '=');
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function sign(input: string) {
  return base64UrlEncode(createHmac('sha256', JWT_SECRET).update(input).digest());
}

export interface JwtPayload {
  sub: string;
  role: string;
  sessionId: string;
  email?: string | null;
  iat: number;
  exp: number;
}

export function createJwt(payload: Omit<JwtPayload, 'iat' | 'exp'>, expiresInSeconds = JWT_MAX_AGE) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const signedPayload: JwtPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(signedPayload));
  const signature = sign(`${encodedHeader}.${encodedPayload}`);
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyJwt(token: string): JwtPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`);
  if (signature.length !== expectedSignature.length) return null;

  const bufferA = Buffer.from(signature);
  const bufferB = Buffer.from(expectedSignature);
  if (!bufferA.equals(bufferB)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as JwtPayload;
    if (typeof payload.exp !== 'number' || typeof payload.iat !== 'number') return null;
    if (Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createSessionId() {
  return randomBytes(16).toString('hex');
}

