import { z } from 'zod';
import type { ProjectMemberModel } from '../db/generated/prisma/models.js';

export const projectMemberModelSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  userId: z.string(),
}) satisfies z.ZodType<ProjectMemberModel>;

export type ProjectMemberModelType = z.infer<typeof projectMemberModelSchema>;

z.globalRegistry.add(projectMemberModelSchema, { id: 'ProjectMemberModel' });
