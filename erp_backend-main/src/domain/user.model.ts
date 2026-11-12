import { z } from 'zod';
import { userStatusSchema } from './enums.js';
import { Prisma } from '@/db/generated/prisma/client.js';
import { UserModel } from '@/db/generated/prisma/models.js';

export const userPublicSelect: Prisma.UserSelect = {
  id: true,
  createdAt: true,
  updatedAt: true,
  email: true,
  name: true,
  lastName: true,
  status: true,
  role: {
    select: {
      name: true,
    },
  },
} as const;

export const userModelSchema = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  email: z.string(),
  name: z.string(),
  lastName: z.string().nullable(),
  role: z
    .object({
      name: z.string(),
    })
    .nullable(),
  status: userStatusSchema,
}) satisfies z.ZodType<Omit<UserModel, 'passwordHash' | 'roleId'> & {}>;

export type UserPublicType = z.infer<typeof userModelSchema>;

z.globalRegistry.add(userModelSchema, { id: 'UserModel' });
