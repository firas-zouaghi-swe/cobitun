/**
 * Mock for @/lib/db — used by Jest tests to avoid PrismaClient initialization.
 * The workflow-engine unit tests only test pure validation/RBAC functions,
 * so the db client is never actually called. This mock prevents the real
 * PrismaClient from being instantiated during test runs.
 */

export const db = {
  workflowPolicyApplication: {
    findUnique: async () => null,
    findMany: async () => [],
    create: async () => ({}),
    update: async () => ({}),
  },
  workflowClaim: {
    findUnique: async () => null,
    findMany: async () => [],
    create: async () => ({}),
    update: async () => ({}),
  },
  workflowPolicyTask: {
    findMany: async () => [],
    create: async () => ({}),
    update: async () => ({}),
  },
  workflowClaimTask: {
    findMany: async () => [],
    create: async () => ({}),
    update: async () => ({}),
  },
  enumTaskStatus: {
    findFirst: async () => null,
  },
  enumTaskActor: {
    findFirst: async () => null,
  },
  enumWorkflowAppStatus: {
    findFirst: async () => null,
    findUnique: async () => null,
  },
  enumWorkflowClaimStatus: {
    findFirst: async () => null,
    findUnique: async () => null,
  },
  customer: {
    findUnique: async () => null,
  },
};

export async function safeTransaction<T>(
  fn: (tx: unknown) => Promise<T>,
  _options?: { timeout?: number; maxRetries?: number }
): Promise<T> {
  return fn({});
}

export async function financialTransaction<T>(
  fn: (tx: unknown) => Promise<T>
): Promise<T> {
  return fn({});
}
