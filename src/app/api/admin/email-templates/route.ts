
/**
 * Email Templates API
 * GET    - List email templates
 * POST   - Create email template
 * PATCH  - Update email template
 * DELETE - Delete email template
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { db } from '@/lib/db';
import { Errors, errorResponse, validateRequestBody } from '@/middleware/validation';
import { z } from 'zod';
import { logAction } from '@/lib/services/audit-service';

const templateSchema = z.object({
  code: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  subject: z.string().min(1).max(500),
  htmlBody: z.string().min(1),
  textBody: z.string().optional(),
  category: z.enum(['auth', 'policy', 'claim', 'payment', 'general']).default('general'),
  language: z.enum(['en', 'fr', 'ar']).default('en'),
  variables: z.array(z.string()).default([]),
});

const updateTemplateSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(200).optional(),
  subject: z.string().min(1).max(500).optional(),
  htmlBody: z.string().min(1).optional(),
  textBody: z.string().optional(),
  category: z.enum(['auth', 'policy', 'claim', 'payment', 'general']).optional(),
  language: z.enum(['en', 'fr', 'ar']).optional(),
  variables: z.array(z.string()).optional(),
});

// Default templates
const DEFAULT_TEMPLATES = [
  {
    code: 'welcome',
    name: 'Welcome Email',
    subject: 'Welcome to COBITUN - {{companyName}}',
    htmlBody: '<h1>Welcome to COBITUN!</h1><p>Dear {{firstName}},</p><p>Your account has been created successfully.</p>',
    category: 'auth',
    language: 'en',
    variables: ['firstName', 'companyName'],
  },
  {
    code: 'email_verification',
    name: 'Email Verification',
    subject: 'Verify your email - COBITUN',
    htmlBody: '<h1>Verify Your Email</h1><p>Click <a href="{{verificationLink}}">here</a> to verify your email address.</p><p>This link expires in 24 hours.</p>',
    category: 'auth',
    language: 'en',
    variables: ['verificationLink'],
  },
  {
    code: 'password_reset',
    name: 'Password Reset',
    subject: 'Reset your password - COBITUN',
    htmlBody: '<h1>Password Reset Request</h1><p>Click <a href="{{resetLink}}">here</a> to reset your password.</p><p>This link expires in 1 hour.</p>',
    category: 'auth',
    language: 'en',
    variables: ['resetLink'],
  },
  {
    code: 'policy_approved',
    name: 'Policy Approved',
    subject: 'Your policy has been approved - {{policyNumber}}',
    htmlBody: '<h1>Policy Approved</h1><p>Your policy {{policyNumber}} has been approved.</p><p>Premium: {{premiumAmount}} TND</p>',
    category: 'policy',
    language: 'en',
    variables: ['policyNumber', 'premiumAmount'],
  },
  {
    code: 'claim_update',
    name: 'Claim Status Update',
    subject: 'Claim update - {{claimNumber}}',
    htmlBody: '<h1>Claim Update</h1><p>Your claim {{claimNumber}} status has been updated to: {{status}}</p>',
    category: 'claim',
    language: 'en',
    variables: ['claimNumber', 'status'],
  },
  {
    code: 'payment_confirmation',
    name: 'Payment Confirmation',
    subject: 'Payment confirmed - {{policyNumber}}',
    htmlBody: '<h1>Payment Confirmed</h1><p>Payment of {{amount}} TND for policy {{policyNumber}} has been confirmed.</p>',
    category: 'payment',
    language: 'en',
    variables: ['policyNumber', 'amount'],
  },
];

export async function GET(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  try {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const language = url.searchParams.get('language');
    const preview = url.searchParams.get('preview'); // Template code to preview

    // If preview requested, return rendered template
    if (preview) {
      const template = await db.systemSetting.findFirst({
        where: { settingKey: `email_template_${preview}`, isCurrent: 1 },
      });
      if (!template) return Errors.notFound('Template');
      return NextResponse.json({ template: JSON.parse(template.settingValue) });
    }

    // List templates from system settings
    const where: Record<string, unknown> = {
      settingKey: { contains: 'email_template_' },
      isCurrent: 1,
    };

    const settings = await db.systemSetting.findMany({ where, orderBy: { settingKey: 'asc' } });

    let templates = settings.map((s) => {
      try {
        return JSON.parse(s.settingValue);
      } catch {
        return { code: s.settingKey, error: 'Invalid JSON' };
      }
    });

    if (category) templates = templates.filter((t: Record<string, unknown>) => t.category === category);
    if (language) templates = templates.filter((t: Record<string, unknown>) => t.language === language);

    // Include defaults if no custom templates exist
    if (templates.length === 0) {
      templates = DEFAULT_TEMPLATES;
    }

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Failed to list email templates:', error);
    return Errors.internal();
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  const result = await validateRequestBody(request, templateSchema);
  if ('error' in result) return result.error;

  try {
    const template = result.data;
    const settingKey = `email_template_${template.code}_${template.language}`;

    // Check if template already exists
    const existing = await db.systemSetting.findFirst({
      where: { settingKey, isCurrent: 1 },
    });

    if (existing) {
      return errorResponse('Template with this code and language already exists', 'CONFLICT', 409);
    }

    await db.systemSetting.create({
      data: {
        settingKey,
        settingValue: JSON.stringify(template),
        valueType: 'JSON',
        isEditable: 1,
        category: 'email_template',
        description: `Email template: ${template.name}`,
        isCurrent: 1,
        version: 1,
      },
    });

    await logAction({
      entityType: 'SystemSetting',
      entityId: 0,
      action: 'CREATE_EMAIL_TEMPLATE',
      actorId: auth.userIdNum,
      actorType: auth.role,
      metadata: { code: template.code, language: template.language },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json({ message: 'Template created', template }, { status: 201 });
  } catch (error) {
    console.error('Failed to create email template:', error);
    return Errors.internal();
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  const result = await validateRequestBody(request, updateTemplateSchema);
  if ('error' in result) return result.error;

  try {
    const { id, ...updates } = result.data;

    const existing = await db.systemSetting.findFirst({ where: { id } });
    if (!existing) return Errors.notFound('Template');

    const currentTemplate = JSON.parse(existing.settingValue);
    const updatedTemplate = { ...currentTemplate, ...updates };

    await db.systemSetting.update({
      where: { id },
      data: {
        settingValue: JSON.stringify(updatedTemplate),
        updatedAt: new Date(),
      },
    });

    await logAction({
      entityType: 'SystemSetting',
      entityId: id,
      action: 'UPDATE_EMAIL_TEMPLATE',
      actorId: auth.userIdNum,
      actorType: auth.role,
      metadata: { code: updatedTemplate.code, updatedFields: Object.keys(updates) },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json({ message: 'Template updated', template: updatedTemplate });
  } catch (error) {
    console.error('Failed to update email template:', error);
    return Errors.internal();
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  try {
    const url = new URL(request.url);
    const id = parseInt(url.searchParams.get('id') || '0', 10);

    const existing = await db.systemSetting.findFirst({ where: { id } });
    if (!existing) return Errors.notFound('Template');

    await db.systemSetting.update({
      where: { id },
      data: { isCurrent: 0, validTo: new Date() },
    });

    await logAction({
      entityType: 'SystemSetting',
      entityId: id,
      action: 'DELETE_EMAIL_TEMPLATE',
      actorId: auth.userIdNum,
      actorType: auth.role,
      metadata: { settingKey: existing.settingKey },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json({ message: 'Template deleted' });
  } catch (error) {
    console.error('Failed to delete email template:', error);
    return Errors.internal();
  }
}


