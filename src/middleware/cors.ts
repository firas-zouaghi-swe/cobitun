/**
 * CORS Middleware
 * Configurable Cross-Origin Resource Sharing with allowlist support.
 */

import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_ALLOWED_ORIGINS = process.env.NEXT_PUBLIC_APP_URL
  ? [process.env.NEXT_PUBLIC_APP_URL]
  : process.env.NODE_ENV === 'production'
  ? []
  : ['http://localhost:3000'];

const DEFAULT_ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
const DEFAULT_ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-CSRF-Token',
  'Idempotency-Key',
  'X-User-Id',
  'X-User-Role',
];
const DEFAULT_MAX_AGE = 86400; // 24 hours

export interface CorsConfig {
  allowedOrigins?: string[];
  allowedMethods?: string[];
  allowedHeaders?: string[];
  exposeHeaders?: string[];
  allowCredentials?: boolean;
  maxAge?: number;
}

export function createCorsMiddleware(config: CorsConfig = {}) {
  const allowedOrigins = config.allowedOrigins ?? DEFAULT_ALLOWED_ORIGINS;
  const allowedMethods = config.allowedMethods ?? DEFAULT_ALLOWED_METHODS;
  const allowedHeaders = config.allowedHeaders ?? DEFAULT_ALLOWED_HEADERS;
  const exposeHeaders = config.exposeHeaders ?? [];
  const allowCredentials = config.allowCredentials ?? true;
  const maxAge = config.maxAge ?? DEFAULT_MAX_AGE;

  return function handleCors(request: NextRequest): NextResponse | null {
    const origin = request.headers.get('origin');
    const method = request.method;

    // Handle preflight requests
    if (method === 'OPTIONS') {
      const isSameOrigin = origin === request.nextUrl.origin;
      if (!origin || (!allowedOrigins.includes(origin) && !isSameOrigin)) {
        return new NextResponse(null, { status: 403 });
      }

      const response = new NextResponse(null, { status: 204 });
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Methods', allowedMethods.join(', '));
      response.headers.set('Access-Control-Allow-Headers', allowedHeaders.join(', '));
      response.headers.set('Access-Control-Max-Age', String(maxAge));
      if (allowCredentials) {
        response.headers.set('Access-Control-Allow-Credentials', 'true');
      }
      if (exposeHeaders.length > 0) {
        response.headers.set('Access-Control-Expose-Headers', exposeHeaders.join(', '));
      }
      return response;
    }

    // For non-preflight requests, return null to continue processing
    // The response headers will be added by addCorsHeaders
    return null;
  };
}

export function addCorsHeaders(response: NextResponse, request: NextRequest, config: CorsConfig = {}): NextResponse {
  const allowedOrigins = config.allowedOrigins ?? DEFAULT_ALLOWED_ORIGINS;
  const allowCredentials = config.allowCredentials ?? true;
  const exposeHeaders = config.exposeHeaders ?? [];

  const origin = request.headers.get('origin');
  const isSameOrigin = origin === request.nextUrl.origin;
  if (origin && (allowedOrigins.includes(origin) || isSameOrigin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    if (allowCredentials) {
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    }
    if (exposeHeaders.length > 0) {
      response.headers.set('Access-Control-Expose-Headers', exposeHeaders.join(', '));
    }
  }
  return response;
}

// Default CORS middleware instance
export const corsMiddleware = createCorsMiddleware();

