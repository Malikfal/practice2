import { z } from 'zod';
import type { WorkSegmentModel } from '../db/generated/prisma/models.js';

export const workSegmentModelSchema = z.object({
  id: z.string(),
  startedAt: z.number(),
  endedAt: z.number(),
  note: z.string().nullable(),
  taskId: z.string(),
  userId: z.string(),
}) satisfies z.ZodType<WorkSegmentModel>;

export type WorkSegmentModelType = z.infer<typeof workSegmentModelSchema>;

z.globalRegistry.add(workSegmentModelSchema, { id: 'WorkSegmentModel' });
