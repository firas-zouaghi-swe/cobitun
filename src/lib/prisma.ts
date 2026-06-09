import { db } from './db'

// Ensure this module is only used on the server side
if (typeof window !== 'undefined') {
  throw new Error('prisma.ts is a server-side module and should not be imported on the client side');
}

// Backwards-compatible export: many files import { prisma } from '@/lib/prisma'
export const prisma = db

export default prisma

