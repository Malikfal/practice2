import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { ApiResponse } from '@/lib/api-response-schema.js';
import jwt from 'jsonwebtoken';
import { ENV } from '@/env.js';
import { authTokenPayloadSchema, AuthTokenPayloadType } from '@/domain/auth-token-payload.js';

declare module 'fastify' {
  interface FastifyRequest {
    userFromWebsocket: AuthTokenPayloadType;
  }
  interface FastifyInstance {
    authWebsocket: () => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export const authWebsocketPlugin: FastifyPluginAsync = fastifyPlugin(async (app) => {
  app.decorateRequest('userFromWebsocket');

  app.decorate('authWebsocket', () => {
    return async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const reqQuery = req.query as Record<string, string>;

        const token = (
          req.cookies['erp_access_token'] ||
          req.cookies['access_token'] ||
          reqQuery['access_token'] ||
          reqQuery['token'] ||
          ''
        ).trim();

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

        // Клиентские аккаунты подключаются только за уведомлениями: трекинг им не отправляется (WebsocketService).
        req.userFromWebsocket = payload.data;
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
