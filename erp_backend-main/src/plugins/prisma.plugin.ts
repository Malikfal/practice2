import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '../db/generated/prisma/client.js';
import { ENV } from '../env.js';
import { PrismaPg } from '@prisma/adapter-pg';
import fastifyPlugin from 'fastify-plugin';

type AppPrismaClient = PrismaClient<
  'query' | 'info' | 'warn' | 'error',
  { user: { passwordHash: true } }
>;

declare module 'fastify' {
  interface FastifyInstance {
    prisma: AppPrismaClient;
  }
}

export const prismaPlugin: FastifyPluginAsync = fastifyPlugin(async (fastify) => {
  const adapter = new PrismaPg({ connectionString: ENV.DATABASE_URL });
  const prisma = new PrismaClient({
    adapter,
    log: ['query', 'info', 'warn', 'error'],
    omit: {
      user: {
        passwordHash: true,
      },
    },
  });
  await prisma.$connect();

  fastify.decorate('prisma', prisma);

  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
});
