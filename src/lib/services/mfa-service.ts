
/**
 * MFA Service - Email-based OTP using GoDaddy SMTP
 * - Generate and verify 6-digit OTP codes
 * - Send OTP via email (GoDaddy SMTP)
 * - Rate limiting (1 request per 30 seconds, max 5 per hour)
 * - OTP expiry: 10 minutes
 * - Supports TOTP setup as future enhancement
 */

import { db } from '@/lib/db';
import { sendMail } from '@/lib/services/email-service';
import crypto from 'crypto';

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = Number(process.env.MFA_OTP_EXPIRY_MINUTES && !Number.isNaN(Number(process.env.MFA_OTP_EXPIRY_MINUTES)) ? Number(process.env.MFA_OTP_EXPIRY_MINUTES) : 10);
const OTP_RATE_LIMIT_SECONDS = 30;
const OTP_MAX_ATTEMPTS_PER_HOUR = 5;
const OTP_MAX_VERIFY_ATTEMPTS = 3;

interface OtpRecord {
  code: string;
  createdAt: Date;
  expiresAt: Date;
  verified: boolean;
  verifyAttempts: number;
}

// In-memory OTP store (production would use Redis or DB table)
const otpStore: Map<number, { otps: OtpRecord[]; lastSentAt: Date | null }> = new Map();

/**
 * Generate a random 6-digit OTP code
 */
function generateOtpCode(): string {
  const code = crypto.randomInt(0, 999999).toString().padStart(OTP_LENGTH, '0');
  return code;
}

/**
 * Check rate limiting for OTP requests
 */
function checkRateLimit(userId: number): { allowed: boolean; reason?: string } {
  const record = otpStore.get(userId);
  if (!record) return { allowed: true };

  // Check 30-second cooldown
  if (record.lastSentAt) {
    const secondsSinceLast = (Date.now() - record.lastSentAt.getTime()) / 1000;
    if (secondsSinceLast < OTP_RATE_LIMIT_SECONDS) {
      return {
        allowed: false,
        reason: `Please wait ${Math.ceil(OTP_RATE_LIMIT_SECONDS - secondsSinceLast)} seconds before requesting a new code`,
      };
    }
  }

  // Check hourly limit
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentOtps = record.otps.filter((o) => o.createdAt >= oneHourAgo);
  if (recentOtps.length >= OTP_MAX_ATTEMPTS_PER_HOUR) {
    return {
      allowed: false,
      reason: 'Maximum OTP requests reached for this hour. Please try again later.',
    };
  }

  return { allowed: true };
}

/**
 * Send MFA OTP code to user's email
 */
export async function sendMfaOtp(userId: number, email: string): Promise<{ success: boolean; message: string; expiresAt?: Date }> {
  // Check rate limit
  const rateCheck = checkRateLimit(userId);
  if (!rateCheck.allowed) {
    return { success: false, message: rateCheck.reason || 'Rate limit exceeded' };
  }

  // Generate OTP
  const code = generateOtpCode();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);

  const otpRecord: OtpRecord = {
    code,
    createdAt: now,
    expiresAt,
    verified: false,
    verifyAttempts: 0,
  };

  // Store OTP
  if (!otpStore.has(userId)) {
    otpStore.set(userId, { otps: [], lastSentAt: null });
  }
  const userRecord = otpStore.get(userId)!;
  userRecord.otps.push(otpRecord);
  userRecord.lastSentAt = now;

  // Clean up expired OTPs
  userRecord.otps = userRecord.otps.filter((o) => o.expiresAt > now);

  // Send OTP email via SMTP
  try {
    await sendMail({
      to: email,
      subject: 'COBITUN - Your Verification Code',
      text: `Your verification code is: ${code}

This code expires in ${OTP_EXPIRY_MINUTES} minutes.

If you did not request this code, please ignore this email and contact support.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #1a5276; text-align: center;">COBITUN Verification</h2>
          <p style="text-align: center; font-size: 14px; color: #555;">Your verification code is:</p>
          <div style="text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a5276; padding: 15px; background: #f8f9fa; border-radius: 6px; margin: 10px 0;">
            ${code}
          </div>
          <p style="text-align: center; font-size: 12px; color: #888;">This code expires in ${OTP_EXPIRY_MINUTES} minutes.</p>
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 15px 0;">
          <p style="font-size: 11px; color: #999; text-align: center;">If you did not request this code, please ignore this email and contact support.</p>
        </div>
      `,
    });
    console.info(`[MFA] OTP email successfully sent to ${email} for user ${userId}`);
  } catch (error) {
    const isSmtpMode = process.env.EMAIL_DELIVERY_MODE?.toLowerCase() === 'smtp';
    console.warn('[MFA] Email delivery failed:', error);

    if (isSmtpMode) {
      return { success: false, message: 'Failed to send OTP email via SMTP. Please try again later.' };
    }

    // Email delivery failed in non-SMTP mode — fall back to console logging so OTP is still usable
    console.warn('[MFA] Non-SMTP email delivery failed, falling back to console output.');
    console.info(`[MFA] Verification code for user ${userId} (${email}): ${code}`);
  }

  return { success: true, message: `Verification code sent to ${email.replace(/(.{2})(.*)(@.*)/, '$1***$3')}`, expiresAt };
}

/**
 * Verify an MFA OTP code
 */
export async function verifyMfaOtp(userId: number, code: string): Promise<{ valid: boolean; message: string }> {
  const record = otpStore.get(userId);
  if (!record) {
    return { valid: false, message: 'No verification code found. Please request a new one.' };
  }

  const now = new Date();

  // Find the latest unexpired, unverified OTP
  const activeOtp = record.otps
    .filter((o) => !o.verified && o.expiresAt > now)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

  if (!activeOtp) {
    return { valid: false, message: 'Verification code expired. Please request a new one.' };
  }

  // Check max verify attempts
  if (activeOtp.verifyAttempts >= OTP_MAX_VERIFY_ATTEMPTS) {
    // Invalidate the OTP
    activeOtp.expiresAt = now;
    return { valid: false, message: 'Too many incorrect attempts. Please request a new code.' };
  }

  // Increment verify attempts
  activeOtp.verifyAttempts++;

  // Check code match (constant-time comparison)
  const expectedCode = activeOtp.code;
  const isMatch = crypto.timingSafeEqual(
    Buffer.from(code.padStart(OTP_LENGTH, '0')),
    Buffer.from(expectedCode.padStart(OTP_LENGTH, '0'))
  );

  if (!isMatch) {
    const remaining = OTP_MAX_VERIFY_ATTEMPTS - activeOtp.verifyAttempts;
    return { valid: false, message: `Invalid code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.` };
  }

  // Mark as verified
  activeOtp.verified = true;

  return { valid: true, message: 'Verification successful' };
}

/**
 * Enable MFA for a user
 */
export async function enableMfa(userId: number): Promise<{ success: boolean; message: string }> {
  try {
    await db.user.update({
      where: { id: userId },
      data: { mfaEnabled: 1, updatedAt: new Date() },
    });

    return { success: true, message: 'MFA enabled successfully' };
  } catch (error) {
    console.error('Failed to enable MFA:', error);
    return { success: false, message: 'Failed to enable MFA' };
  }
}

/**
 * Disable MFA for a user
 */
export async function disableMfa(userId: number): Promise<{ success: boolean; message: string }> {
  try {
    await db.user.update({
      where: { id: userId },
      data: { mfaEnabled: 0, updatedAt: new Date() },
    });

    // Clean up OTP records
    otpStore.delete(userId);

    return { success: true, message: 'MFA disabled successfully' };
  } catch (error) {
    console.error('Failed to disable MFA:', error);
    return { success: false, message: 'Failed to disable MFA' };
  }
}

/**
 * Check if MFA is required for a user
 */
export async function isMfaRequired(userId: number): Promise<boolean> {
  const user = await db.user.findFirst({
    where: { id: userId, isDeleted: 0 },
    select: { mfaEnabled: true, role: { select: { roleCode: true } } },
  });

  if (!user) return false;

  const roleCode = user.role?.roleCode || '';
  // MFA required if explicitly enabled OR if user is admin/super-admin
  return user.mfaEnabled === 1 || ['ADMIN', 'SUPER_ADMIN'].includes(roleCode);
}

/**
 * Get MFA status for a user
 */
export async function getMfaStatus(userId: number): Promise<{
  enabled: boolean;
  required: boolean;
  method: string;
}> {
  const user = await db.user.findFirst({
    where: { id: userId, isDeleted: 0 },
    select: { mfaEnabled: true, role: { select: { roleCode: true } } },
  });

  if (!user) return { enabled: false, required: false, method: 'none' };

  const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user.role?.roleCode || '');
  const enabled = user.mfaEnabled === 1;

  return {
    enabled,
    required: enabled || isAdmin,
    method: 'email_otp',
  };
}

