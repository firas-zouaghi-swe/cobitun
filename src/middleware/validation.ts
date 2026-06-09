/**
 * Enhanced Validation Middleware
 * Combines Zod schema validation with input sanitization and standardized error responses.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ZodSchema, ZodError } from 'zod';
import { sanitizeObject, detectSuspiciousPatterns } from './sanitize';

/**
 * Standardized API error response format.
 */
export interface ApiError {
  error: string;
  code: string;
  timestamp?: string;
  details?: Array<{
    field: string;
    message: string;
    code: string;
  }>;
  requestId?: string;
}

/**
 * Create a standardized error response.
 */
export function errorResponse(
  message: string,
  code: string,
  status: number = 400,
  details?: ApiError['details']
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      code,
      details,
      timestamp: new Date().toISOString(),
    } satisfies ApiError,
    { status }
  );
}

/**
 * Validation error response from Zod error.
 */
export function validationErrorResponse(zodError: ZodError): NextResponse {
  const details = zodError.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));

  return errorResponse(
    'Validation failed',
    'VALIDATION_ERROR',
    400,
    details
  );
}

/**
 * Sanitize and validate a JSON request body.
 * Returns parsed data or a NextResponse error.
 */
export async function validateRequestBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>,
  options: { sanitize?: boolean; maxLength?: number; skipFields?: string[] } = {}
): Promise<{ data: T } | { error: NextResponse }> {
  const shouldSanitize = options.sanitize ?? true;

  try {
    let body = await request.json();

    // Sanitize input before validation
    if (shouldSanitize && typeof body === 'object' && body !== null) {
      body = sanitizeObject(body, {
        maxLength: options.maxLength,
        skipFields: options.skipFields,
      });

      // Check for suspicious patterns in string fields
      const bodyStr = JSON.stringify(body);
      const suspicious = detectSuspiciousPatterns(bodyStr);
      if (suspicious.length > 0) {
        return {
          error: errorResponse(
            'Input contains potentially malicious content',
            'SUSPICIOUS_INPUT',
            400,
            suspicious.map((s) => ({ field: 'body', message: `Detected: ${s}`, code: s }))
          ),
        };
      }
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return { error: validationErrorResponse(parsed.error) };
    }

    return { data: parsed.data };
  } catch (err) {
    return {
      error: errorResponse('Invalid JSON payload', 'INVALID_JSON', 400),
    };
  }
}

/**
 * Require authentication and return auth info or error response.
 */
export function requireAuth(request: NextRequest): { userId: string; role: string } | NextResponse {
  // This is a simplified version - the actual auth check is in auth-helper.ts
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return errorResponse('Authentication required', 'UNAUTHORIZED', 401);
  }
  return { userId: '', role: '' };
}

/**
 * Common error response helpers.
 */
export const Errors = {
  unauthorized: () => errorResponse('Authentication required', 'UNAUTHORIZED', 401),
  forbidden: (message = 'Insufficient permissions') => errorResponse(message, 'FORBIDDEN', 403),
  notFound: (entity = 'Resource') => errorResponse(`${entity} not found`, 'NOT_FOUND', 404),
  conflict: (message = 'Resource already exists') => errorResponse(message, 'CONFLICT', 409),
  rateLimited: () => errorResponse('Too many requests', 'RATE_LIMITED', 429),
  internal: (message = 'Internal server error') => errorResponse(message, 'INTERNAL_ERROR', 500),
  idempotencyConflict: () => errorResponse('Idempotency key already used with different payload', 'IDEMPOTENCY_CONFLICT', 409),
};

