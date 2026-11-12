import { TaskUsersModel } from '@/db/generated/prisma/models.js';
import z from 'zod';

export const taskUserModelSchema = z.object({
  taskId: z.uuid(),
  userId: z.uuid(),
}) satisfies z.ZodType<TaskUsersModel>;

export type TaskUserModelType = z.infer<typeof taskUserModelSchema>;

z.globalRegistry.add(taskUserModelSchema, { id: 'TaskUsersModel' });
