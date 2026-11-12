import { FastifyPluginAsync } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { UserDto } from './user.dto.js';
import bcrypt from 'bcryptjs';
import { userPublicSelect } from '@/domain/user.model.js';

export const userHandler: FastifyPluginAsync = async (app) => {
  app
    .withTypeProvider<ZodTypeProvider>()
    .get(
      '/users/me',
      {
        schema: {
          tags: ['Users'],
          security: [{ BearerAuth: [] }],
          response: {
            200: UserDto.meResponseSchema,
            404: UserDto.meResponseSchema,
          },
        },
        preHandler: [app.authenticate()],
      },
      async (req, reply) => {
        const userId = req.user.id;

        const profile = await app.prisma.user.findUnique({
          where: { id: userId },
          select: userPublicSelect,
        });
        if (!profile) {
          return reply.code(404).send({
            ok: false,
            data: null,
            error: { code: 404, message: 'Пользователь не найден' },
          });
        }
        return reply.code(200).send({ ok: true, data: profile, error: null });
      },
    )
    .get(
      '/users',
      {
        schema: {
          tags: ['Users'],
          security: [{ BearerAuth: [] }],
          response: {
            200: UserDto.usersListResponseSchema,
          },
        },
        preHandler: [app.authenticate()],
      },
      async (req, reply) => {
        const users = await app.prisma.user.findMany({
          orderBy: { createdAt: 'desc' },
          select: userPublicSelect,
        });
        return reply.code(200).send({ ok: true, data: users, error: null });
      },
    )
    .patch(
      '/users/:id/role',
      {
        schema: {
          tags: ['Users'],
          security: [{ BearerAuth: [] }],
          params: UserDto.updateRoleParamsSchema,
          body: UserDto.updateRoleBodySchema,
          response: {
            200: UserDto.updateRoleResponseSchema,
          },
        },
        preHandler: [app.authenticate(), app.checkRole(['ADMIN'])],
      },
      async (req, reply) => {
        const { role } = req.body;
        const userId = req.params.id;

        const updated = await app.prisma.user.update({
          where: { id: userId },
          data: {
            role: {
              connectOrCreate: {
                where: { name_guardName: { name: role, guardName: 'api' } },
                create: { name: role, guardName: 'api' },
              },
            },
          },
          select: userPublicSelect,
        });

        return reply.code(200).send({ ok: true, data: updated, error: null });
      },
    )
    .patch(
      '/users/change-password',
      {
        schema: {
          tags: ['Users'],
          security: [{ BearerAuth: [] }],
          body: UserDto.updatePasswordBodySchema,
          response: {
            200: UserDto.updatePasswordResponseSchema,
            401: UserDto.updatePasswordResponseSchema,
            404: UserDto.updatePasswordResponseSchema,
          },
        },
        preHandler: [app.authenticate()],
      },
      async (req, reply) => {
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;

        const user = await app.prisma.user.findUnique({
          where: { id: userId },
          select: { passwordHash: true },
        });

        if (!user) {
          return reply.code(404).send({
            ok: false,
            data: null,
            error: { code: 404, message: 'Пользователь не найден' },
          });
        }

        const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isValid) {
          return reply.code(401).send({
            ok: false,
            data: null,
            error: { code: 401, message: 'Неверный текущий пароль' },
          });
        }

        const newHash = await bcrypt.hash(newPassword, 12);
        const updatedUser = await app.prisma.user.update({
          where: { id: userId },
          data: { passwordHash: newHash },
          select: userPublicSelect,
        });

        return reply.code(200).send({
          ok: true,
          data: updatedUser,
          error: null,
        });
      },
    );
};
