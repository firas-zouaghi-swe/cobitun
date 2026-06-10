import { NextResponse, NextRequest } from 'next/server';
import { AuthInfo, getAuthInfo } from './auth-helper';

// Ensure this module is only used on the server side
if (typeof window !== 'undefined') {
  throw new Error('authorization.ts is a server-side module and should not be imported on the client side');
}
import { verifyCsrfToken } from '@/lib/csrf';
import { isMfaRequired } from '@/lib/services/mfa-service';

export const Roles = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  CUSTOMER: 'CUSTOMER',
} as const;

export type Role = typeof Roles[keyof typeof Roles];

const CSRF_SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

/**
 * Ensure the request is authenticated. Returns AuthInfo or a NextResponse (401).
 */
export async function requireAuth(request: NextRequest): Promise<AuthInfo | NextResponse> {
  const auth = await getAuthInfo(request);
  if (!auth) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  if (!CSRF_SAFE_METHODS.includes(request.method.toUpperCase())) {
    // In dev mode, allow header-based auth without CSRF token for convenience.
    if (process.env.NODE_ENV !== 'production' && auth.authSource === 'dev-header') {
      return auth;
    }

    // Enforce CSRF token only when MFA is required for this user.
    // Admin users always require MFA; customers require MFA only when enabled.
    try {
      const mfaRequired = await isMfaRequired(auth.userIdNum);
      if (mfaRequired) {
        if (!verifyCsrfToken(request)) {
          return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
        }
      }
      // If MFA is not required, skip CSRF enforcement (authentication is sufficient).
    } catch (err) {
      // On error determining MFA requirement, fail-safe: enforce CSRF validation.
      if (!verifyCsrfToken(request)) {
        return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
      }
    }
  }

  return auth;
}

/**
 * Ensure the request is from a user with one of the allowed roles. Returns AuthInfo or NextResponse (401/403).
 * 
 * NOTE: When ADMIN role is requested, SUPER_ADMIN is automatically included since SUPER_ADMIN
 * should have all ADMIN privileges everywhere in the app.
 */
export async function requireRole(request: NextRequest, allowed: Role[] | Role): Promise<AuthInfo | NextResponse> {
  const authOrResp = await requireAuth(request);
  if ((authOrResp as NextResponse).status) return authOrResp as NextResponse;
  const auth = authOrResp as AuthInfo;
  let allowedArr = Array.isArray(allowed) ? allowed : [allowed];
  
  // If ADMIN is allowed, automatically allow SUPER_ADMIN too
  if (allowedArr.includes(Roles.ADMIN) && !allowedArr.includes(Roles.SUPER_ADMIN)) {
    allowedArr = [...allowedArr, Roles.SUPER_ADMIN];
  }
  
  if (!allowedArr.includes(auth.role as Role)) {
    return NextResponse.json({ error: 'Forbidden: insufficient role' }, { status: 403 });
  }
  return auth;
}

/**
 * Validate ownership: checks if the authenticated user owns the given customer record.
 * For ADMIN role: always returns true.
 * For CUSTOMER role: resolves the customer record via userId and compares customerId.
 *
 * IMPORTANT: ownerId here is a CUSTOMER id (not a User id).
 * Customer.id ≠ User.id — they are separate autoincrement sequences.
 * Customer.userId references User.id.
 */
export function isOwnerOrAdmin(auth: AuthInfo, ownerId?: number | null): boolean {
  if (!auth) return false;
  if (auth.role === Roles.ADMIN || auth.role === Roles.SUPER_ADMIN) return true;
  if (!ownerId) return false;
  // Fast-path: if auth carries customerId (from JWT/session), compare directly
  if ((auth as any).customerId != null && (auth as any).customerId === ownerId) return true;
  // Fallback: userId comparison — this is incorrect when ownerId is a Customer.id
  // but kept for backward compat with routes that pass User.id as ownerId
  return auth.userIdNum === ownerId;
}

/**
 * Async version of isOwnerOrAdmin that properly resolves the Customer record
 * from the User ID. Use this in API routes where ownerId is a Customer.id.
 */
export async function isOwnerOrAdminAsync(auth: AuthInfo, customerId?: number | null): Promise<boolean> {
  if (!auth) return false;
  if (auth.role === Roles.ADMIN || auth.role === Roles.SUPER_ADMIN) return true;
  if (!customerId) return false;
  const { db } = await import('@/lib/db');
  const customer = await db.customer.findUnique({
    where: { userId: auth.userIdNum },
    select: { id: true },
  });
  return customer?.id === customerId;
}

/**
 * Check if the user has SUPER_ADMIN role
 */
export function isSuperAdmin(auth: AuthInfo | null): boolean {
  return auth?.role === Roles.SUPER_ADMIN;
}

export default { Roles, requireAuth, requireRole, isOwnerOrAdmin, isOwnerOrAdminAsync, isSuperAdmin };

