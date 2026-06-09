/**
 * Idempotency Middleware
 * Ensures that repeated requests with the same Idempotency-Key return the same response.
 * Applied to: parametric application, payment, payout, cancellation endpoints.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCachedResponse, reserveKey, storeResponseForKey } from '@/lib/idempotency';
import { getAuthInfo } from '@/lib/services/auth-helper';

const IDEMPOTENCY_HEADER = 'Idempotency-Key';
const REQUIRED_ENDPOINTS = [
  '/api/customer/apply-parametric',
  '/api/workflow/policy-applications',
  '/api/workflow/claims',
  '/api/admin/parametric-policy-requests',
  '/api/admin/parametric-claims',
  // Payment endpoints
  '/api/payments/retry',
  // Payout endpoints
  '/api/admin/claims/',
  // Cancellation endpoints
  '/api/customer/policies/',
  '/api/admin/policies/',
];

/**
 * Check if an endpoint requires idempotency keys.
 */
export function requiresIdempotency(pathname: string): boolean {
  return REQUIRED_ENDPOINTS.some((ep) => pathname.startsWith(ep));
}

/**
 * Extract idempotency key from request headers.
 */
export function getIdempotencyKey(request: NextRequest): string | null {
  return request.headers.get(IDEMPOTENCY_HEADER);
}

/**
 * Process idempotency for a request.
 * Returns cached response if key was already used, or null to continue processing.
 */
export async function handleIdempotency(
  request: NextRequest
): Promise<{ cached: NextResponse } | { key: string; continue: true } | { error: NextResponse }> {
  const key = getIdempotencyKey(request);
  const pathname = request.nextUrl.pathname;

  // For required endpoints, enforce idempotency key presence
  if (requiresIdempotency(pathname)) {
    if (!key) {
      return {
        error: NextResponse.json(
          {
            error: 'Idempotency-Key header is required for this endpoint',
            code: 'IDEMPOTENCY_REQUIRED',
          },
          { status: 400 }
        ),
      };
    }
  }

  // If no key provided and not required, continue without idempotency
  if (!key) {
    return { key: '', continue: true };
  }

  // Validate key format (alphanumeric, dashes, underscores, 8-64 chars)
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(key)) {
    return {
      error: NextResponse.json(
        {
          error: 'Invalid Idempotency-Key format. Must be 8-64 alphanumeric characters, dashes, or underscores.',
          code: 'INVALID_IDEMPOTENCY_KEY',
        },
        { status: 400 }
      ),
    };
  }

  // Check for cached response
  const cached = await getCachedResponse(key);
  if (cached) {
    return {
      cached: NextResponse.json(cached.body, { status: cached.status }),
    };
  }

  // Reserve the key
  const auth = await getAuthInfo(request);
  let body: unknown = null;
  try {
    const cloned = request.clone();
    body = await cloned.json();
  } catch {
    // Non-JSON body, that's fine
  }

  await reserveKey(key, auth?.userIdNum ?? null, request.method, pathname, body);

  return { key, continue: true };
}

/**
 * Store the response for an idempotency key.
 */
export async function storeIdempotentResponse(
  key: string | null,
  status: number,
  body: unknown
): Promise<void> {
  if (!key) return;
  await storeResponseForKey(key, status, body);
}

/**
 * Wrap an API handler with idempotency support.
 */
export function withIdempotency(
  handler: (request: NextRequest, context?: unknown) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: unknown): Promise<NextResponse> => {
    const result = await handleIdempotency(request);

    if ('cached' in result) {
      return result.cached;
    }

    if ('error' in result) {
      return result.error;
    }

    const response = await handler(request, context);

    // Store the response for the idempotency key
    if (result.key) {
      try {
        const body = await response.clone().json();
        await storeIdempotentResponse(result.key, response.status, body);
      } catch {
        // Non-JSON response, store status only
        await storeIdempotentResponse(result.key, response.status, null);
      }
    }

    return response;
  };
}

