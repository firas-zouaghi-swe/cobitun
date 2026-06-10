
/**
 * FAQ/Knowledge Base API
 * GET    - List FAQs (public) / Admin CRUD
 * POST   - Create FAQ (admin)
 * PATCH  - Update FAQ (admin)
 * DELETE - Delete FAQ (admin)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { db } from '@/lib/db';
import { Errors, errorResponse, validateRequestBody } from '@/middleware/validation';
import { z } from 'zod';
import { logAction } from '@/lib/services/audit-service';

const faqSchema = z.object({
  question: z.string().min(5).max(500),
  answer: z.string().min(10).max(5000),
  category: z.enum(['general', 'policy', 'claim', 'payment', 'technical', 'ioda']).default('general'),
  sortOrder: z.number().int().min(0).default(0),
  isPublished: z.boolean().default(true),
  language: z.enum(['en', 'fr', 'ar']).default('en'),
});

const updateFaqSchema = z.object({
  id: z.number().int().positive(),
  question: z.string().min(5).max(500).optional(),
  answer: z.string().min(10).max(5000).optional(),
  category: z.enum(['general', 'policy', 'claim', 'payment', 'technical', 'ioda']).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isPublished: z.boolean().optional(),
  language: z.enum(['en', 'fr', 'ar']).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const language = url.searchParams.get('language') || 'en';
    const search = url.searchParams.get('q');
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));

    const auth = await getAuthInfo(request);
    const isAdmin = auth && (auth.role === 'ADMIN' || auth.role === 'SUPER_ADMIN');

    const where: Record<string, unknown> = {};
    if (!isAdmin) where.isPublished = 1; // Public only sees published
    if (category) where.category = category;
    if (language) where.language = language;

    if (search) {
      where.OR = [
        { question: { contains: search } },
        { answer: { contains: search } },
      ];
    }

    // Use system settings for FAQ storage
    const faqSettings = await db.systemSetting.findMany({
      where: {
        settingKey: { contains: 'faq_' },
        isCurrent: 1,
        ...(category ? { category: `faq_${category}` } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });

    let faqs = faqSettings.map((s) => {
      try {
        return { id: s.id, ...JSON.parse(s.settingValue) };
      } catch {
        return { id: s.id, error: 'Invalid' };
      }
    });

    if (search) {
      faqs = faqs.filter((f: Record<string, unknown>) =>
        String(f.question || '').toLowerCase().includes(search!.toLowerCase()) ||
        String(f.answer || '').toLowerCase().includes(search!.toLowerCase())
      );
    }

    if (!isAdmin) {
      faqs = faqs.filter((f: Record<string, unknown>) => f.isPublished !== false);
    }

    // Group by category
    const grouped: Record<string, unknown[]> = {};
    for (const faq of faqs) {
      const cat = (faq as Record<string, unknown>).category || 'general';
      if (!grouped[cat as string]) grouped[cat as string] = [];
      grouped[cat as string].push(faq);
    }

    return NextResponse.json({
      faqs,
      grouped,
      total: faqs.length,
    });
  } catch (error) {
    return Errors.internal();
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  const result = await validateRequestBody(request, faqSchema);
  if ('error' in result) return result.error;

  try {
    const faq = result.data;
    const settingKey = `faq_${faq.category}_${Date.now()}`;

    const setting = await db.systemSetting.create({
      data: {
        settingKey,
        settingValue: JSON.stringify(faq),
        valueType: 'JSON',
        isEditable: 1,
        category: `faq_${faq.category}`,
        description: `FAQ: ${faq.question.substring(0, 50)}...`,
        isCurrent: 1,
        version: 1,
      },
    });

    await logAction({
      entityType: 'SystemSetting',
      entityId: setting.id,
      action: 'CREATE_FAQ',
      actorId: auth.userIdNum,
      actorType: auth.role,
      metadata: { category: faq.category, question: faq.question.substring(0, 50) },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json({ faq: { id: setting.id, ...faq } }, { status: 201 });
  } catch (error) {

    return Errors.internal();
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  const result = await validateRequestBody(request, updateFaqSchema);
  if ('error' in result) return result.error;

  try {
    const { id, ...updates } = result.data;

    const existing = await db.systemSetting.findFirst({ where: { id } });
    if (!existing) return Errors.notFound('FAQ');

    const currentFaq = JSON.parse(existing.settingValue);
    const updatedFaq = { ...currentFaq, ...updates };

    await db.systemSetting.update({
      where: { id },
      data: {
        settingValue: JSON.stringify(updatedFaq),
        updatedAt: new Date(),
      },
    });

    await logAction({
      entityType: 'SystemSetting',
      entityId: id,
      action: 'UPDATE_FAQ',
      actorId: auth.userIdNum,
      actorType: auth.role,
      metadata: { updatedFields: Object.keys(updates) },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json({ faq: { id, ...updatedFaq } });
  } catch (error) {
    return Errors.internal();
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  try {
    const url = new URL(request.url);
    const id = parseInt(url.searchParams.get('id') || '0', 10);

    const existing = await db.systemSetting.findFirst({ where: { id } });
    if (!existing) return Errors.notFound('FAQ');

    await db.systemSetting.update({
      where: { id },
      data: { isCurrent: 0, validTo: new Date() },
    });

    await logAction({
      entityType: 'SystemSetting',
      entityId: id,
      action: 'DELETE_FAQ',
      actorId: auth.userIdNum,
      actorType: auth.role,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json({ message: 'FAQ deleted' });
  } catch (error) {
    return Errors.internal();
  }
}

