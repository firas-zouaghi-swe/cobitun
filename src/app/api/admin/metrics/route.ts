
/**
 * System Metrics API
 * GET - Prometheus-compatible metrics endpoint
 * Also provides Grafana-compatible JSON metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { db } from '@/lib/db';
import { Errors } from '@/middleware/validation';
import { getErrorStats } from '@/lib/error-tracking';

export async function GET(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  try {
    const url = new URL(request.url);
    const format = url.searchParams.get('format') || 'json';

    // Collect metrics
    const [
      totalUsers,
      activeUsers,
      totalCustomers,
      totalPolicies,
      activePolicies,
      totalClaims,
      pendingClaims,
      totalUploadedFiles,
      pendingNotifications,
      auditLogCount,
    ] = await Promise.all([
      db.user.count({ where: { isDeleted: 0 } }),
      db.userSession.count({ where: { revokedAt: null, expiresAt: { gte: new Date() } } }),
      db.customer.count({ where: { isDeleted: 0 } }),
      db.parametricPolicy.count({ where: { isDeleted: 0 } }),
      db.parametricPolicy.count({ where: { isDeleted: 0, status: { statusCode: 'ACTIVE' } } }),
      db.parametricClaim.count({ where: { isDeleted: 0 } }),
      db.parametricClaim.count({ where: { isDeleted: 0, status: { statusCode: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } } }),
      db.uploadedFile.count({ where: { isDeleted: 0 } }),
      db.notificationLog.count({ where: { status: 'SCHEDULED' } }),
      db.auditLog.count(),
    ]);

    const errorStats = getErrorStats();

    // Uptime
    const uptimeSeconds = process.uptime();

    // Memory usage
    const memUsage = process.memoryUsage();

    const metrics = {
      cobitun_users_total: totalUsers,
      cobitun_users_active: activeUsers,
      cobitun_customers_total: totalCustomers,
      cobitun_policies_total: totalPolicies,
      cobitun_policies_active: activePolicies,
      cobitun_claims_total: totalClaims,
      cobitun_claims_pending: pendingClaims,
      cobitun_files_total: totalUploadedFiles,
      cobitun_notifications_pending: pendingNotifications,
      cobitun_audit_logs_total: auditLogCount,
      cobitun_errors_total: errorStats.totalErrors,
      cobitun_error_rate_per_minute: errorStats.errorRate,
      cobitun_uptime_seconds: uptimeSeconds,
      cobitun_memory_rss_bytes: memUsage.rss,
      cobitun_memory_heap_used_bytes: memUsage.heapUsed,
      cobitun_memory_heap_total_bytes: memUsage.heapTotal,
      cobitun_memory_external_bytes: memUsage.external,
    };

    if (format === 'prometheus') {
      // Prometheus text format
      const lines: string[] = [
        '# HELP cobitun_users_total Total number of users',
        '# TYPE cobitun_users_total gauge',
        `cobitun_users_total ${totalUsers}`,
        '# HELP cobitun_users_active Number of active user sessions',
        '# TYPE cobitun_users_active gauge',
        `cobitun_users_active ${activeUsers}`,
        '# HELP cobitun_customers_total Total number of customers',
        '# TYPE cobitun_customers_total gauge',
        `cobitun_customers_total ${totalCustomers}`,
        '# HELP cobitun_policies_total Total number of policies',
        '# TYPE cobitun_policies_total gauge',
        `cobitun_policies_total ${totalPolicies}`,
        '# HELP cobitun_policies_active Number of active policies',
        '# TYPE cobitun_policies_active gauge',
        `cobitun_policies_active ${activePolicies}`,
        '# HELP cobitun_claims_total Total number of claims',
        '# TYPE cobitun_claims_total gauge',
        `cobitun_claims_total ${totalClaims}`,
        '# HELP cobitun_claims_pending Number of pending claims',
        '# TYPE cobitun_claims_pending gauge',
        `cobitun_claims_pending ${pendingClaims}`,
        '# HELP cobitun_errors_total Total number of errors',
        '# TYPE cobitun_errors_total counter',
        `cobitun_errors_total ${errorStats.totalErrors}`,
        '# HELP cobitun_error_rate_per_minute Error rate per minute',
        '# TYPE cobitun_error_rate_per_minute gauge',
        `cobitun_error_rate_per_minute ${errorStats.errorRate}`,
        '# HELP cobitun_uptime_seconds Application uptime in seconds',
        '# TYPE cobitun_uptime_seconds counter',
        `cobitun_uptime_seconds ${uptimeSeconds}`,
        '# HELP cobitun_memory_rss_bytes Process RSS memory in bytes',
        '# TYPE cobitun_memory_rss_bytes gauge',
        `cobitun_memory_rss_bytes ${memUsage.rss}`,
        '# HELP cobitun_memory_heap_used_bytes Heap memory used in bytes',
        '# TYPE cobitun_memory_heap_used_bytes gauge',
        `cobitun_memory_heap_used_bytes ${memUsage.heapUsed}`,
      ];

      return new NextResponse(lines.join('\\n'), {
        headers: { 'Content-Type': 'text/plain; version=0.0.4' },
      });
    }

    // Grafana JSON format
    return NextResponse.json({
      system: {
        uptime: uptimeSeconds,
        memory: {
          rss: memUsage.rss,
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          external: memUsage.external,
        },
      },
      business: metrics,
      errors: {
        total: errorStats.totalErrors,
        rate: errorStats.errorRate,
        byLevel: errorStats.errorsByLevel,
        byCategory: errorStats.errorsByCategory,
      },
      alerts: generateAlerts(metrics),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Metrics collection failed:', error);
    return Errors.internal();
  }
}

function generateAlerts(metrics: Record<string, number>): { level: string; message: string }[] {
  const alerts: { level: string; message: string }[] = [];

  if (metrics.cobitun_error_rate_per_minute > 5) {
    alerts.push({ level: 'critical', message: `High error rate: ${metrics.cobitun_error_rate_per_minute.toFixed(1)} errors/min` });
  }

  if (metrics.cobitun_memory_rss_bytes > 512 * 1024 * 1024) {
    alerts.push({ level: 'warning', message: `High memory usage: ${(metrics.cobitun_memory_rss_bytes / 1024 / 1024).toFixed(0)}MB` });
  }

  if (metrics.cobitun_notifications_pending > 100) {
    alerts.push({ level: 'warning', message: `${metrics.cobitun_notifications_pending} notifications pending in queue` });
  }

  if (metrics.cobitun_claims_pending > 50) {
    alerts.push({ level: 'info', message: `${metrics.cobitun_claims_pending} claims pending review` });
  }

  return alerts;
}


