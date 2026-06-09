import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AuthInfo } from '@/lib/services/auth-helper';
import { requireRole, Roles } from '@/lib/services/authorization';
import { logAction } from '@/lib/services/audit-service';

export async function GET(request: NextRequest) {
  const authOrResp = await requireRole(request, Roles.ADMIN);
  if ((authOrResp as any).status) return authOrResp as NextResponse;

  try {
    const questions = await db.customerQuestion.findMany({
      where: { isDeleted: 0 },
      include: {
        customer: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, username: true },
            },
          },
        },
        assignedToUser: {
          select: { id: true, firstName: true, lastName: true, username: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ questions });
  } catch (error) {
    console.error('Get questions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authOrResp = await requireRole(request, Roles.ADMIN);
    if ((authOrResp as any).status) return authOrResp as NextResponse;
    const auth = authOrResp as AuthInfo;

    const body = await request.json();
    const { id, adminComment, status, assignedTo, priority } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const question = await db.customerQuestion.findUnique({ where: { id } });
    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (adminComment !== undefined) updateData.adminComment = adminComment;
    if (status !== undefined) updateData.status = status;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo ? parseInt(assignedTo, 10) : null;
    if (priority !== undefined) updateData.priority = priority;

    // If status is being set to RESOLVED, set resolvedAt
    if (status === 'RESOLVED') {
      updateData.resolvedAt = new Date();
    }

    const updatedQuestion = await db.customerQuestion.update({
      where: { id },
      data: updateData,
      include: {
        customer: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, username: true },
            },
          },
        },
        assignedToUser: {
          select: { id: true, firstName: true, lastName: true, username: true },
        },
      },
    });

    // Audit
    await logAction({
      entityType: 'CustomerQuestion',
      entityId: id,
      actorId: auth.userIdNum,
      action: 'UPDATE',
      actionCategory: 'ADMIN',
      newValues: updateData,
      requestPath: '/api/admin/questions',
    });

    return NextResponse.json({ question: updatedQuestion });
  } catch (error) {
    console.error('Update question error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


