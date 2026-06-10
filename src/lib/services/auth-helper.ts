/**
 * Authentication helper for workflow API routes.
 * Extracts userId and role from session cookies or authorization tokens.
 * In development mode, fall back to legacy x-user-id / x-user-role headers.
 */

import { NextRequest } from 'next/server';
import { Roles } from './authorization';
import { db } from '@/lib/db';
import { verifyJwt, JWT_COOKIE_NAME } from '@/lib/jwt';
import { ABSOLUTE_SESSION_MAX_AGE, IDLE_SESSION_MAX_AGE } from '@/lib/session';

// Ensure this module is only used on the server side
if (typeof window !== 'undefined') {
  throw new Error('auth-helper.ts is a server-side module and should not be imported on the client side');
}

export interface AuthInfo {
  /** String version of user ID */
  userId: string;
  /** Numeric version of user ID */
  userIdNum: number;
  role: string;
  sessionId?: string;
  email?: string | null;
  /** Customer.id for CUSTOMER role users (resolved from Customer.userId = User.id) */
  customerId?: number | null;
  /** Indicates whether auth came from JWT cookie or dev-mode headers */
  authSource?: 'jwt' | 'dev-header';
}

function getSessionToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.substring(7).trim();
    return token;
  }
  const cookieToken = request.cookies.get(JWT_COOKIE_NAME)?.value ?? null;
  return cookieToken;
}

export async function getAuthInfo(request: NextRequest): Promise<AuthInfo | null> {
  const token = getSessionToken(request);
  if (token) {
    const payload = verifyJwt(token);
    if (!payload) {
      return null;
    }

    const userIdNum = parseInt(payload.sub, 10);
    if (isNaN(userIdNum)) {
      return null;
    }

    // Verify session is active and still within timeout windows.
    try {
      const session = await db.userSession.findUnique({ where: { sessionId: payload.sessionId } });
      if (!session) return null;
      if (session.revokedAt) return null;

      const now = Date.now();
      if (session.expiresAt && session.expiresAt.getTime() < now) {
        await db.userSession.update({ where: { id: session.id }, data: { revokedAt: new Date(now) } });
        return null;
      }

      const lastActivity = session.lastActiveAt?.getTime() ?? session.createdAt.getTime();
      if (lastActivity + IDLE_SESSION_MAX_AGE * 1000 < now) {
        await db.userSession.update({ where: { id: session.id }, data: { revokedAt: new Date(now) } });
        return null;
      }

      // Refresh activity timestamp for active sessions.
      await db.userSession.update({ where: { id: session.id }, data: { lastActiveAt: new Date(now) } });
    } catch (err) {
      // On DB error, treat as unauthenticated
      return null;
    }

    // Resolve customerId for CUSTOMER role users
    let customerId: number | null = null;
    if (payload.role === Roles.CUSTOMER) {
      try {
        const customer = await db.customer.findUnique({
          where: { userId: userIdNum },
          select: { id: true },
        });
        customerId = customer?.id ?? null;
      } catch (err) {
        // Ignore customer lookup error
      }
    }

    return {
      userId: payload.sub,
      userIdNum,
      role: payload.role,
      sessionId: payload.sessionId,
      email: payload.email ?? null,
      customerId,
      authSource: 'jwt',
    };
  }

  if (process.env.NODE_ENV !== 'production') {
    const userIdStr = request.headers.get('x-user-id');
    const role = request.headers.get('x-user-role');
    if (!userIdStr || !role) return null;

    const userIdNum = parseInt(userIdStr, 10);
    if (isNaN(userIdNum)) return null;

    // Resolve customerId for dev-mode CUSTOMER role
    let customerId: number | null = null;
    if (role === Roles.CUSTOMER) {
      try {
        const customer = await db.customer.findUnique({
          where: { userId: userIdNum },
          select: { id: true },
        });
        customerId = customer?.id ?? null;
      } catch (err) {
        // Ignore customer lookup in dev mode
      }
    }

    return { userId: userIdStr, userIdNum, role, customerId, authSource: 'dev-header' };
  }

  return null;
}

export function isAdmin(auth: AuthInfo | null): boolean {
  return auth?.role === Roles.ADMIN || auth?.role === Roles.SUPER_ADMIN;
}

/**
 * Check if the user has SUPER_ADMIN role
 */
export function isSuperAdmin(auth: AuthInfo | null): boolean {
  return auth?.role === Roles.SUPER_ADMIN;
}

export function isCustomer(auth: AuthInfo | null): boolean {
  return auth?.role === Roles.CUSTOMER;
}

export async function resolveCustomerId(auth: AuthInfo): Promise<number | null> {
  if (auth.role !== Roles.CUSTOMER) return null;
  const customer = await db.customer.findUnique({
    where: { userId: auth.userIdNum },
    select: { id: true },
  });
  return customer?.id ?? null;
}

export async function getCustomerIdFromAuth(auth: AuthInfo): Promise<number | null> {
  if (auth.role !== Roles.CUSTOMER) return null;
  if (auth.customerId != null) return auth.customerId;
  return await resolveCustomerId(auth);
}

export async function verifyCustomerOwnership(auth: AuthInfo, requestedCustomerId: number | undefined): Promise<number | null> {
  if (auth.role !== Roles.CUSTOMER) return requestedCustomerId ?? null;

  const resolvedCustomerId = auth.customerId != null ? auth.customerId : await resolveCustomerId(auth);
  if (!resolvedCustomerId) return null;

  if (requestedCustomerId == null) return resolvedCustomerId;
  return requestedCustomerId === resolvedCustomerId ? resolvedCustomerId : null;
}

