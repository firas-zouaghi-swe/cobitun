/**
 * Rate Limiting Middleware
 * Simple in-memory rate limiter for API endpoints.
 * For production, consider using Redis-backed rate limiting.
 */

import { NextRequest, NextResponse } from 'next/server';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (resets on server restart)
const store = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt < now) {
        store.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

export interface RateLimitConfig {
  /** Maximum number of requests in the window */
  maxRequests: number;
  /** Time window in seconds */
  windowSeconds: number;
  /** Key generator function */
  keyGenerator?: (request: NextRequest) => string;
}

const DEFAULT_KEY_GENERATOR = (request: NextRequest): string => {
  // Prefer real client IP if available behind proxies.
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip')?.trim();
  if (ip) return ip;

  // Fallback to header fingerprinting when IP is unavailable in production.
  const userAgent = request.headers.get('user-agent')?.trim() || 'unknown-agent';
  const acceptLanguage = request.headers.get('accept-language')?.trim() || 'unknown-language';
  const host = request.headers.get('host')?.trim() || 'unknown-host';
  return `fallback:${userAgent}:${acceptLanguage}:${host}`;
};

// Pre-configured rate limits for different endpoint types
export const RateLimits = {
  /** Authentication endpoints: 10 requests per minute */
  auth: { maxRequests: 10, windowSeconds: 60 },
  /** Password reset: 3 requests per 15 minutes */
  passwordReset: { maxRequests: 3, windowSeconds: 900 },
  /** MFA endpoints: 5 requests per 15 minutes (prevent OTP brute-force) */
  mfa: { maxRequests: 5, windowSeconds: 900 },
  /** General API: 100 requests per minute */
  api: { maxRequests: 100, windowSeconds: 60 },
  /** File upload: 10 requests per minute */
  upload: { maxRequests: 10, windowSeconds: 60 },
  /** Financial operations: 20 requests per minute */
  financial: { maxRequests: 20, windowSeconds: 60 },
} as const;

/**
 * Check rate limit for a request.
 * Returns null if the request is allowed, or a NextResponse with 429 if rate limited.
 */
export function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): NextResponse | null {
  const keyGenerator = config.keyGenerator || DEFAULT_KEY_GENERATOR;
  const key = keyGenerator(request);
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;

  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    // No entry or expired window - start fresh
    store.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return null;
  }

  if (entry.count >= config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      {
        error: 'Too many requests',
        code: 'RATE_LIMITED',
        retryAfter,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(config.maxRequests),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(entry.resetAt / 1000)),
        },
      }
    );
  }

  // Increment counter
  entry.count += 1;
  store.set(key, entry);

  return null;
}

/**
 * Add rate limit headers to a response.
 */
export function addRateLimitHeaders(
  response: NextResponse,
  config: RateLimitConfig,
  request: NextRequest
): NextResponse {
  const keyGenerator = config.keyGenerator || DEFAULT_KEY_GENERATOR;
  const key = keyGenerator(request);
  const entry = store.get(key);

  if (entry) {
    response.headers.set('X-RateLimit-Limit', String(config.maxRequests));
    response.headers.set('X-RateLimit-Remaining', String(Math.max(0, config.maxRequests - entry.count)));
    response.headers.set('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));
  }

  return response;
}

