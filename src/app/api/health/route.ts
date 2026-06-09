import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

interface HealthCheckResult {
  status: 'ok' | 'degraded' | 'down';
  latencyMs?: number;
  error?: string;
  details?: Record<string, unknown>;
}

async function checkDatabase(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch (error) {
    return { status: 'down', latencyMs: Date.now() - start, error: String(error) };
  }
}

async function checkRedis(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    // Check if Redis URL is configured
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      return {
        status: 'degraded',
        latencyMs: Date.now() - start,
        details: { message: 'Redis not configured - using in-memory fallback' },
      };
    }

    // Try to connect and ping Redis
    const response = await fetch(redisUrl.replace(/\/$/, '') + '/ping', {
      signal: AbortSignal.timeout(3000),
    });
    if (response.ok) {
      return { status: 'ok', latencyMs: Date.now() - start };
    }
    return { status: 'down', latencyMs: Date.now() - start, error: `Redis returned ${response.status}` };
  } catch (error) {
    return {
      status: 'degraded',
      latencyMs: Date.now() - start,
      error: String(error),
      details: { message: 'Redis unavailable - using in-memory fallback' },
    };
  }
}

async function checkIODAApi(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const iodaApiKey = process.env.IODA_API_KEY;
    const iodaBaseUrl = process.env.IODA_API_BASE_URL || 'https://api.internetoutageobservation.org';

    if (!iodaApiKey) {
      return {
        status: 'degraded',
        latencyMs: Date.now() - start,
        details: { message: 'IODA API key not configured' },
      };
    }

    // Try a lightweight IODA API call
    const response = await fetch(`${iodaBaseUrl}/api/v1/outages?limit=1`, {
      headers: { 'Authorization': `Bearer ${iodaApiKey}` },
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      return { status: 'ok', latencyMs: Date.now() - start };
    }
    return { status: 'down', latencyMs: Date.now() - start, error: `IODA API returned ${response.status}` };
  } catch (error) {
    return {
      status: 'degraded',
      latencyMs: Date.now() - start,
      error: String(error),
      details: { message: 'IODA API unreachable' },
    };
  }
}

export async function GET() {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    ioda: await checkIODAApi(),
  };

  // Determine overall status
  const statuses = Object.values(checks).map((c) => c.status);
  let overallStatus: 'ok' | 'degraded' | 'down' = 'ok';

  if (statuses.some((s) => s === 'down')) {
    // If database is down, overall is down; otherwise degraded
    overallStatus = checks.database.status === 'down' ? 'down' : 'degraded';
  } else if (statuses.some((s) => s === 'degraded')) {
    overallStatus = 'degraded';
  }

  const statusCode = overallStatus === 'down' ? 503 : overallStatus === 'degraded' ? 200 : 200;

  return NextResponse.json(
    {
      status: overallStatus,
      checks,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      version: process.env.APP_VERSION || '1.0.0',
    },
    { status: statusCode }
  );
}

