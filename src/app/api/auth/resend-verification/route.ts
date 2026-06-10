import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, createHash } from 'crypto';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/services/authorization';
import { sendVerificationEmail } from '@/lib/services/email-service';

export async function POST(request: NextRequest) {
  try {
    const authOrResp = await requireAuth(request);
    if ((authOrResp as any).status) return authOrResp as NextResponse;

    const auth = authOrResp as { userIdNum: number };
    const user = await db.user.findUnique({
      where: { id: auth.userIdNum },
      select: { id: true, email: true, emailVerified: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Authenticated user not found' }, { status: 404 });
    }

    if (!user.email) {
      return NextResponse.json({ error: 'No email address is associated with this account' }, { status: 400 });
    }

    if (user.emailVerified === 1) {
      return NextResponse.json({ message: 'Email already verified' }, { status: 200 });
    }

    // Auto-verify email when not using SMTP (dev/file mode) so users can use the platform immediately
    const emailDeliveryMode = (process.env.EMAIL_DELIVERY_MODE || 'file').toLowerCase();
    if (emailDeliveryMode !== 'smtp') {
      await db.user.update({ where: { id: user.id }, data: { emailVerified: 1, emailVerifiedAt: new Date() } });
      await db.emailVerificationToken.deleteMany({ where: { userId: user.id } });
      return NextResponse.json({ message: 'Email auto-verified (non-SMTP mode)' }, { status: 200 });
    }

    // Remove any previous verification tokens for this user.
    await db.emailVerificationToken.deleteMany({ where: { userId: user.id } });

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await db.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    await sendVerificationEmail(user.email, token);

    return NextResponse.json({ message: 'Verification email resent' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

