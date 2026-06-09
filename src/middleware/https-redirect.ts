/**
 * HTTPS Redirect Middleware
 * Enforces TLS 1.3 and redirects HTTP to HTTPS in production.
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Check if the request is using HTTPS.
 */
export function isHttps(request: NextRequest): boolean {
  const forwardedProto = request.headers.get('x-forwarded-proto');
  if (forwardedProto) {
    return forwardedProto.toLowerCase() === 'https';
  }
  return request.nextUrl.protocol === 'https:';
}

/**
 * Redirect HTTP requests to HTTPS in production.
 * Returns null if no redirect is needed.
 */
export function httpsRedirect(request: NextRequest): NextResponse | null {
  // Only enforce in production
  if (process.env.NODE_ENV !== 'production') {
    return null;
  }

  // Skip for health checks and internal requests
  if (request.nextUrl.pathname.startsWith('/api/health')) {
    return null;
  }

  if (!isHttps(request)) {
    const httpsUrl = request.nextUrl.clone();
    httpsUrl.protocol = 'https:';
    return NextResponse.redirect(httpsUrl, 301);
  }

  return null;
}

/**
 * Add HSTS header to response (HTTP Strict Transport Security).
 * Tells browsers to only use HTTPS for future requests.
 */
export function addHstsHeader(response: NextResponse): NextResponse {
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    );
  }
  return response;
}

