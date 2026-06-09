
/**
 * Notification Queue Service
 * Local file-based queue for zero-cost mode (replaces Redis + Bull)
 * Processes notifications asynchronously with retry logic
 */

import { db } from '@/lib/db';
import { sendMail } from '@/lib/services/email-service';

interface NotificationJob {
  id: string;
  type: 'email' | 'in_app' | 'sms';
  recipientId: number;
  payload: {
    notificationType: string;
    title: string;
    message: string;
    parametricPolicyId?: number;
    parametricClaimId?: number;
  };
  attempts: number;
  maxAttempts: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  nextRetryAt?: Date;
  lastError?: string;
}

// In-memory queue (resets on server restart, but sufficient for dev/small scale)
const queue: NotificationJob[] = [];
let isProcessing = false;

const BACKOFF_DELAYS = [0, 5000, 30000]; // Immediate, 5s, 30s

export function enqueueNotification(job: Omit<NotificationJob, 'id' | 'attempts' | 'maxAttempts' | 'status' | 'createdAt'>): string {
  const id = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const notificationJob: NotificationJob = {
    ...job,
    id,
    attempts: 0,
    maxAttempts: 3,
    status: 'pending',
    createdAt: new Date(),
  };

  queue.push(notificationJob);

  // Start processing if not already running
  if (!isProcessing) {
    processQueue();
  }

  return id;
}

async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;

  while (true) {
    const pendingJobs = queue.filter(
      (j) => j.status === 'pending' && (!j.nextRetryAt || j.nextRetryAt <= new Date())
    );

    if (pendingJobs.length === 0) {
      isProcessing = false;
      return;
    }

    const job = pendingJobs[0];
    job.status = 'processing';

    try {
      await processJob(job);
      job.status = 'completed';
    } catch (error) {
      job.attempts++;
      job.lastError = error instanceof Error ? error.message : 'Unknown error';

      if (job.attempts >= job.maxAttempts) {
        job.status = 'failed';
        console.error(`Notification job ${job.id} failed after ${job.attempts} attempts:`, job.lastError);
      } else {
        job.status = 'pending';
        const delay = BACKOFF_DELAYS[Math.min(job.attempts, BACKOFF_DELAYS.length - 1)];
        job.nextRetryAt = new Date(Date.now() + delay);
        console.warn(`Notification job ${job.id} attempt ${job.attempts} failed, retrying in ${delay}ms`);
      }
    }
  }
}

async function processJob(job: NotificationJob): Promise<void> {
  switch (job.type) {
    case 'email': {
      const user = await db.user.findFirst({ where: { id: job.recipientId, isDeleted: 0 } });
      if (!user?.email) throw new Error('User email not found');

      await sendMail({
        to: user.email,
        subject: job.payload.title,
        text: job.payload.message,
        html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a365d;">${job.payload.title}</h2>
          <p>${job.payload.message}</p>
          <hr style="border: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="color: #718096; font-size: 12px;">This is an automated notification from COBITUN.</p>
        </div>`,
      });

      // Update notification record
      await db.notification.updateMany({
        where: { recipientId: job.recipientId, title: job.payload.title },
        data: { emailSent: 1 },
      });
      break;
    }

    case 'in_app': {
      // Already created in the Notification table by notifyCustomer
      break;
    }

    case 'sms': {
      // SMS deferred - no paid provider in zero-cost mode
      console.log(`[SMS DEFERRED] To: ${job.recipientId}, Message: ${job.payload.title}`);
      break;
    }
  }
}

export function getQueueStats() {
  return {
    total: queue.length,
    pending: queue.filter((j) => j.status === 'pending').length,
    processing: queue.filter((j) => j.status === 'processing').length,
    completed: queue.filter((j) => j.status === 'completed').length,
    failed: queue.filter((j) => j.status === 'failed').length,
  };
}

