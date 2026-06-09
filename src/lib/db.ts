import { PrismaClient, Prisma } from '@prisma/client'
import { encryptModelData, decryptModelData } from '@/middleware/prisma-encryption'

// Ensure this module is only used on the server side
if (typeof window !== 'undefined') {
  throw new Error('db.ts is a server-side module and should not be imported on the client side');
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// ============================================================
// Base Prisma Client
// ============================================================
const baseClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = baseClient

// ============================================================
// Prisma Client Extension: Auto encrypt/decrypt PII fields
// Uses $extends (modern Prisma API) instead of deprecated $use
// Only processes the Customer model
//
// NOTE: The extended client is NOT cast back to PrismaClient.
// It retains its true extended type so that all consumers get
// correct type inference (including the result extensions for
// decrypted Customer fields). This is the proper Prisma pattern.
// ============================================================
export const db = baseClient.$extends({
  result: {
    customer: {
      taxId: {
        needs: { taxId: true },
        compute(data: Record<string, unknown>) {
          const val = data.taxId as string | null
          if (!val) return null
          try {
            return decryptModelData('Customer', { taxId: val }).taxId as string
          } catch {
            return val
          }
        },
      },
      registrationNumber: {
        needs: { registrationNumber: true },
        compute(data: Record<string, unknown>) {
          const val = data.registrationNumber as string | null
          if (!val) return null
          try {
            return decryptModelData('Customer', { registrationNumber: val }).registrationNumber as string
          } catch {
            return val
          }
        },
      },
      mobile: {
        needs: { mobile: true },
        compute(data: Record<string, unknown>) {
          const val = data.mobile as string | null
          if (!val) return null
          try {
            return decryptModelData('Customer', { mobile: val }).mobile as string
          } catch {
            return val
          }
        },
      },
    },
  },
  query: {
    customer: {
      async create({ args, query }: { args: Prisma.CustomerCreateArgs; query: (args: Prisma.CustomerCreateArgs) => Promise<unknown> }) {
        args.data = encryptModelData('Customer', args.data as Record<string, unknown>) as typeof args.data
        return query(args)
      },
      async update({ args, query }: { args: Prisma.CustomerUpdateArgs; query: (args: Prisma.CustomerUpdateArgs) => Promise<unknown> }) {
        if (args.data) {
          args.data = encryptModelData('Customer', args.data as Record<string, unknown>) as typeof args.data
        }
        return query(args)
      },
      async upsert({ args, query }: { args: Prisma.CustomerUpsertArgs; query: (args: Prisma.CustomerUpsertArgs) => Promise<unknown> }) {
        args.create = encryptModelData('Customer', args.create as Record<string, unknown>) as typeof args.create
        if (args.update) {
          args.update = encryptModelData('Customer', args.update as Record<string, unknown>) as typeof args.update
        }
        return query(args)
      },
    },
  },
})

// ============================================================
// Transaction Helpers: Use baseClient for transactions
// ============================================================
const DEFAULT_TX_TIMEOUT = 10_000 // 10 seconds
const FINANCIAL_TX_TIMEOUT = 30_000 // 30 seconds for financial operations

/**
 * Execute a database transaction with proper timeout and error handling.
 * Use this for all write operations that involve multiple tables.
 */
export async function safeTransaction<T>(
  fn: (tx: any) => Promise<T>,
  options?: { timeout?: number; maxRetries?: number }
): Promise<T> {
  const timeout = options?.timeout ?? DEFAULT_TX_TIMEOUT
  const maxRetries = options?.maxRetries ?? 2

  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await baseClient.$transaction(fn, {
        maxWait: timeout,
        timeout,
      })
    } catch (error: unknown) {
      lastError = error
      if ((error as any)?.code === 'P2034') {
        // Transaction failed due to write conflict - retry
        continue
      }
      throw error
    }
  }
  throw lastError
}

/**
 * Execute a financial transaction with stricter isolation and longer timeout.
 * Use this for premium payments, payouts, refunds.
 */
export async function financialTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return safeTransaction(fn, { timeout: FINANCIAL_TX_TIMEOUT, maxRetries: 3 })
}
