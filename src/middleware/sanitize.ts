/**
 * Input Sanitization Middleware
 * Sanitizes string inputs to prevent XSS, SQL injection, and other injection attacks.
 */

/**
 * Strip HTML tags from a string to prevent XSS.
 */
export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

/**
 * Escape HTML entities to prevent XSS in rendered output.
 */
export function escapeHtml(input: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#96;',
  };
  return input.replace(/[&<>"'\/`]/g, (char) => map[char] || char);
}

/**
 * Remove null bytes and control characters from a string.
 */
export function stripControlChars(input: string): string {
  // eslint-disable-next-line no-control-regex
  return input.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
}

/**
 * Normalize whitespace: trim and collapse multiple spaces.
 */
export function normalizeWhitespace(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}

/**
 * Sanitize a single string value by applying all sanitization steps.
 */
export function sanitizeString(input: string, options: { allowHtml?: boolean; maxLength?: number } = {}): string {
  if (typeof input !== 'string') return input;

  let result = stripControlChars(input);

  if (!options.allowHtml) {
    result = stripHtml(result);
  }

  result = normalizeWhitespace(result);

  if (options.maxLength && result.length > options.maxLength) {
    result = result.substring(0, options.maxLength);
  }

  return result;
}

/**
 * Recursively sanitize all string values in an object.
 * Preserves non-string values (numbers, booleans, null, arrays).
 */
export function sanitizeObject<T>(obj: T, options: { allowHtml?: boolean; maxLength?: number; skipFields?: string[] } = {}): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return sanitizeString(obj, options) as unknown as T;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((item) => sanitizeObject(item, options)) as unknown as T;

  const skipFields = options.skipFields ?? ['password', 'passwordHash', 'passwordSalt', 'tokenHash', 'refreshTokenHash', 'preAuthToken'];
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (skipFields.includes(key)) {
      result[key] = value;
    } else if (typeof value === 'string') {
      result[key] = sanitizeString(value, options);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) => sanitizeObject(item, options));
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeObject(value, options);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

/**
 * Validate that a string doesn't contain suspicious patterns.
 * Returns an array of detected issues.
 */
export function detectSuspiciousPatterns(input: string): string[] {
  const issues: string[] = [];

  // SQL injection patterns
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|EXEC)\b.*\b(FROM|INTO|SET|WHERE|TABLE|PROCEDURE)\b)/i,
    /(--|;|\/\*|\*\/|xp_|sp_)/i,
    /(\bOR\b\s+1\s*=\s*1)/i,
    /(\bAND\b\s+1\s*=\s*1)/i,
  ];

  // XSS patterns
  const xssPatterns = [
    /<script[^>]*>[\s\S]*?<\/script>/gi,
    /javascript\s*:/gi,
    /on\w+\s*=/gi,
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
    /<form/gi,
  ];

  // Path traversal patterns
  const pathTraversalPatterns = [
    /\.\.\//g,
    /\.\.\\/g,
    /%2e%2e%2f/gi,
    /%2e%2e\//gi,
  ];

  for (const pattern of sqlPatterns) {
    if (pattern.test(input)) {
      issues.push('SQL_INJECTION_PATTERN');
      break;
    }
  }

  for (const pattern of xssPatterns) {
    if (pattern.test(input)) {
      issues.push('XSS_PATTERN');
      break;
    }
  }

  for (const pattern of pathTraversalPatterns) {
    if (pattern.test(input)) {
      issues.push('PATH_TRAVERSAL_PATTERN');
      break;
    }
  }

  return issues;
}

