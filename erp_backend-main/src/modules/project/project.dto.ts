import { projectMemberModelSchema } from '@/domain/project-member.model.js';
import { projectModelSchema } from '@/domain/project.model.js';
import { userModelSchema } from '@/domain/user.model.js';
import { makeApiResponseSchema } from '@/lib/api-response-schema.js';
import { z } from 'zod';

export namespace ProjectDto {
  export const createProjectBodySchema = z.object({
    name: z.string().trim().min(1).max(255),
    description: z.string().trim().optional(),
  });
  export const createProjectResponseSchema = makeApiResponseSchema(
    projectModelSchema.extend({
      members: z.array(
        projectMemberModelSchema.extend({
          user: userModelSchema,
        }),
      ),
      createdBy: userModelSchema,
    }),
  );

  export const assignWorkerBodySchema = z.object({
    projectId: z.uuid(),
    workerId: z.uuid(),
  });
  export const assignWorkerResponseSchema = makeApiResponseSchema(
    projectModelSchema.extend({
      members: z.array(
        projectMemberModelSchema.extend({
          user: userModelSchema,
        }),
      ),
      createdBy: userModelSchema,
    }),
  );

  export const projectsListResponseSchema = makeApiResponseSchema(
    z.array(
      projectModelSchema.extend({
        members: z.array(
          projectMemberModelSchema.extend({
            user: userModelSchema,
          }),
        ),
        createdBy: userModelSchema,
      }),
    ),
  );

  export const getProjectByIdParamsSchema = z.object({
    projectId: z.uuid(),
  });
  export const getProjectByIdResponseSchema = makeApiResponseSchema(
    projectModelSchema.extend({
      members: z.array(
        projectMemberModelSchema.extend({
          user: userModelSchema,
        }),
      ),
      createdBy: userModelSchema,
    }),
  );
}
