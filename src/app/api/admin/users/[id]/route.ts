
/**
 * Admin User Detail API
 * GET    - Get admin user details
 * PATCH  - Edit admin user (super-admin only)
 * DELETE - Deactivate admin user (super-admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { db } from '@/lib/db';
import { Errors, errorResponse, validateRequestBody } from '@/middleware/validation';
import { z } from 'zod';
import { hashPassword } from '@/lib/password';
import { logAction } from '@/lib/services/audit-service';
import { Roles } from '@/lib/services/authorization';
import { canManageUser } from '@/lib/services/rbac';

const editAdminSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  password: z.string()
    .min(12).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/)
    .optional(),
  roleCode: z.enum(['ADMIN', 'SUPER_ADMIN']).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== Roles.ADMIN && auth.role !== Roles.SUPER_ADMIN) return Errors.forbidden();

  const { id } = await params;
  const userId = parseInt(id, 10);
  if (isNaN(userId)) return Errors.notFound('User');

  try {
    const user = await db.user.findFirst({
      where: { id: userId, isDeleted: 0 },
      select: {
        id: true, username: true, email: true, firstName: true, lastName: true,
        isActive: true, lastLoginAt: true, createdAt: true, updatedAt: true,
        failedLoginCount: true, lockedUntil: true, mfaEnabled: true,
        role: { select: { id: true, roleCode: true, roleName: true } },
      },
    });

    if (!user) return Errors.notFound('User');

    return NextResponse.json({
      ...user,
      role: user.role?.roleCode ?? null,
      roleName: user.role?.roleName ?? null,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      lockedUntil: user.lockedUntil?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('Failed to fetch admin user', error);
    return Errors.internal();
  }
}

/**
 * Helper: Check if actor can manage target role
 */
function canManageRole(actorRole: string, targetRole: string): boolean {
  return canManageUser(actorRole, targetRole);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== Roles.ADMIN && auth.role !== Roles.SUPER_ADMIN) {
    return Errors.forbidden();
  }

  const { id } = await params;
  const userId = parseInt(id, 10);
  if (isNaN(userId)) return Errors.notFound('User');

  const result = await validateRequestBody(request, editAdminSchema);
  if ('error' in result) return result.error;

  try {
    const data = result.data;
    const user = await db.user.findFirst({ where: { id: userId, isDeleted: 0 },
      include: { role: { select: { roleCode: true, roleName: true } } },
    });
    if (!user) return Errors.notFound('User');

    // Get target user's role
    const targetUserRole = user.role?.roleCode ?? 'ADMIN';

    // Check if actor can manage target user's role
    if (!canManageRole(auth.role, targetUserRole)) {
      return errorResponse(
        `${auth.role} cannot manage ${targetUserRole} users`,
        'FORBIDDEN',
        403
      );
    }

    // Prevent self-deactivation
    if (userId === auth.userIdNum && data.isActive === false) {
      return errorResponse('Cannot deactivate your own account', 'FORBIDDEN', 403);
    }

    // Prevent self-demotion
    if (userId === auth.userIdNum && data.roleCode && data.roleCode !== 'SUPER_ADMIN') {
      return errorResponse('Cannot change your own role', 'FORBIDDEN', 403);
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (data.firstName) updateData.firstName = data.firstName;
    if (data.lastName) updateData.lastName = data.lastName;
    if (data.email) {
      // Check email uniqueness
      const emailExists = await db.user.findFirst({
        where: { email: data.email, isDeleted: 0, id: { not: userId } },
      });
      if (emailExists) return errorResponse('Email already in use', 'CONFLICT', 409);
      updateData.email = data.email;
    }
    if (data.password) {
      updateData.passwordHash = await hashPassword(data.password);
    }
    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive ? 1 : 0;
    }
    if (data.roleCode) {
      // Check if actor can assign target role
      if (!canManageRole(auth.role, data.roleCode)) {
        return errorResponse(
          `${auth.role} cannot assign ${data.roleCode} role`,
          'FORBIDDEN',
          403
        );
      }
      const role = await db.enumUserRole.findFirst({ where: { roleCode: data.roleCode } });
      if (role) updateData.roleId = role.id;
    }

    const updated = await db.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true, username: true, email: true, firstName: true, lastName: true,
        isActive: true, updatedAt: true,
        role: { select: { roleCode: true, roleName: true } },
      },
    });

    await logAction({
      entityType: 'User',
      entityId: userId,
      action: 'UPDATE_ADMIN',
      actorId: auth.userIdNum,
      actorType: 'SUPER_ADMIN',
      metadata: { updatedFields: Object.keys(updateData) },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json({
      ...updated,
      role: updated.role?.roleCode,
      roleName: updated.role?.roleName,
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    return Errors.internal();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== Roles.ADMIN && auth.role !== Roles.SUPER_ADMIN) {
    return Errors.forbidden();
  }

  const { id } = await params;
  const userId = parseInt(id, 10);
  if (isNaN(userId)) return Errors.notFound('User');

  try {
    if (userId === auth.userIdNum) {
      return errorResponse('Cannot deactivate your own account', 'FORBIDDEN', 403);
    }

    const user = await db.user.findFirst({ where: { id: userId, isDeleted: 0 },
      include: { role: { select: { roleCode: true, roleName: true } } },
    });
    if (!user) return Errors.notFound('User');

    // Get target user's role
    const targetUserRole = user.role?.roleCode ?? 'ADMIN';

    // Check if actor can manage target user's role
    if (!canManageRole(auth.role, targetUserRole)) {
      return errorResponse(
        `${auth.role} cannot manage ${targetUserRole} users`,
        'FORBIDDEN',
        403
      );
    }

    // Soft delete + deactivate
    await db.user.update({
      where: { id: userId },
      data: {
        isDeleted: 1,
        isActive: 0,
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Revoke all sessions
    await db.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await logAction({
      entityType: 'User',
      entityId: userId,
      action: 'DEACTIVATE_ADMIN',
      actorId: auth.userIdNum,
      actorType: 'SUPER_ADMIN',
      metadata: { username: user.username, email: user.email },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json({ message: 'Admin user deactivated', userId });
  } catch (error) {
    return Errors.internal();
  }
}

