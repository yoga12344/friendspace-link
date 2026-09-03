import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url:
          process.env.DATABASE_URL ||
          'postgresql://placeholder:placeholder@localhost:5432/placeholder?sslmode=disable',
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

globalForPrisma.prisma = db
