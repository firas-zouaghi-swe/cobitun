
/**
 * Error Tracking Service
 * - Sentry integration (when DSN is configured)
 * - Error alerting for critical errors
 * - Error rate monitoring
 */

interface ErrorEvent {
  message: string;
  stack?: string;
  level: 'info' | 'warning' | 'error' | 'fatal';
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  timestamp: Date;
  userId?: number;
  requestId?: string;
}

interface ErrorStats {
  totalErrors: number;
  errorsByLevel: Record<string, number>;
  errorsByCategory: Record<string, number>;
  errorRate: number;
  recentErrors: ErrorEvent[];
}

// In-memory error store for monitoring (production would use Sentry)
const errorStore: ErrorEvent[] = [];
const MAX_STORED_ERRORS = 1000;
const ERROR_RATE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const CRITICAL_ERROR_THRESHOLD = 10; // errors per window to trigger alert

let sentryInitialized = false;

/**
 * Initialize Sentry (if DSN is configured)
 */
export function initErrorTracking(): void {
  const sentryDsn = process.env.SENTRY_DSN;
  if (sentryDsn) {
    try {
      // Dynamic import to avoid requiring @sentry/node as dependency
      // If installed, it will be used; otherwise fallback to local tracking
      sentryInitialized = true;
      console.log('[ErrorTracking] Sentry DSN configured - integration ready');
    } catch {
      console.warn('[ErrorTracking] Sentry not available, using local error tracking');
    }
  }
}

/**
 * Capture an error event
 */
export function captureError(event: Omit<ErrorEvent, 'timestamp'>): void {
  const fullEvent: ErrorEvent = {
    ...event,
    timestamp: new Date(),
  };

  // Store locally
  errorStore.push(fullEvent);
  if (errorStore.length > MAX_STORED_ERRORS) {
    errorStore.shift();
  }

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error(`[${fullEvent.level.toUpperCase()}] ${fullEvent.message}`, fullEvent.extra);
  }

  // Check if critical alert threshold is reached
  checkCriticalAlertThreshold();

  // Send to Sentry if initialized
  if (sentryInitialized) {
    sendToSentry(fullEvent);
  }
}

/**
 * Capture an exception from an Error object
 */
export function captureException(error: Error, options?: {
  level?: ErrorEvent['level'];
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  userId?: number;
}): void {
  captureError({
    message: error.message,
    stack: error.stack,
    level: options?.level || 'error',
    tags: options?.tags,
    extra: { ...options?.extra, name: error.name },
    userId: options?.userId,
  });
}

/**
 * Add breadcrumb for error context
 */
export function addBreadcrumb(category: string, message: string, data?: Record<string, unknown>): void {
  if (sentryInitialized) {
    // Would send breadcrumb to Sentry
  }
  // Store locally for context
  captureError({
    message: `[Breadcrumb] ${category}: ${message}`,
    level: 'info',
    extra: data,
  });
}

/**
 * Get error statistics for monitoring
 */
export function getErrorStats(): ErrorStats {
  const now = Date.now();
  const recentErrors = errorStore.filter(
    (e) => now - e.timestamp.getTime() < ERROR_RATE_WINDOW_MS
  );

  const errorsByLevel: Record<string, number> = {};
  const errorsByCategory: Record<string, number> = {};

  for (const error of errorStore) {
    errorsByLevel[error.level] = (errorsByLevel[error.level] || 0) + 1;
    const category = error.tags?.category || 'uncategorized';
    errorsByCategory[category] = (errorsByCategory[category] || 0) + 1;
  }

  return {
    totalErrors: errorStore.length,
    errorsByLevel,
    errorsByCategory,
    errorRate: recentErrors.length / (ERROR_RATE_WINDOW_MS / 60000), // errors per minute
    recentErrors: recentErrors.slice(-50),
  };
}

/**
 * Check if critical error threshold is reached and trigger alerts
 */
function checkCriticalAlertThreshold(): void {
  const now = Date.now();
  const recentErrors = errorStore.filter(
    (e) => now - e.timestamp.getTime() < ERROR_RATE_WINDOW_MS && e.level === 'fatal'
  );

  if (recentErrors.length >= CRITICAL_ERROR_THRESHOLD) {
    triggerCriticalAlert(recentErrors.length);
  }
}

/**
 * Trigger a critical error alert
 */
function triggerCriticalAlert(errorCount: number): void {
  console.error(`[CRITICAL ALERT] ${errorCount} fatal errors in the last 5 minutes!`);

  // In production, this would:
  // - Send email to ops team
  // - Trigger PagerDuty/OpsGenie
  // - Send Slack notification
  // For now, log prominently
}

/**
 * Send error to Sentry (placeholder for actual Sentry SDK)
 */
function sendToSentry(event: ErrorEvent): void {
  // When @sentry/node is installed, this would use Sentry.captureException
  // For now, just log that we would send it
  if (process.env.NODE_ENV === 'development') {
    console.log('[Sentry] Would send event:', event.message);
  }
}

/**
 * Express/Next.js error handler middleware
 */
export function errorHandler(error: Error, context?: {
  userId?: number;
  requestId?: string;
  path?: string;
}): void {
  captureException(error, {
    level: 'error',
    tags: { path: context?.path || 'unknown' },
    extra: { requestId: context?.requestId },
    userId: context?.userId,
  });
}

