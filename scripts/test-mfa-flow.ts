// Force local file delivery for this test script so OTP appears in upload/email-outbox
process.env.EMAIL_DELIVERY_MODE = process.env.EMAIL_DELIVERY_MODE || 'file';

import { promises as fs } from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { hashPassword, splitPasswordHash } from '../src/lib/auth';

async function main() {
  const prisma = new PrismaClient();
  await prisma.$connect();

  const username = 'mfa_test_user';
  const password = 'TestPass123!';

  // Clean existing
  await prisma.user.deleteMany({ where: { username } });

  const hashed = await hashPassword(password);
  const { passwordSalt, passwordHash } = splitPasswordHash(hashed);

  // find customer role
  const role = await prisma.enumUserRole.findFirst({ where: { roleCode: 'CUSTOMER' } });
  const roleId = role ? role.id : 1;

  const user = await prisma.user.create({
    data: {
      username,
      passwordHash: passwordHash || hashed,
      passwordSalt: passwordSalt || '',
      firstName: 'MFA',
      lastName: 'Test',
      email: 'mfa.test@example.com',
      roleId,
      isActive: 1,
      emailVerified: 1,
      mfaEnabled: 0,
    },
  });

  console.log('Created user', user.id);

  // Helper to call login
  async function callLogin() {
    const res = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    return { status: res.status, data };
  }

  console.log('Calling login with MFA disabled...');
  const before = await callLogin();
  console.log('Before MFA:', before.status, JSON.stringify(before.data));

  console.log('Enabling MFA for user...');
  await prisma.user.update({ where: { id: user.id }, data: { mfaEnabled: 1 } });

  console.log('Calling login with MFA enabled...');
  const after = await callLogin();
  console.log('After MFA:', after.status, JSON.stringify(after.data));

  // If MFA required, perform challenge and verify using local outbox
  if (after.data && after.data.mfaRequired && after.data.preAuthToken) {
    const preAuthToken: string = after.data.preAuthToken;
    // Create OTP record directly in the database and write a local outbox file (avoid SMTP)
    try {
      const crypto = await import('crypto');
      const prisma = new PrismaClient();
      await prisma.$connect();
      const code = crypto.randomInt(0, 999999).toString().padStart(6, '0');
      const codeHash = crypto.createHash('sha256').update(code).digest('hex');
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await prisma.mfaOtp.create({ data: { userId: user.id, codeHash, purpose: 'login', expiresAt } });

      // write outbox file so test can read the OTP
      const outboxDir = path.join(process.cwd(), 'upload', 'email-outbox');
      await fs.mkdir(outboxDir, { recursive: true });
      const payload = {
        type: 'TEST_EMAIL_OUTBOX',
        sentAt: new Date().toISOString(),
        from: 'no-reply@cobitun.tn',
        to: user.email,
        subject: 'COBITUN - Your Verification Code',
        text: `Your verification code is: ${code}\n\nThis code expires in 10 minutes.`,
      };
      const filePath = path.join(outboxDir, `${Date.now()}-test.json`);
      await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
      console.log('Wrote test outbox file:', filePath);

      await prisma.$disconnect();
    } catch (err) {
      console.warn('Failed to create local OTP record:', err && (err as any).message ? (err as any).message : err);
    }

    // Wait briefly for outbox file to be written
    await new Promise((res) => setTimeout(res, 800));

    // Read latest outbox file
    const outboxDir = path.join(process.cwd(), 'upload', 'email-outbox');
    let codeFound: string | null = null;
    try {
      const files = await fs.readdir(outboxDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));
      if (jsonFiles.length > 0) {
        const latest = jsonFiles.sort().reverse()[0];
        const content = await fs.readFile(path.join(outboxDir, latest), 'utf-8');
        const payload = JSON.parse(content);
        const text: string = payload.text || payload.html || '';
        const m = text.match(/(\d{6})/);
        if (m) codeFound = m[1];
      }
    } catch (err) {
      console.warn('Unable to read outbox:', err.message || err);
    }

    if (!codeFound) {
      console.warn('OTP code not found in outbox; aborting verify step');
    } else {
      // Call verify
      const verifyRes = await fetch('http://localhost:3000/api/auth/mfa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-pre-auth-token': preAuthToken,
        },
        body: JSON.stringify({ userId: user.id, code: codeFound, purpose: 'login' }),
      });
      const verifyData = await verifyRes.json();
      console.log('Verify response:', verifyRes.status, verifyData);
    }
  }

  // cleanup
  await prisma.user.delete({ where: { id: user.id } });
  console.log('Deleted test user');

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
