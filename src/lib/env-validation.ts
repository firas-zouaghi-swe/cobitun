/**
 * Environment Variable Validation
 * Ensures all required secrets and configurations are properly set for production
 */

// Define required environment variables by environment
const REQUIRED_PROD_VARS = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'CSRF_SECRET',
  'PRESIGNED_URL_SECRET',
  'ENCRYPTION_KEY',
  'DATABASE_URL',
  'FRONTEND_URL',
  'NEXT_PUBLIC_APP_URL',
];

const REQUIRED_DEV_VARS = [
  'DATABASE_URL',
];

const WARNING_VARS = [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
];

/**
 * Validate environment variables at application startup
 * Throws error if critical variables are missing in production
 */
export function validateEnvironment(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const requiredVars = isProduction ? REQUIRED_PROD_VARS : REQUIRED_DEV_VARS;

  const missing: string[] = [];
  const empty: string[] = [];

  for (const varName of requiredVars) {
    const value = process.env[varName];
    if (value === undefined || value === null) {
      missing.push(varName);
    } else if (value.trim() === '') {
      empty.push(varName);
    }
  }

  // Check for hardcoded dev values that shouldn't be in production
  const devDefaults: Record<string, string> = {
    'JWT_SECRET': 'dev-jwt-secret',
    'PRESIGNED_URL_SECRET': 'dev-presigned-secret',
    'CSRF_SECRET': 'dev-csrf-secret',
  };

  for (const [varName, devValue] of Object.entries(devDefaults)) {
    if (isProduction && process.env[varName] === devValue) {
      missing.push(`${varName} (using insecure development value in production!)`);
    }
  }

  if (missing.length > 0 || empty.length > 0) {
    const errors = [];
    if (missing.length > 0) {
      errors.push(`Missing environment variables: ${missing.join(', ')}`);
    }
    if (empty.length > 0) {
      errors.push(`Empty environment variables: ${empty.join(', ')}`);
    }
    
    const message = `${isProduction ? '[PRODUCTION] ' : ''}Environment validation failed:\n${errors.join('\n')}`;
    console.error(message);
    
    if (isProduction) {
      throw new Error(message);
    }
  }

  // Warn about optional but important variables
  if (isProduction) {
    for (const varName of WARNING_VARS) {
      if (!process.env[varName]) {
        console.warn(`[WARNING] Optional environment variable not set: ${varName}`);
      }
    }
  }

  console.log('[Environment] Validation completed successfully');
}

/**
 * Check if we're in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/**
 * Check if we're in production mode
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export default { validateEnvironment, isDevelopment, isProduction };
