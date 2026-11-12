import { FastifyPluginAsync } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { WorkSegmentDto } from './worksegment.dto.js';
import { WorkSegmentModelType } from '@/domain/work-segment.model.js';

export const workSegmentHandler: FastifyPluginAsync = async (app) => {
  const logger = app.log.child({}, { msgPrefix: '[WorkSegmentHandler] ' });

  app
    .withTypeProvider<ZodTypeProvider>()
    .post(
      '/work-segment/add',
      {
        schema: {
          tags: ['Work Segment'],
          security: [{ BearerAuth: [] }],
          description: `Время передаем в секундах с начала эпохи (Unix time)`,
          body: WorkSegmentDto.addWorkSegmentBodySchema,
          response: {
            200: WorkSegmentDto.addWorkSegmentResponseSchema,
            400: WorkSegmentDto.addWorkSegmentResponseSchema,
            404: WorkSegmentDto.addWorkSegmentResponseSchema,
            500: WorkSegmentDto.addWorkSegmentResponseSchema,
          },
        },
        preHandler: [app.authenticate()],
      },
      async (req, reply) => {
        try {
          const userId = req.user.id;
          const segments = [...req.body].sort((a, b) => a.startedAt - b.startedAt);

          if (segments.length === 0) {
            throw app.httpErrors.badRequest('Нужно передать хотя бы один сегмент');
          }

          for (const segment of segments) {
            if (segment.startedAt > segment.endedAt) {
              throw app.httpErrors.badRequest(
                `Некорректный сегмент ${segment.localSegmentId}: startedAt должно быть меньше или равно endedAt`,
              );
            }
          }

          // localSegmentId -> { serverSegmentId, error }
          const idsMatch: Record<string, { serverSegmentId: string | null; error: string | null }> =
            {};
          // serverSegmentId -> WorkSegmentModelType
          const createdSegments: Record<string, WorkSegmentModelType> = {};

          const workSegments = await app.prisma.$transaction(async (tx) => {
            const taskIds = Array.from(new Set(segments.map((segment) => segment.taskId)));
            const existingTasks = await tx.task.findMany({
              where: { id: { in: taskIds }, taskUsers: { some: { userId } } },
            });

            for await (const segment of segments) {
              const { taskId, startedAt, endedAt, localSegmentId } = segment;

              logger.info(
                `Handling ${localSegmentId} for task ${taskId} with period ${startedAt} - ${endedAt}`,
              );

              // Проверяем, что задача существует и пользователь к ней привязан.
              if (!existingTasks.find((task) => task.id === taskId)) {
                logger.info(`Task with id ${taskId} not found, skipping segment ${localSegmentId}`);
                idsMatch[localSegmentId] = {
                  serverSegmentId: null,
                  error: `Задача с ${taskId} не найдена`,
                };
                continue;
              }

              // Получаем есть ли сегмент, который можно продлить новым временем. Критерии:
              // 1) Сегмент должен быть для той же задачи и пользователя
              // 2) endedAt и startedAt нового сегмента должны совпадать
              const activeWorkSegment = await tx.workSegment.findFirst({
                where: { userId, taskId, endedAt: startedAt },
              });

              // если нет активных сегментов, то создаем новый записываем
              if (!activeWorkSegment) {
                logger.info(
                  `Match segment found for task ${taskId}, creating new segment for local id ${localSegmentId}`,
                );

                const newSegment = await tx.workSegment.create({
                  data: {
                    taskId,
                    startedAt,
                    endedAt,
                    userId,
                  },
                });
                createdSegments[newSegment.id] = newSegment;
                idsMatch[localSegmentId] = { serverSegmentId: newSegment.id, error: null };
                continue;
              }

              // если все норм, то добавляем время к текущему сегменту, обновляем endedAt, если новый endedAt больше текущего
              logger.info(
                `Adding time to current segment ${activeWorkSegment.id} for task ${taskId} for user ${userId} due to new segment ${localSegmentId}, updating endedAt from ${activeWorkSegment.endedAt} to ${endedAt}`,
              );
              const updatedSegment = await tx.workSegment.update({
                where: { id: activeWorkSegment.id },
                data: { endedAt: endedAt },
              });
              createdSegments[updatedSegment.id] = updatedSegment;
              idsMatch[localSegmentId] = { serverSegmentId: updatedSegment.id, error: null };
            }

            return { segments: createdSegments, ids: idsMatch };
          });

          return reply.code(200).send({ ok: true, data: workSegments, error: null });
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
    )
    .get(
      '/work-segment',
      {
        schema: {
          tags: ['Work Segment'],
          description: `Возвращает все сегменты пользователя за указанный период с пересечением. Передавать в секундах с начала эпохи (Unix time)`,
          security: [{ BearerAuth: [] }],
          querystring: WorkSegmentDto.getUserWorkSegmentsQuerySchema,
          response: {
            200: WorkSegmentDto.getUserWorkSegmentsResponseSchema,
            400: WorkSegmentDto.getUserWorkSegmentsResponseSchema,
          },
        },
        preHandler: [app.authenticate()],
      },
      async (req, reply) => {
        const { from, to } = req.query;
        const userId = req.user.id;

        if (from > to) {
          return reply.code(400).send({
            ok: false,
            data: null,
            error: {
              code: 400,
              message: 'Некорректный период, from должно быть меньше to',
            },
          });
        }

        const workSegments = await app.prisma.workSegment.findMany({
          where: {
            userId,
            OR: [
              { startedAt: { gte: from }, endedAt: { lte: to } }, // сегмент полностью внутри периода
              { startedAt: { lte: from }, endedAt: { gte: to } }, // сегмент полностью охватывает период
              { startedAt: { lte: from }, endedAt: { gte: from, lte: to } }, // сегмент начинается до периода, а заканчивается внутри периода
              { startedAt: { gte: from, lte: to }, endedAt: { gte: to } }, // сегмент начинается внутри периода, а заканчивается после периода
            ],
          },
        });

        return reply.code(200).send({ ok: true, data: workSegments, error: null });
      },
    );
};
