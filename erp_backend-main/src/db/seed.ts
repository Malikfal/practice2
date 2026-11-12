import { PrismaPg } from '@prisma/adapter-pg';
import { ENV } from '../env.js';
import { PrismaClient } from './generated/prisma/client.js';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg({ connectionString: ENV.DATABASE_URL });
const prisma = new PrismaClient({ adapter, log: ['query', 'info', 'warn', 'error'] });

const passwordHash = await bcrypt.hash('123456', 12);

await prisma.$transaction(async (tx) => {
  const admin = await tx.user.create({
    data: {
      email: 'admin@gmail.com',
      name: 'Admin',
      role: {
        create: {
          name: 'ADMIN',
          guardName: 'api',
        },
      },
      passwordHash,
    },
  });

  const manager = await tx.user.create({
    data: {
      email: 'manager@gmail.com',
      name: 'Manager',
      role: {
        create: {
          name: 'MANAGER',
          guardName: 'api',
        },
      },
      passwordHash,
    },
  });

  const project = await tx.project.create({
    data: {
      name: 'Demo project',
      description: 'Demo project description',
      createdById: manager.id,
      members: {
        create: {
          userId: manager.id,
        },
      },
    },
  });

  const worker = await tx.user.create({
    data: {
      email: 'worker@gmail.com',
      name: 'Worker',
      role: {
        create: {
          name: 'WORKER',
          guardName: 'api',
        },
      },
      passwordHash,
    },
  });

  await tx.projectMember.create({
    data: {
      projectId: project.id,
      userId: worker.id,
    },
  });
});

await prisma.$disconnect();
