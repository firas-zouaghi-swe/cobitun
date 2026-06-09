import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const ev = await prisma.emailVerificationToken.findFirst({ where: { tokenHash } });
    if (!ev) return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    if (ev.expiresAt && ev.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'Token expired' }, { status: 400 });
    }

    await prisma.user.update({ where: { id: ev.userId }, data: { emailVerified: 1, emailVerifiedAt: new Date() } });
    await prisma.emailVerificationToken.delete({ where: { id: ev.id } });

    return NextResponse.json({ message: 'Email verified' });
  } catch (err) {
    console.error('Verify email error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

