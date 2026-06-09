import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { httpsRedirect } from '@/middleware/https-redirect';
import { checkRateLimit, RateLimits } from '@/middleware/rate-limiter';

const ContentSecurityPolicy = "default-src 'self'; script-src 'self' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self';";

export function middleware(request: NextRequest) {
  // HTTPS redirect (production only)
  const redirect = httpsRedirect(request);
  if (redirect) return redirect;

  // Rate limiting for auth endpoints
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith('/api/auth/login') || pathname.startsWith('/api/auth/signup')) {
    const rateLimitResponse = checkRateLimit(request, RateLimits.auth);
    if (rateLimitResponse) return rateLimitResponse;
  } else if (pathname.startsWith('/api/auth/mfa/')) {
    const rateLimitResponse = checkRateLimit(request, RateLimits.mfa);
    if (rateLimitResponse) return rateLimitResponse;
  } else if (pathname.startsWith('/api/auth/forgot-password') || pathname.startsWith('/api/auth/reset-password')) {
    const rateLimitResponse = checkRateLimit(request, RateLimits.passwordReset);
    if (rateLimitResponse) return rateLimitResponse;
  } else if (pathname.startsWith('/api/')) {
    const rateLimitResponse = checkRateLimit(request, RateLimits.api);
    if (rateLimitResponse) return rateLimitResponse;
  }

  const response = NextResponse.next();

  // Security headers
  response.headers.set('Content-Security-Policy', ContentSecurityPolicy);
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('X-Permitted-Cross-Domain-Policies', 'none');
  response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  // CORS headers for API routes
  if (pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin');
    const allowedOrigins = [
      process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    ];
    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, Idempotency-Key');
      response.headers.set('Access-Control-Max-Age', '86400');
    }
  }

  return response;
}

export const config = {
  matcher: '/:path*',
};
