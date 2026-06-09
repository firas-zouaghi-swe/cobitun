import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword } from '@/lib/auth';
import { logAction } from '@/lib/services/audit-service';
import { createAuthResponse, isSecureRequest } from '@/lib/session';
import { isMfaRequired } from '@/lib/services/mfa-service';

export async function POST(request: NextRequest) {
  try {
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not set');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return new Response(JSON.stringify({ error: 'Username and password are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const user = await db.user.findUnique({
      where: { username },
      include: { role: true, customer: true },
    });

    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid username or password' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (user.isDeleted) {
      return new Response(JSON.stringify({ error: 'Account has been deactivated' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!user.isActive) {
      return new Response(JSON.stringify({ error: 'Account is inactive' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const remainingMinutes = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60000);
      return new Response(
        JSON.stringify({ error: `Account is locked. Try again in ${remainingMinutes} minutes.` }),
        { status: 423, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const stored = user.passwordSalt ? `${user.passwordSalt}:${user.passwordHash}` : user.passwordHash;
    const isValid = await verifyPassword(password, stored);

    if (!isValid) {
      const newFailedCount = user.failedLoginCount + 1;
      const updateData: { failedLoginCount: number; lockedUntil?: Date | null } = {
        failedLoginCount: newFailedCount,
      };

      if (newFailedCount >= 5) {
        updateData.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
      }

      await db.user.update({
        where: { id: user.id },
        data: updateData,
      });

      await logAction({
        entityType: 'User',
        entityId: user.id,
        actorId: user.id,
        actorType: 'USER',
        action: 'LOGIN_FAILED',
        actionCategory: 'AUTH',
        metadata: { failedAttemptCount: newFailedCount },
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
        requestPath: '/api/auth/login',
      });

      return new Response(JSON.stringify({ error: 'Invalid username or password' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: request.headers.get('x-forwarded-for') || null,
      },
    });

    // Check if MFA is required for this user
    const mfaRequired = await isMfaRequired(user.id);

    if (mfaRequired) {
      await logAction({
        entityType: 'User',
        entityId: user.id,
        actorId: user.id,
        actorType: 'USER',
        action: 'LOGIN_MFA_REQUIRED',
        actionCategory: 'AUTH',
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
        requestPath: '/api/auth/login',
      });

      // Generate pre-auth token for MFA flow (proves password was verified)
      const { createHmac } = await import('crypto');
      const mfaSecret = process.env.JWT_SECRET!;
      const preAuthToken = createHmac('sha256', mfaSecret)
        .update(`mfa-pre-auth:${user.id}`)
        .digest('hex');

      // Return MFA challenge required instead of tokens
      return new Response(JSON.stringify({
        mfaRequired: true,
        userId: user.id,
        method: 'email_otp',
        preAuthToken,
        message: 'MFA verification required',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await logAction({
      entityType: 'User',
      entityId: user.id,
      actorId: user.id,
      actorType: 'USER',
      action: 'LOGIN_SUCCESS',
      actionCategory: 'AUTH',
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      requestPath: '/api/auth/login',
    });

    const userRoleCode = user.role?.roleCode || 'CUSTOMER';

    return await createAuthResponse(
      {
        user: {
          id: user.id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: userRoleCode,
          roleId: user.roleId,
          customerId: user.customer?.id ?? undefined,
          mfaEnabled: user.mfaEnabled,
        },
      },
      {
        id: user.id,
        role: user.role.roleCode,
        email: user.email,
      },
      { secure: isSecureRequest(request) }
    );
  } catch (error) {
    console.error('Login error:', error);
    const devMsg = process.env.NODE_ENV === 'production' ? undefined : (error instanceof Error ? error.message : String(error));
    return new Response(JSON.stringify({ error: 'Internal server error', message: devMsg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

