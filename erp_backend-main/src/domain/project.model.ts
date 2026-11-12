import { z } from 'zod';
import type { ProjectModel } from '../db/generated/prisma/models.js';
import { ProjectStatus } from '../db/generated/prisma/enums.js';

export const projectModelSchema = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  name: z.string(),
  description: z.string().nullable(),
  createdById: z.string(),
  status: z.enum(ProjectStatus),
}) satisfies z.ZodType<Omit<ProjectModel, 'companyId'>>;

export type ProjectModelType = z.infer<typeof projectModelSchema>;

z.globalRegistry.add(projectModelSchema, { id: 'ProjectModel' });
