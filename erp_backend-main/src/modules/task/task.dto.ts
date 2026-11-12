import { taskUserModelSchema } from '@/domain/taks-users.models.js';
import { taskModelSchema } from '@/domain/task.model.js';
import { makeApiResponseSchema } from '@/lib/api-response-schema.js';
import { z } from 'zod';

export namespace TaskDto {
  export const getUserTasksResponseSchema = makeApiResponseSchema(
    z.array(taskModelSchema.extend({ taskUsers: z.array(taskUserModelSchema) })),
  );

  export const getTaskByIdParamsSchema = z.object({
    taskId: z.uuid(),
  });
  export const getTaskByIdResponseSchema = makeApiResponseSchema(
    taskModelSchema.extend({ taskUsers: z.array(taskUserModelSchema) }),
  );

  export const getTasksByProjectIdParamsSchema = z.object({
    projectId: z.uuid(),
  });
  export const getTasksByProjectIdResponseSchema = makeApiResponseSchema(
    z.array(taskModelSchema.extend({ taskUsers: z.array(taskUserModelSchema) })),
  );

  export const createTaskBodySchema = z.object({
    projectId: z.uuid(),
    title: z.string().trim().min(1).max(255),
  });
  export const createTaskResponseSchema = makeApiResponseSchema(
    taskModelSchema.extend({ taskUsers: z.array(taskUserModelSchema) }),
  );

  export const createTasksBatchBodySchema = z.array(
    z.object({
      localTaskId: z.uuid(),
      projectId: z.uuid(),
      title: z.string().trim().min(1).max(255),
    }),
  );
  export const createTasksBatchResponseSchema = makeApiResponseSchema(
    z.object({
      tasks: z.record(z.string(), taskModelSchema),
      ids: z.record(
        z.string(),
        z.object({
          serverTaskId: z.string().nullable(), // null, если задача не была добавлена по какой-то причине
          error: z.string().nullable(),
        }),
      ), // сопоставление localTaskId с серверным id
    }),
  );
}
