
/**
 * Customer Surveys & Analytics API
 * GET  - Get survey results / analytics metrics
 * POST - Submit survey response
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { db } from '@/lib/db';
import { Errors, errorResponse, validateRequestBody } from '@/middleware/validation';
import { z } from 'zod';
import { logAction } from '@/lib/services/audit-service';

const surveySchema = z.object({
  type: z.enum(['post_claim', 'post_payout', 'general']),
  referenceId: z.number().int().positive().optional(),
  rating: z.number().int().min(1).max(5),
  wouldRecommend: z.boolean().optional(),
  feedback: z.string().max(2000).optional(),
  categories: z.object({
    easeOfUse: z.number().int().min(1).max(5).optional(),
    communication: z.number().int().min(1).max(5).optional(),
    speed: z.number().int().min(1).max(5).optional(),
    fairness: z.number().int().min(1).max(5).optional(),
  }).optional(),
});

export async function GET(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'analytics';

    if (action === 'surveys') {
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
      const type = url.searchParams.get('type');

      const where: Record<string, unknown> = {};
      if (type) where.settingKey = { contains: `survey_${type}_` };

      const surveys = await db.systemSetting.findMany({
        where: { settingKey: { contains: 'survey_' }, isCurrent: 1, ...where },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      });

      return NextResponse.json({
        surveys: surveys.map((s) => {
          try { return { id: s.id, ...JSON.parse(s.settingValue) }; }
          catch { return { id: s.id, error: 'Invalid' }; }
        }),
      });
    }

    // Analytics dashboard
    const customers = await db.customer.findMany({ where: { isDeleted: 0 } });
    const policies = await db.parametricPolicy.findMany({ where: { isDeleted: 0 } });
    const claims = await db.parametricClaim.findMany({ where: { isDeleted: 0 } });

    // Customer acquisition metrics
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const newCustomersThisMonth = customers.filter((c) => c.createdAt && new Date(c.createdAt) >= thisMonth).length;
    const newCustomersLastMonth = customers.filter((c) => c.createdAt && new Date(c.createdAt) >= lastMonth && new Date(c.createdAt) < thisMonth).length;

    // Retention metrics
    const activePolicies = policies.filter((p) => p.statusId).length;
    const cancelledPolicies = policies.filter((p) => p.cancellationReason).length;
    const retentionRate = policies.length > 0 ? ((policies.length - cancelledPolicies) / policies.length) * 100 : 100;

    // Churn rate
    const churnRate = policies.length > 0 ? (cancelledPolicies / policies.length) * 100 : 0;

    // Lifetime value
    const totalPremium = policies.reduce((sum, p) => sum + Number(p.finalPremium || 0), 0);
    const avgPremiumPerCustomer = customers.length > 0 ? totalPremium / customers.length : 0;
    // TODO: Calculate from actual policy duration data
    const AVG_POLICY_DURATION_YEARS = 1; // Placeholder
    const ltv = avgPremiumPerCustomer * AVG_POLICY_DURATION_YEARS;

    // NPS calculation from surveys
    const surveySettings = await db.systemSetting.findMany({
      where: { settingKey: { contains: 'survey_' }, isCurrent: 1 },
    });

    const surveyResponses = surveySettings.map((s) => {
      try { return JSON.parse(s.settingValue); }
      catch { return null; }
    }).filter(Boolean);

    const promoters = surveyResponses.filter((s: Record<string, unknown>) => Number(s.rating) >= 4).length;
    const detractors = surveyResponses.filter((s: Record<string, unknown>) => Number(s.rating) <= 2).length;
    const nps = surveyResponses.length > 0 ? ((promoters - detractors) / surveyResponses.length) * 100 : 0;

    // Average satisfaction
    const avgRating = surveyResponses.length > 0
      ? surveyResponses.reduce((sum: number, s: Record<string, unknown>) => sum + Number(s.rating || 0), 0) / surveyResponses.length
      : 0;

    return NextResponse.json({
      acquisition: {
        totalCustomers: customers.length,
        newThisMonth: newCustomersThisMonth,
        newLastMonth: newCustomersLastMonth,
        growthRate: newCustomersLastMonth > 0 ? ((newCustomersThisMonth - newCustomersLastMonth) / newCustomersLastMonth) * 100 : 0,
      },
      retention: {
        totalPolicies: policies.length,
        activePolicies,
        cancelledPolicies,
        retentionRate: Math.round(retentionRate * 100) / 100,
        churnRate: Math.round(churnRate * 100) / 100,
      },
      financial: {
        totalPremiumRevenue: totalPremium,
        avgPremiumPerCustomer: Math.round(avgPremiumPerCustomer * 100) / 100,
        lifetimeValue: Math.round(ltv * 100) / 100,
      },
      satisfaction: {
        totalSurveys: surveyResponses.length,
        averageRating: Math.round(avgRating * 100) / 100,
        nps: Math.round(nps),
        promoters,
        detractors,
      },
    });
  } catch (error) {
    console.error('Analytics failed:', error);
    return Errors.internal();
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();

  const result = await validateRequestBody(request, surveySchema);
  if ('error' in result) return result.error;

  try {
    const survey = result.data;
    const settingKey = `survey_${survey.type}_${Date.now()}`;

    const setting = await db.systemSetting.create({
      data: {
        settingKey,
        settingValue: JSON.stringify({
          ...survey,
          customerId: auth.userIdNum,
          submittedAt: new Date().toISOString(),
        }),
        valueType: 'JSON',
        isEditable: 0,
        category: 'survey',
        description: `Survey: ${survey.type}`,
        isCurrent: 1,
        version: 1,
      },
    });

    await logAction({
      entityType: 'SystemSetting',
      entityId: setting.id,
      action: 'SUBMIT_SURVEY',
      actorId: auth.userIdNum,
      actorType: auth.role,
      metadata: { type: survey.type, rating: survey.rating },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json({
      message: 'Survey submitted successfully',
      surveyId: setting.id,
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to submit survey:', error);
    return Errors.internal();
  }
}

