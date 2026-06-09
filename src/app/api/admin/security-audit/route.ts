
/**
 * Security Audit API
 * GET - Run automated security audit checks
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { Errors } from '@/middleware/validation';
import { runSecurityAudit } from '@/lib/security-testing';

export async function GET(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  try {
    const results = await runSecurityAudit();

    const summary = {
      total: results.length,
      passed: results.filter((r) => r.status === 'pass').length,
      failed: results.filter((r) => r.status === 'fail').length,
      warnings: results.filter((r) => r.status === 'warning').length,
    };

    return NextResponse.json({
      audit: results,
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Security audit failed:', error);
    return Errors.internal();
  }
}


