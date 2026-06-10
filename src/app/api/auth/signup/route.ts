import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, splitPasswordHash } from '@/lib/auth';
import { Roles } from '@/lib/services/authorization';
import { logAction } from '@/lib/services/audit-service';
import { sendVerificationEmail } from '@/lib/services/email-service';
import { signupSchema } from '@/lib/validation';
import { createAuthResponse, isSecureRequest } from '@/lib/session';
import { randomBytes, createHash } from 'crypto';
import { FraudDetector } from '@/lib/fraud-detector';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.issues[0]?.message || 'Invalid signup payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const {
      username,
      password,
      firstName,
      lastName,
      mobile,
      address,
      email,
      companyName,
      sectorId,
      businessModelId,
      registrationNumber,
      taxId,
    } = parsed.data;

    const sectorIdNum = sectorId && /^[1-9][0-9]*$/.test(sectorId) ? parseInt(sectorId, 10) : null;
    const businessModelIdNum = businessModelId && /^[1-9][0-9]*$/.test(businessModelId) ? parseInt(businessModelId, 10) : null;

    const existingUser = await db.user.findUnique({ where: { username } });
    if (existingUser) {
      return new Response(JSON.stringify({ error: 'Username already exists' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (email) {
      const existingEmail = await db.user.findUnique({ where: { email } });
      if (existingEmail) {
        return new Response(JSON.stringify({ error: 'Email already exists' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const customerRole = await db.enumUserRole.upsert({
      where: { roleCode: Roles.CUSTOMER },
      update: { isActive: 1, isCurrent: 1 },
      create: {
        roleCode: Roles.CUSTOMER,
        roleName: 'Customer',
        description: 'Standard customer access — purchase policies, file claims, manage own profile',
        permissionsJson: JSON.stringify([
          'dashboard:view',
          'policies:own',
          'claims:own',
          'applications:own',
          'profile:manage',
          'questions:submit',
          'endorsements:own',
          'renewals:own',
        ]),
      },
    });

    const hashedPassword = await hashPassword(password);
    const { passwordSalt: salt, passwordHash: hash } = splitPasswordHash(hashedPassword);
    const normalizedEmail = email
      ? email.trim().toLowerCase()
      : `${username.toLowerCase()}+signup-${Date.now()}@cobitun.tn`;

    const user = await db.user.create({
      // mark unverified until email verification (if provided)
      // isEmailVerified stays default 0 unless we verify via token

      data: {
      username,
      passwordHash: hash,
      passwordSalt: salt,
        firstName,
        lastName,
        email: normalizedEmail,
        roleId: customerRole.id,
        customer: {
          create: {
            companyName,
            mobile,
            address,
            registrationNumber: registrationNumber || null,
            taxId: taxId || null,
            sectorId: sectorIdNum,
            businessModelId: businessModelIdNum,
          },
        },
      },
      include: { customer: true, role: true },
    });

    try {
      await logAction({
        entityType: 'User',
        entityId: user.id,
        actorId: user.id,
        actorType: 'USER',
        action: 'SIGNUP',
        actionCategory: 'AUTH',
        newValues: { username: user.username, email: user.email, role: user.role.roleCode },
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
        requestPath: '/api/auth/signup',
      });
    } catch (err) {
      // Ignore audit log errors
    }

    // If email provided, create verification token (expires in 48 hours)
    const emailDeliveryMode = (process.env.EMAIL_DELIVERY_MODE || 'file').toLowerCase();
    if (email) {
      const token = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(token).digest('hex');
      const expires = new Date(Date.now() + 48 * 60 * 60 * 1000);
      try {
        await db.emailVerificationToken.create({ data: { userId: user.id, tokenHash, expiresAt: expires } });
        await sendVerificationEmail(user.email, token);
      } catch (err) {
        // Ignore email verification token creation errors
      }

      // Auto-verify email when not using SMTP (dev/file mode) so users can use the platform immediately
      if (emailDeliveryMode !== 'smtp') {
        try {
          await db.user.update({ where: { id: user.id }, data: { emailVerified: 1, emailVerifiedAt: new Date() } });
          await db.emailVerificationToken.deleteMany({ where: { userId: user.id } });
        } catch (err) {
          // Ignore auto-verify errors
        }
      }
    } else {
      // No email provided — auto-verify in dev mode
      if (emailDeliveryMode !== 'smtp') {
        try {
          await db.user.update({ where: { id: user.id }, data: { emailVerified: 1, emailVerifiedAt: new Date() } });
        } catch (err) {
          // Ignore auto-verify errors
        }
      }
    }

    // Build the user response object (avoid spreading full customer model which has null vs undefined type mismatch)
    const userResponse = {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role.roleCode,
      roleId: user.roleId,
      customerId: user.customer?.id ?? undefined,
    };

    // Run fraud detection in hybrid mode to flag suspicious accounts
    try {
      const detector = new FraudDetector(db);
      const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '';
      const ua = request.headers.get('user-agent') || '';
      const result = await detector.detect({ user, customer: user.customer, ip, userAgent: ua }, 'hybrid');

      if (result.verdict === 'FAKE') {
        // Block the account and don't auto-login
        await db.user.update({ where: { id: user.id }, data: { isActive: 0, lockedUntil: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000) } });
        return new Response(JSON.stringify({ error: 'Account flagged for review', code: 'FRAUD_BLOCKED' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
      }

      // If review required, include a warning in the auth response body (still create session)
      if (result.verdict === 'REVIEW') {
        return await createAuthResponse(
          {
            user: userResponse,
            warning: 'Account under review',
            riskScore: result.finalScore,
          },
          {
            id: user.id,
            role: user.role.roleCode,
            email: user.email,
          },
          { secure: isSecureRequest(request) }
        );
      }
    } catch (err) {
      // LLM or detection errors should not block signup; continue
    }

    return await createAuthResponse(
      {
        user: userResponse,
      },
      {
        id: user.id,
        role: user.role.roleCode,
        email: user.email,
      },
      { secure: isSecureRequest(request) }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

