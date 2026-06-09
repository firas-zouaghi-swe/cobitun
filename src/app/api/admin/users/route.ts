
/**
 * Admin User Management API
 * GET  - List admin users
 * POST - Create a new admin user (super-admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { db } from '@/lib/db';
import { Errors, errorResponse, validateRequestBody } from '@/middleware/validation';
import { z } from 'zod';
import { hashPassword } from '@/lib/password';
import { splitPasswordHash } from '@/lib/auth';
import { logAction } from '@/lib/services/audit-service';
import { Roles } from '@/lib/services/authorization';
import { canManageUser } from '@/lib/services/rbac';

const createAdminSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  password: z.string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[a-z]/, 'Must contain lowercase')
    .regex(/[0-9]/, 'Must contain a number')
    .regex(/[^A-Za-z0-9]/, 'Must contain a special character'),
  roleCode: z.enum(['ADMIN', 'SUPER_ADMIN']).default('ADMIN'),
});

/**
 * Helper: Check if actor can manage target role
 */
function canManageRole(actorRole: string, targetRole: string): boolean {
  return canManageUser(actorRole, targetRole);
}

export async function GET(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') return Errors.forbidden();

  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const search = url.searchParams.get('search');

    // ADMIN can only see CUSTOMER users; SUPER_ADMIN sees all users (CUSTOMER, ADMIN, SUPER_ADMIN)
    const roleFilter = auth.role === Roles.SUPER_ADMIN ? [Roles.CUSTOMER, Roles.ADMIN, Roles.SUPER_ADMIN] : [Roles.CUSTOMER];
    const where: Record<string, unknown> = {
      isDeleted: 0,
      role: { roleCode: { in: roleFilter } },
    };

    if (search) {
      where.OR = [
        { username: { contains: search } },
        { email: { contains: search } },
        { firstName: { contains: search } },
        { lastName: { contains: search } },
      ];
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          username: true,
          email: true,
          firstName: true,
          lastName: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          role: { select: { id: true, roleCode: true, roleName: true } },
        },
      }),
      db.user.count({ where }),
    ]);

    return NextResponse.json({
      users: users.map((u) => ({
        ...u,
        role: u.role?.roleCode ?? null,
        roleName: u.role?.roleName ?? null,
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        createdAt: u.createdAt.toISOString(),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Failed to list admin users', error);
    return Errors.internal();
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') {
    return Errors.forbidden();
  }

  const result = await validateRequestBody(request, createAdminSchema);
  if ('error' in result) return result.error;

  try {
    const data = result.data;

    // Check if actor can create target role
    if (!canManageRole(auth.role, data.roleCode)) {
      return errorResponse(
        `${auth.role} cannot create ${data.roleCode} users`,
        'FORBIDDEN',
        403
      );
    }

    // Check for duplicate username/email
    const existing = await db.user.findFirst({
      where: {
        OR: [{ username: data.username }, { email: data.email }],
        isDeleted: 0,
      },
    });
    if (existing) {
      return errorResponse('Username or email already exists', 'CONFLICT', 409);
    }

    // Find the role
    const role = await db.enumUserRole.findFirst({ where: { roleCode: data.roleCode } });
    if (!role) return Errors.notFound('Role');

    const hashedPassword = await hashPassword(data.password);
    const { passwordSalt, passwordHash: splitHash } = splitPasswordHash(hashedPassword);

    const user = await db.user.create({
      data: {
        username: data.username,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        passwordHash: splitHash,
        passwordSalt,
        roleId: role.id,
        isActive: 1,
        emailVerified: 1,
      },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
        role: { select: { roleCode: true, roleName: true } },
      },
    });

    await logAction({
      entityType: 'User',
      entityId: user.id,
      action: 'CREATE_ADMIN',
      actorId: auth.userIdNum,
      actorType: 'SUPER_ADMIN',
      metadata: { username: data.username, email: data.email, roleCode: data.roleCode },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json({
      ...user,
      role: user.role?.roleCode,
      roleName: user.role?.roleName,
      createdAt: user.createdAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create admin user', error);
    return Errors.internal();
  }
}


