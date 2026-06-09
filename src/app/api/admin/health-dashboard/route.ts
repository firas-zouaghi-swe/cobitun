
/**
 * Health Dashboard API
 * GET - System health display (database, Redis, IODA), queue depth, error rate, IODA connectivity
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
    // Database health
    const dbStart = Date.now();
    let dbStatus = 'ok';
    let dbLatency = 0;
    try {
      await db.$queryRaw`SELECT 1`;
      dbLatency = Date.now() - dbStart;
    } catch {
      dbStatus = 'down';
      dbLatency = Date.now() - dbStart;
    }

    // Redis health
    let redisStatus = 'not_configured';
    let redisLatency = 0;
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      const redisStart = Date.now();
      try {
        const response = await fetch(redisUrl.replace(/\/$/, '') + '/ping', {
          signal: AbortSignal.timeout(3000),
        });
        redisLatency = Date.now() - redisStart;
        redisStatus = response.ok ? 'ok' : 'down';
      } catch {
        redisLatency = Date.now() - redisStart;
        redisStatus = 'down';
      }
    }

    // IODA health
    let iodaStatus = 'not_configured';
    let iodaLatency = 0;
    const iodaApiKey = process.env.IODA_API_KEY;
    if (iodaApiKey) {
      const iodaStart = Date.now();
      try {
        const iodaBaseUrl = process.env.IODA_API_BASE_URL || 'https://api.internetoutageobservation.org';
        const response = await fetch(`${iodaBaseUrl}/api/v1/outages?limit=1`, {
          headers: { 'Authorization': `Bearer ${iodaApiKey}` },
          signal: AbortSignal.timeout(5000),
        });
        iodaLatency = Date.now() - iodaStart;
        iodaStatus = response.ok ? 'ok' : 'degraded';
      } catch {
        iodaLatency = Date.now() - iodaStart;
        iodaStatus = 'down';
      }
    }

    // Queue depth (from notification queue)
    const pendingNotifications = await db.notificationLog.count({
      where: { status: 'SCHEDULED' },
    });

    // Error rate
    const errorStats = getErrorStats();

    // System metrics
    const activePolicies = await db.parametricPolicy.count({
      where: { isDeleted: 0, status: { statusCode: 'ACTIVE' } },
    });

    const pendingClaims = await db.parametricClaim.count({
      where: { isDeleted: 0, status: { statusCode: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } },
    });

    const activeUsers = await db.userSession.count({
      where: { revokedAt: null, expiresAt: { gte: new Date() } },
    });

    return NextResponse.json({
      status: dbStatus === 'ok' ? 'healthy' : 'unhealthy',
      services: {
        database: { status: dbStatus, latencyMs: dbLatency },
        redis: { status: redisStatus, latencyMs: redisLatency },
        ioda: { status: iodaStatus, latencyMs: iodaLatency },
      },
      metrics: {
        queueDepth: pendingNotifications,
        errorRate: errorStats.errorRate,
        totalErrors: errorStats.totalErrors,
        activePolicies,
        pendingClaims,
        activeUsers,
      },
      errorStats: {
        byLevel: errorStats.errorsByLevel,
        byCategory: errorStats.errorsByCategory,
        recentErrors: errorStats.recentErrors.slice(-10).map((e) => ({
          message: e.message,
          level: e.level,
          timestamp: e.timestamp.toISOString(),
        })),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Health dashboard failed:', error);
    return Errors.internal();
  }
}


