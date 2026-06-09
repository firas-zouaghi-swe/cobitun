import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

const SMTP_USER_RAW = process.env.SMTP_USER || '';
const SMTP_PASS_RAW = process.env.SMTP_PASS || '';
const SMTP_USER = SMTP_USER_RAW.trim();
const SMTP_PASS = SMTP_PASS_RAW.trim();

function isPlaceholderValue(value?: string) {
  if (!value) return true;
  const trimmed = value.trim();
  return trimmed === '' || trimmed === 'your-smtp-user@example.com' || trimmed === 'your-smtp-password' || trimmed === 'your-email@example.com';
}

const EMAIL_DEFAULT_FROM_RAW = process.env.EMAIL_DEFAULT_FROM || '';
const EMAIL_FROM_RAW = process.env.EMAIL_FROM || '';
const EMAIL_DEFAULT_FROM = isPlaceholderValue(EMAIL_DEFAULT_FROM_RAW) ? '' : EMAIL_DEFAULT_FROM_RAW.trim();
const EMAIL_FROM = isPlaceholderValue(EMAIL_FROM_RAW) ? '' : EMAIL_FROM_RAW.trim();
const DEFAULT_FROM = EMAIL_DEFAULT_FROM || EMAIL_FROM || SMTP_USER || 'no-reply@cobitun.tn';
const DELIVERY_MODE = (process.env.EMAIL_DELIVERY_MODE || 'file').toLowerCase();
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.office365.com';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_HAS_PLACEHOLDER_CREDENTIALS =
  SMTP_USER_RAW === 'your-smtp-user@example.com' ||
  SMTP_PASS_RAW === 'your-smtp-password';

function getFrontendUrl(): string {
  if (process.env.FRONTEND_URL) {
    return process.env.FRONTEND_URL;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FRONTEND_URL environment variable is required in production');
  }
  return 'http://localhost:3000';
}

function getOutboxDir(): string { return path.join(process.cwd(), 'upload', 'email-outbox'); }

export interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
  metadata?: Record<string, unknown>;
}

async function ensureOutboxDirectory() {
  await fs.mkdir(getOutboxDir(), { recursive: true });
}

async function writeOutboxFile(payload: EmailPayload) {
  await ensureOutboxDirectory();
  const fileName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.json`;
  const output = {
    type: 'LOCAL_EMAIL_OUTBOX',
    sentAt: new Date().toISOString(),
    from: DEFAULT_FROM,
    ...payload,
  };
  const filePath = path.join(getOutboxDir(), fileName);
  await fs.writeFile(filePath, JSON.stringify(output, null, 2), 'utf-8');
  return filePath;
}

async function sendSmtpMail(payload: EmailPayload) {
  const invalidCredentials = !SMTP_USER || !SMTP_PASS || SMTP_HAS_PLACEHOLDER_CREDENTIALS;
  if (invalidCredentials) {
    throw new Error('SMTP_USER and SMTP_PASS must be configured for SMTP email delivery and must not be placeholder values');
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: true,
    },
  });

  await transporter.verify();

  await transporter.sendMail({
    from: DEFAULT_FROM,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  });
}

export async function sendMail(payload: EmailPayload) {
  console.info('[EMAIL] sendMail called', {
    deliveryMode: DELIVERY_MODE,
    to: payload.to,
    subject: payload.subject,
    from: DEFAULT_FROM,
  });

  const smtpCredentialsInvalid = !SMTP_USER || !SMTP_PASS || SMTP_HAS_PLACEHOLDER_CREDENTIALS;

  if (DELIVERY_MODE === 'console') {
    console.info('[EMAIL] console delivery mode enabled');
    console.info(JSON.stringify({ from: DEFAULT_FROM, ...payload }, null, 2));
    return;
  }

  if (DELIVERY_MODE === 'smtp') {
    console.info('[EMAIL] SMTP config', {
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      userProvided: Boolean(SMTP_USER),
      from: DEFAULT_FROM,
      invalidCredentials: smtpCredentialsInvalid,
    });

    if (smtpCredentialsInvalid) {
      const message = 'SMTP_USER and SMTP_PASS are not configured or contain placeholder values.';
      if (process.env.NODE_ENV === 'production') {
        throw new Error(message);
      }

      console.warn('[EMAIL] SMTP credentials invalid. Falling back to console delivery in development mode.');
      console.info(JSON.stringify({ from: DEFAULT_FROM, ...payload }, null, 2));
      return;
    }

    await sendSmtpMail(payload);
    console.info(`[EMAIL] sent via SMTP from ${DEFAULT_FROM} to ${payload.to}`);
    return;
  }

  const savedPath = await writeOutboxFile(payload);
  console.info(`[EMAIL] local outbox file created: ${savedPath}`);
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const frontendUrl = getFrontendUrl();
  const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
  const subject = 'COBITUN Password Reset';
  const text = `A password reset request was received for this account.\n\nVisit the link below to reset your password:\n${resetUrl}\n\nIf you did not request this, please ignore this message.`;
  const html = `<p>A password reset request was received for this account.</p><p>Visit the link below to reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you did not request this, please ignore this message.</p>`;
  await sendMail({ to: email, subject, text, html });
}

export async function sendVerificationEmail(email: string, token: string) {
  const frontendUrl = getFrontendUrl();
  const verificationUrl = `${frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;
  const subject = 'COBITUN Email Verification';
  const text = `Please verify your email address by visiting the link below:\n${verificationUrl}\n\nIf you did not create this account, you can ignore this email.`;
  const html = `<p>Please verify your email address by visiting the link below:</p><p><a href="${verificationUrl}">${verificationUrl}</a></p><p>If you did not create this account, you can ignore this email.</p>`;
  await sendMail({ to: email, subject, text, html });
}

