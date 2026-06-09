import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, Roles } from '@/lib/services/authorization';

/**
 * POST /api/admin/underwriting/notes
 * Creates an underwriting note for a policy or application
 */
export async function POST(request: NextRequest) {
  try {
    const authOrResp = await requireRole(request, Roles.ADMIN);
    if (authOrResp instanceof NextResponse) return authOrResp;
    const auth = authOrResp;

    const {
      parametricPolicyId,
      workflowAppId,
      cyberApplicationId,
      noteText,
      noteCategory,
      priority,
      isInternal
    } = await request.json();

    // Validate input
    if (!noteText || typeof noteText !== 'string' || noteText.trim().length === 0) {
      return NextResponse.json(
        { error: 'Note text is required' },
        { status: 400 }
      );
    }

    const validCategories = [
      'RISK_ASSESSMENT',
      'COVERAGE_CONCERN',
      'PREMIUM_ADJUSTMENT',
      'FOLLOW_UP_REQUIRED',
      'OTHER'
    ];

    if (noteCategory && !validCategories.includes(noteCategory)) {
      return NextResponse.json(
        {
          error: `Invalid note category. Must be one of: ${validCategories.join(', ')}`
        },
        { status: 400 }
      );
    }

    const validPriorities = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'];
    if (priority && !validPriorities.includes(priority)) {
      return NextResponse.json(
        {
          error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}`
        },
        { status: 400 }
      );
    }

    // Ensure at least one entity is specified
    if (!parametricPolicyId && !workflowAppId && !cyberApplicationId) {
      return NextResponse.json(
        {
          error: 'At least one entity (parametricPolicyId, workflowAppId, or cyberApplicationId) is required'
        },
        { status: 400 }
      );
    }

    // Validate that only one entity is specified
    const specifiedCount = [parametricPolicyId, workflowAppId, cyberApplicationId].filter(
      v => v !== undefined && v !== null
    ).length;

    if (specifiedCount > 1) {
      return NextResponse.json(
        {
          error: 'Only one entity type should be specified at a time'
        },
        { status: 400 }
      );
    }

    // Verify entity exists and belongs to the system
    if (parametricPolicyId) {
      const policy = await prisma.parametricPolicy.findUnique({
        where: { id: parametricPolicyId }
      });

      if (!policy) {
        return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
      }
    }

    if (workflowAppId) {
      const app = await prisma.workflowPolicyApplication.findUnique({
        where: { id: workflowAppId }
      });

      if (!app) {
        return NextResponse.json({ error: 'Workflow application not found' }, { status: 404 });
      }
    }

    if (cyberApplicationId) {
      const app = await prisma.cyberApplication.findUnique({
        where: { id: cyberApplicationId }
      });

      if (!app) {
        return NextResponse.json({ error: 'Cyber application not found' }, { status: 404 });
      }
    }

    // Create underwriting note
    const note = await prisma.underwritingNote.create({
      data: {
        parametricPolicyId: parametricPolicyId || undefined,
        workflowAppId: workflowAppId || undefined,
        cyberApplicationId: cyberApplicationId || undefined,
        createdBy: auth.userIdNum,
        noteText,
        noteCategory: noteCategory || 'OTHER',
        priority: priority || 'NORMAL',
        isInternal: isInternal ?? 1
      }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        entityType: 'UnderwritingNote',
        entityId: note.id,
        action: 'UNDERWRITING_NOTE_CREATED',
        actionCategory: 'UNDERWRITING',
        actorId: auth.userIdNum,
        newValuesJson: JSON.stringify({
          noteCategory,
          priority,
          isInternal
        })
      }
    });

    return NextResponse.json(
      {
        message: 'Underwriting note created successfully',
        note: {
          id: note.id,
          noteText: note.noteText,
          noteCategory: note.noteCategory,
          priority: note.priority,
          isInternal: note.isInternal === 1,
          createdAt: note.createdAt
        }
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Underwriting note creation error:', error);
    return NextResponse.json(
      { error: 'An error occurred while creating the underwriting note' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/underwriting/notes
 * Retrieves underwriting notes with filtering
 * Query params: parametricPolicyId, workflowAppId, cyberApplicationId
 */
export async function GET(request: NextRequest) {
  try {
    const authOrResp = await requireRole(request, Roles.ADMIN);
    if (authOrResp instanceof NextResponse) return authOrResp;

    const searchParams = request.nextUrl.searchParams;
    const parametricPolicyId = searchParams.get('parametricPolicyId');
    const workflowAppId = searchParams.get('workflowAppId');
    const cyberApplicationId = searchParams.get('cyberApplicationId');

    const where: any = {};

    if (parametricPolicyId) {
      where.parametricPolicyId = parseInt(parametricPolicyId);
    }

    if (workflowAppId) {
      where.workflowAppId = parseInt(workflowAppId);
    }

    if (cyberApplicationId) {
      where.cyberApplicationId = parseInt(cyberApplicationId);
    }

    const notes = await prisma.underwritingNote.findMany({
      where,
      include: {
        createdByUser: {
          select: { id: true, username: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formattedNotes = notes.map(note => ({
      ...note,
      isInternal: note.isInternal === 1,
      createdByUser: note.createdByUser
    }));

    return NextResponse.json(
      {
        data: formattedNotes,
        count: formattedNotes.length
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Underwriting notes retrieval error:', error);
    return NextResponse.json(
      { error: 'An error occurred while retrieving underwriting notes' },
      { status: 500 }
    );
  }
}


