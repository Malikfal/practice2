import { FastifyPluginAsync } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { ProjectDto } from './project.dto.js';
import { userPublicSelect } from '@/domain/user.model.js';

export const projectHandler: FastifyPluginAsync = async (app) => {
  app
    .withTypeProvider<ZodTypeProvider>()
    .post(
      '/projects',
      {
        schema: {
          tags: ['Projects'],
          security: [{ BearerAuth: [] }],
          body: ProjectDto.createProjectBodySchema,
          response: {
            201: ProjectDto.createProjectResponseSchema,
          },
        },
        preHandler: [app.authenticate(), app.checkRole(['ADMIN', 'MANAGER'])],
      },
      async (req, reply) => {
        const { name, description } = req.body;
        const createdById = req.user.id;

        const created = await app.prisma.project.create({
          data: {
            name,
            description,
            createdById,
            members: {
              create: {
                userId: createdById,
              },
            },
          },
          include: {
            members: {
              include: {
                user: { select: userPublicSelect },
              },
            },
            createdBy: { select: userPublicSelect },
          },
        });

        return reply.code(201).send({ ok: true, data: created, error: null });
      },
    )
    .get(
      '/projects',
      {
        schema: {
          tags: ['Projects'],
          security: [{ BearerAuth: [] }],
          response: {
            200: ProjectDto.projectsListResponseSchema,
          },
        },
        preHandler: [app.authenticate()],
      },
      async (req, reply) => {
        const userId = req.user.id;
        const projects = await app.prisma.project.findMany({
          where: {
            OR: [{ createdById: userId }, { members: { some: { userId } } }],
            status: 'ACTIVE',
          },
          orderBy: { createdAt: 'desc' },
          include: {
            members: {
              include: {
                user: { select: userPublicSelect },
              },
            },
            createdBy: { select: userPublicSelect },
          },
        });
        return reply.send({ ok: true, data: projects, error: null });
      },
    )
    .get(
      '/projects/:projectId',
      {
        schema: {
          tags: ['Projects'],
          security: [{ BearerAuth: [] }],
          params: ProjectDto.getProjectByIdParamsSchema,
          response: {
            200: ProjectDto.getProjectByIdResponseSchema,
            404: ProjectDto.getProjectByIdResponseSchema,
          },
        },
        preHandler: [app.authenticate()],
      },
      async (req, reply) => {
        const projectId = req.params.projectId;

        const project = await app.prisma.project.findUnique({
          where: { id: projectId, status: 'ACTIVE' },
          include: {
            members: {
              include: {
                user: { select: userPublicSelect },
              },
            },
            createdBy: { select: userPublicSelect },
          },
        });
        if (!project) {
          return reply
            .code(404)
            .send({ ok: false, data: null, error: { code: 404, message: 'Проект не найден' } });
        }
        return reply.send({ ok: true, data: project, error: null });
      },
    );
};
