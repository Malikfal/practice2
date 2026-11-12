import { RoleType } from '@/domain/enums.js';
import { ApiResponse } from '@/lib/api-response-schema.js';
import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fastifyPlugin from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyInstance {
    checkRole: (
      roles: RoleType[],
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export const rolePlugin: FastifyPluginAsync = fastifyPlugin(async (app) => {
  app.decorate('checkRole', (roles: RoleType[]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.user?.role || !roles.includes(request.user.role)) {
        return reply.code(403).send({
          ok: false,
          data: undefined,
          error: {
            code: 403,
            message: `Роль ${request.user?.role} не имеет разрешения на выполнение этого действия`,
          },
        } as ApiResponse<unknown>);
      }
    };
  });
});
