import { PrismaClient } from '@prisma/client';
import { config } from '../config';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const createPrismaClient = () => {
  const client = new PrismaClient({
    log: config.isDev ? ['error', 'warn'] : ['error'],
  });

  // Add retry middleware for Neon connection issues
  client.$use(async (params, next) => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await next(params);
      } catch (error: unknown) {
        lastError = error as Error;
        const errorMessage = (error as Error).message || '';

        // Retry on connection errors (Neon auto-suspend)
        const isConnectionError =
          errorMessage.includes("Can't reach database server") ||
          errorMessage.includes('Connection refused') ||
          errorMessage.includes('ECONNREFUSED') ||
          errorMessage.includes('bad certificate format') ||
          errorMessage.includes('TLS connection');

        if (isConnectionError && attempt < MAX_RETRIES) {
          console.log(`[Prisma] Connection error, retrying (${attempt}/${MAX_RETRIES})...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  });

  return client;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (!config.isProd) {
  globalForPrisma.prisma = prisma;
}

export default prisma;
