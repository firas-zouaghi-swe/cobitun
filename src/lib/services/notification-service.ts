import { db } from '@/lib/db';
import { Roles } from '@/lib/services/authorization';

// ==================== TYPE DEFINITIONS ====================

/**
 * Concrete FK references for linking a notification to a specific entity.
 * At most one should be set per notification.
 */
export interface NotificationEntityRefs {
  parametricPolicyId?: number;
  cyberPolicyId?: number;
  parametricClaimId?: number;
  cyberClaimId?: number;
}

export interface NotificationData {
  recipientId: number;
  notificationType: string;
  title: string;
  titleAr?: string;
  message: string;
  messageAr?: string;
  deliveryMethod?: string;
  entityRefs?: NotificationEntityRefs;
}

// ==================== NOTIFICATION FUNCTIONS ====================

/**
 * Sends an in-app notification to a customer.
 * Creates a proper Notification record with concrete FK links.
 *
 * @param recipientId - The user ID of the customer to notify
 * @param message - The notification message
 * @param notificationType - The notification type (e.g., 'info', 'warning', 'action_required')
 * @param entityRefs - Optional concrete FK references to link the notification to a specific entity
 */
export async function notifyCustomer(
  recipientId: number,
  message: string,
  notificationType: string,
  entityRefs?: NotificationEntityRefs
): Promise<void> {
  // Log the notification for debugging
  console.log(`[NOTIFICATION → Customer:${recipientId}] [${notificationType}] ${message}`);

  // Create a Notification record
  await db.notification.create({
    data: {
      recipientId,
      notificationType,
      title: notificationType,
      message,
      deliveryMethod: 'IN_APP',
      parametricPolicyId: entityRefs?.parametricPolicyId ?? null,
      cyberPolicyId: entityRefs?.cyberPolicyId ?? null,
      parametricClaimId: entityRefs?.parametricClaimId ?? null,
      cyberClaimId: entityRefs?.cyberClaimId ?? null,
    },
  });
}

/**
 * Sends an in-app notification to administrators.
 * Creates a proper Notification record with concrete FK links.
 *
 * @param recipientId - The user ID of the admin to notify
 * @param message - The notification message
 * @param notificationType - The notification type (e.g., 'info', 'warning', 'action_required')
 * @param entityRefs - Optional concrete FK references to link the notification to a specific entity
 */
export async function notifyAdmin(
  recipientId: number,
  message: string,
  notificationType: string,
  entityRefs?: NotificationEntityRefs
): Promise<void> {
  // Log the notification for debugging
  console.log(`[NOTIFICATION → Admin:${recipientId}] [${notificationType}] ${message}`);

  // Create a Notification record
  await db.notification.create({
    data: {
      recipientId,
      notificationType,
      title: `[Admin] ${notificationType}`,
      message,
      deliveryMethod: 'IN_APP',
      parametricPolicyId: entityRefs?.parametricPolicyId ?? null,
      cyberPolicyId: entityRefs?.cyberPolicyId ?? null,
      parametricClaimId: entityRefs?.parametricClaimId ?? null,
      cyberClaimId: entityRefs?.cyberClaimId ?? null,
    },
  });
}

/**
 * Sends the same notification to all active admin users.
 */
export async function notifyAdmins(
  message: string,
  notificationType: string,
  entityRefs?: NotificationEntityRefs
): Promise<void> {
  const admins = await db.user.findMany({
    where: {
      isDeleted: 0,
      isActive: 1,
      role: {
        roleCode: Roles.ADMIN,
      },
    },
    select: { id: true },
  });

  if (admins.length === 0) {
    console.warn('[NOTIFICATION] No admin users found to notify');
    return;
  }

  const notifications = admins.map((admin) => ({
    recipientId: admin.id,
    notificationType,
    title: `[Admin] ${notificationType}`,
    message,
    deliveryMethod: 'IN_APP',
    parametricPolicyId: entityRefs?.parametricPolicyId ?? null,
    cyberPolicyId: entityRefs?.cyberPolicyId ?? null,
    parametricClaimId: entityRefs?.parametricClaimId ?? null,
    cyberClaimId: entityRefs?.cyberClaimId ?? null,
  }));

  await db.notification.createMany({ data: notifications });
}

/**
 * Sends a notification with full control over all fields.
 * Use this when you need to specify bilingual titles/messages
 * or custom delivery methods.
 */
export async function sendNotification(data: NotificationData): Promise<void> {
  await db.notification.create({
    data: {
      recipientId: data.recipientId,
      notificationType: data.notificationType,
      title: data.title,
      titleAr: data.titleAr ?? null,
      message: data.message,
      messageAr: data.messageAr ?? null,
      deliveryMethod: data.deliveryMethod ?? 'IN_APP',
      parametricPolicyId: data.entityRefs?.parametricPolicyId ?? null,
      cyberPolicyId: data.entityRefs?.cyberPolicyId ?? null,
      parametricClaimId: data.entityRefs?.parametricClaimId ?? null,
      cyberClaimId: data.entityRefs?.cyberClaimId ?? null,
    },
  });
}

// ==================== CONVENIENCE WRAPPER ====================

/**
 * Convenience wrapper that accepts an object-style call.
 * Many API routes call notifyCustomer({ customerId, type, title, message, metadata })
 * This maps those calls to the proper sendNotification function.
 */
export async function notifyCustomerObject(params: {
  customerId: number;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const entityRefs: NotificationEntityRefs = {};
  if (params.metadata) {
    if (params.metadata.policyId) entityRefs.parametricPolicyId = Number(params.metadata.policyId);
    if (params.metadata.claimId) entityRefs.parametricClaimId = Number(params.metadata.claimId);
    if (params.metadata.cyberPolicyId) entityRefs.cyberPolicyId = Number(params.metadata.cyberPolicyId);
    if (params.metadata.cyberClaimId) entityRefs.cyberClaimId = Number(params.metadata.cyberClaimId);
  }

  await sendNotification({
    recipientId: params.customerId,
    notificationType: params.type,
    title: params.title,
    message: params.message,
    deliveryMethod: 'IN_APP',
    entityRefs,
  });
}

// Re-export as notifyCustomerObj for backward compat, and also
// override the default export so both call patterns work
export { notifyCustomerObject as notifyCustomerV2 };

// ==================== QUERY HELPERS ====================

/**
 * Get all unread notifications for a user.
 */
export async function getUnreadNotifications(recipientId: number) {
  return db.notification.findMany({
    where: {
      recipientId,
      isRead: 0,
      isDeleted: 0,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Mark a notification as read.
 */
export async function markNotificationRead(notificationId: number) {
  return db.notification.update({
    where: { id: notificationId },
    data: {
      isRead: 1,
      readAt: new Date(),
    },
  });
}

/**
 * Mark all notifications as read for a user.
 */
export async function markAllNotificationsRead(recipientId: number) {
  return db.notification.updateMany({
    where: {
      recipientId,
      isRead: 0,
      isDeleted: 0,
    },
    data: {
      isRead: 1,
      readAt: new Date(),
    },
  });
}

/**
 * Get notifications for a specific parametric policy.
 */
export async function getNotificationsForParametricPolicy(parametricPolicyId: number) {
  return db.notification.findMany({
    where: {
      parametricPolicyId,
      isDeleted: 0,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Get notifications for a specific cyber policy.
 */
export async function getNotificationsForCyberPolicy(cyberPolicyId: number) {
  return db.notification.findMany({
    where: {
      cyberPolicyId,
      isDeleted: 0,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Get notifications for a specific parametric claim.
 */
export async function getNotificationsForParametricClaim(parametricClaimId: number) {
  return db.notification.findMany({
    where: {
      parametricClaimId,
      isDeleted: 0,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Get notifications for a specific cyber claim.
 */
export async function getNotificationsForCyberClaim(cyberClaimId: number) {
  return db.notification.findMany({
    where: {
      cyberClaimId,
      isDeleted: 0,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Count unread notifications for a user.
 */
export async function countUnreadNotifications(recipientId: number): Promise<number> {
  return db.notification.count({
    where: {
      recipientId,
      isRead: 0,
      isDeleted: 0,
    },
  });
}

