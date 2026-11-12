import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { authTokenPayloadSchema, AuthTokenPayloadType } from '../domain/auth-token-payload.js';
import { ApiResponse } from '@/lib/api-response-schema.js';
import jwt from 'jsonwebtoken';
import { ENV } from '@/env.js';

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthTokenPayloadType;
  }
  interface FastifyInstance {
    authenticate: () => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export const authPlugin: FastifyPluginAsync = fastifyPlugin(async (app) => {
  app.decorateRequest('user');

  app.decorate('authenticate', () => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const rawAuthorization = request.headers.authorization;
        if (!rawAuthorization || !rawAuthorization.startsWith('Bearer ')) {
          return reply.code(401).send({
            ok: false,
            data: null,
            error: {
              code: 401,
              message: 'Необходимо предоставить токен авторизации',
            },
          } as ApiResponse<unknown>);
        }

        const token = rawAuthorization.split(' ').at(1)?.trim();
        if (!token) {
          return reply.code(401).send({
            ok: false,
            data: null,
            error: {
              code: 401,
              message: 'Неверный формат токена авторизации',
            },
          } as ApiResponse<unknown>);
        }

        const verifiedPayload = jwt.verify(token, ENV.JWT_SECRET);
        const payload = authTokenPayloadSchema.safeParse(verifiedPayload);
        if (!payload.success) {
          return reply.code(401).send({
            ok: false,
            data: null,
            error: {
              code: 401,
              message: 'Неверный токен авторизации',
            },
          } as ApiResponse<unknown>);
        }

        if (payload.data.role === 'CLIENT') {
          return reply.code(403).send({
            ok: false,
            data: null,
            error: { code: 403, message: 'Клиентские аккаунты не имеют доступа к API сотрудников' },
          } as ApiResponse<unknown>);
        }

        request.user = payload.data;
      } catch (error) {
        return reply.code(401).send({
          ok: false,
          data: null,
          error: {
            code: 401,
            message: 'Не удалось аутентифицировать пользователя',
          },
        } as ApiResponse<unknown>);
      }
    };
  });
});
