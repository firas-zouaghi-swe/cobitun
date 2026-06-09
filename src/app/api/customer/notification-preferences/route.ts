
/**
 * User Notification Preferences API
 * GET  - Get user notification preferences
 * PUT  - Update user notification preferences
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/services/auth-helper';
import { db } from '@/lib/db';
import { Errors, validateRequestBody } from '@/middleware/validation';
import { z } from 'zod';

const updatePreferencesSchema = z.object({
  emailNotifications: z.boolean().optional(),
  inAppNotifications: z.boolean().optional(),
  policyUpdates: z.boolean().optional(),
  claimUpdates: z.boolean().optional(),
  paymentUpdates: z.boolean().optional(),
  marketingEmails: z.boolean().optional(),
});

// ⚠️ SECURITY WARNING: This in-memory Map is NOT suitable for production.
// It will be lost on server restart, does not persist across instances,
// and is NOT shared between serverless function invocations.
// TODO: Replace with database-backed storage using the SystemSetting model
// with a key per user (e.g., key: `notif_prefs_${userId}`) or a dedicated
// NotificationPreference table. This Map is retained only for development.
const userPreferences = new Map<number, {
  emailNotifications: boolean;
  inAppNotifications: boolean;
  policyUpdates: boolean;
  claimUpdates: boolean;
  paymentUpdates: boolean;
  marketingEmails: boolean;
}>();

function getDefaults() {
  return {
    emailNotifications: true,
    inAppNotifications: true,
    policyUpdates: true,
    claimUpdates: true,
    paymentUpdates: true,
    marketingEmails: false,
  };
}

export async function GET(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();

  try {
    console.warn('[NOTIFICATION-PREFERENCES] Reading from in-memory store — not production-safe. See TODO at top of file.');
    const prefs = userPreferences.get(auth.userIdNum) ?? getDefaults();
    return NextResponse.json({ preferences: prefs });
  } catch (error) {
    console.error('Failed to get notification preferences', error);
    return Errors.internal();
  }
}

export async function PUT(request: NextRequest) {
  const auth = await getAuthInfo(request);
  if (!auth) return Errors.unauthorized();

  const result = await validateRequestBody(request, updatePreferencesSchema);
  if ('error' in result) return result.error;

  try {
    const current = userPreferences.get(auth.userIdNum) ?? getDefaults();
    const updated = { ...current, ...result.data };
    userPreferences.set(auth.userIdNum, updated);

    console.warn('[NOTIFICATION-PREFERENCES] Writing to in-memory store — not production-safe. See TODO at top of file.');

    return NextResponse.json({ preferences: updated });
  } catch (error) {
    console.error('Failed to update notification preferences', error);
    return Errors.internal();
  }
}

