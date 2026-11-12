import { FastifyPluginAsync } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { TaskDto } from './task.dto.js';
import { TaskModelType } from '@/domain/task.model.js';
import { TaskRepository } from './task.repository.js';

export const taskHandler: FastifyPluginAsync = async (app) => {
  app
    .withTypeProvider<ZodTypeProvider>()
    .get(
      '/tasks',
      {
        schema: {
          tags: ['Tasks'],
          security: [{ BearerAuth: [] }],
          response: {
            200: TaskDto.getUserTasksResponseSchema,
          },
        },
        preHandler: [app.authenticate()],
      },
      async (req, reply) => {
        const tasks = await app.prisma.task.findMany({
          where: {
            isDraft: false, // без черновиков
            taskUsers: { some: { userId: req.user.id } },
            project: { status: 'ACTIVE' },
            OR: [
              { taskStatusColumns: { isFinal: false } }, // исключаем задачи в финальных статусах
              { taskStatusColumns: null }, // включаем задачи без статуса
            ],
          },
          include: { taskUsers: true },
          omit: { description: true },
        });
        return reply.code(200).send({ ok: true, data: tasks, error: null });
      },
    )
    .get(
      '/tasks/:taskId',
      {
        schema: {
          tags: ['Tasks'],
          security: [{ BearerAuth: [] }],
          params: TaskDto.getTaskByIdParamsSchema,
          response: {
            200: TaskDto.getTaskByIdResponseSchema,
            404: TaskDto.getTaskByIdResponseSchema,
          },
        },
        preHandler: [app.authenticate()],
      },
      async (req, reply) => {
        const task = await app.prisma.task.findUnique({
          where: {
            id: req.params.taskId,
            project: { status: 'ACTIVE' },
            isDraft: false, // без черновиков
            taskUsers: { some: { userId: req.user.id } },
          },
          include: { taskUsers: true },
          omit: { description: true },
        });
        if (!task) {
          return reply
            .code(404)
            .send({ ok: false, data: null, error: { code: 404, message: 'Задача не найдена' } });
        }
        return reply.code(200).send({ ok: true, data: task, error: null });
      },
    )
    .get(
      '/tasks/project/:projectId',
      {
        schema: {
          tags: ['Tasks'],
          security: [{ BearerAuth: [] }],
          params: TaskDto.getTasksByProjectIdParamsSchema,
          response: {
            200: TaskDto.getTasksByProjectIdResponseSchema,
          },
        },
        preHandler: [app.authenticate()],
      },
      async (req, reply) => {
        const tasks = await app.prisma.task.findMany({
          where: {
            projectId: req.params.projectId,
            isDraft: false, // без черновиков
            taskUsers: { some: { userId: req.user.id } },
            OR: [
              { taskStatusColumns: { isFinal: false } }, // исключаем задачи в финальных статусах
              { taskStatusColumns: null }, // включаем задачи без статуса
            ],
            project: { status: 'ACTIVE' },
          },
          include: { taskUsers: true },
          omit: { description: true },
        });
        return reply.code(200).send({ ok: true, data: tasks, error: null });
      },
    )
    .post(
      '/tasks',
      {
        schema: {
          tags: ['Tasks'],
          security: [{ BearerAuth: [] }],
          body: TaskDto.createTaskBodySchema,
          response: {
            201: TaskDto.createTaskResponseSchema,
          },
        },
        preHandler: [app.authenticate()],
      },
      async (req, reply) => {
        const { projectId, title } = req.body;
        const taskRepository = new TaskRepository(app.prisma);
        const taskDefault = await taskRepository.getProjectTaskDefault(projectId);

        const task = await app.prisma.task.create({
          data: {
            title,
            projectId,
            taskUsers: { create: { userId: req.user.id } },
            createdById: req.user.id,
            ...taskDefault,
          },
          include: { taskUsers: true },
        });
        return reply.code(201).send({ ok: true, data: task, error: null });
      },
    )
    .post(
      '/tasks/batch',
      {
        schema: {
          tags: ['Tasks'],
          security: [{ BearerAuth: [] }],
          body: TaskDto.createTasksBatchBodySchema,
          response: {
            201: TaskDto.createTasksBatchResponseSchema,
            500: TaskDto.createTasksBatchResponseSchema,
          },
        },
        preHandler: [app.authenticate()],
      },
      async (req, reply) => {
        try {
          const userId = req.user.id;
          const tasks = req.body;

          // localSegmentId -> { serverSegmentId, error }
          const idsMatch: Record<string, { serverTaskId: string | null; error: string | null }> =
            {};
          // serverSegmentId -> WorkSegmentModelType
          const createdTasks: Record<string, TaskModelType> = {};

          await app.prisma.$transaction(async (tx) => {
            const taskRepository = new TaskRepository(tx);
            const projectIds = [...new Set(tasks.map((t) => t.projectId))];
            const existingProjects = await tx.project.findMany({
              where: {
                id: { in: projectIds },
                OR: [{ members: { some: { userId } } }, { createdById: userId }], // или участник, или создатель
              },
              select: { id: true },
            });
            const existingProjectIds = new Set(existingProjects.map((project) => project.id));
            const taskDefaultsByProject = await taskRepository.getProjectTaskDefaultMap(projectIds);

            for await (const task of tasks) {
              const { projectId, title, localTaskId } = task;

              // Проверяем, что проект существует и пользователь к нему привязан.
              if (!existingProjectIds.has(projectId)) {
                idsMatch[localTaskId] = {
                  serverTaskId: null,
                  error: `Проект ${projectId} не найден`,
                };
                continue;
              }

              const newTask = await tx.task.create({
                data: {
                  title,
                  projectId,
                  taskUsers: { create: { userId } },
                  createdById: userId,
                  ...taskDefaultsByProject.get(projectId),
                },
                include: { taskUsers: true },
              });
              createdTasks[localTaskId] = newTask;
              idsMatch[localTaskId] = { serverTaskId: newTask.id, error: null };
            }
          });

          return reply
            .code(201)
            .send({ ok: true, data: { ids: idsMatch, tasks: createdTasks }, error: null });
        } catch (error) {
          if (error instanceof app.httpErrors.HttpError) {
            return reply.code(error.statusCode).send({
              ok: false,
              data: null,
              error: {
                code: error.statusCode,
                message: error.message,
              },
            });
          }
          return reply.code(500).send({
            ok: false,
            data: null,
            error: {
              code: 500,
              message: 'Внутренняя ошибка сервера',
            },
          });
        }
      },
    );
};
