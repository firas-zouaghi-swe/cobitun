import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { Errors, validateRequestBody } from '@/middleware/validation';
import { z } from 'zod';
import { logAction } from '@/lib/services/audit-service';
import { sendMail } from '@/lib/services/email-service';

const contactSchema = z.object({
  name: z.string().min(2).max(200),
  email: z.string().email(),
  phone: z.string().max(20).optional(),
  subject: z.string().min(3).max(200),
  message: z.string().min(10).max(5000),
  category: z.enum(['GENERAL', 'CLAIM_INQUIRY', 'POLICY_INQUIRY', 'TECHNICAL', 'COMPLAINT']).default('GENERAL'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  companyName: z.string().max(200).optional(),
});

const respondSchema = z.object({
  submissionId: z.number().int().positive(),
  response: z.string().min(1).max(5000),
  status: z.enum(['REVIEWED', 'RESOLVED']).default('REVIEWED'),
});

export async function POST(request: NextRequest) {
  const result = await validateRequestBody(request, contactSchema);
  if ('error' in result) return result.error;

  try {
    const data = result.data;

    const contactMessage = await db.contactMessage.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        subject: data.subject,
        message: data.message,
        category: data.category,
        priority: data.priority,
      },
    });

    // Send confirmation email
    try {
      await sendMail({
        to: data.email,
        subject: `COBITUN - We received your message: ${data.subject}`,
        text: `Thank you for contacting COBITUN. We have received your message and will respond within 24 hours. Reference: #CM-${contactMessage.id}`,
        html: `<h2>Thank you for contacting COBITUN</h2><p>We have received your message and will respond within 24 hours.</p><p><strong>Reference:</strong> #CM-${contactMessage.id}</p>`,
      });
    } catch {
      console.warn('Failed to send contact confirmation email');
    }

    return NextResponse.json({
      message: 'Message sent successfully',
      reference: `#CM-${contactMessage.id}`,
      contactMessage,
    }, { status: 201 });
  } catch (error) {
    console.error('Contact error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const status = url.searchParams.get('status');
    const category = url.searchParams.get('category');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (category) where.category = category;

    const [submissions, total] = await Promise.all([
      db.contactMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.contactMessage.count({ where }),
    ]);

    return NextResponse.json({
      submissions,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Failed to list contact submissions:', error);
    return Errors.internal();
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  const result = await validateRequestBody(request, respondSchema);
  if ('error' in result) return result.error;

  try {
    const { submissionId, response, status } = result.data;

    const submission = await db.contactMessage.findFirst({ where: { id: submissionId } });
    if (!submission) return Errors.notFound('Contact submission');

    await db.contactMessage.update({
      where: { id: submissionId },
      data: {
        isRead: 1,
        responseText: response,
        respondedBy: auth.userIdNum,
        respondedAt: new Date(),
      },
    });

    // Send response email
    try {
      await sendMail({
        to: submission.email,
        subject: `COBITUN - Response to: ${submission.subject}`,
        text: `Dear ${submission.name}, ${response} Reference: #CM-${submissionId}`,
        html: `<h2>Response to Your Inquiry</h2><p>Dear ${submission.name},</p><p>${response}</p><p><strong>Reference:</strong> #CM-${submissionId}</p>`,
      });
    } catch {
      console.warn('Failed to send contact response email');
    }

    await logAction({
      entityType: 'ContactMessage',
      entityId: submissionId,
      action: 'RESPOND_CONTACT',
      actorId: auth.userIdNum,
      actorType: auth.role,
      metadata: { status },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json({ message: 'Response sent', submissionId, status });
  } catch (error) {
    console.error('Failed to respond to contact submission:', error);
    return Errors.internal();
  }
}

