import { z } from 'zod';
import type { TaskModel } from '../db/generated/prisma/models.js';

export const taskModelSchema = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  title: z.string(),
  // description не отдаём: приложение его не использует, а описания бывают большими.
  status: z.string(),
  projectId: z.string(),
  estimation: z.number().nullable(),
  priority: z.string().nullable(),
  isDraft: z.boolean(),
}) satisfies z.ZodType<Omit<TaskModel, 'createdById' | 'taskStatusColumnId' | 'publishedAt' | 'description'>>;

export type TaskModelType = z.infer<typeof taskModelSchema>;

z.globalRegistry.add(taskModelSchema, { id: 'TaskModel' });
