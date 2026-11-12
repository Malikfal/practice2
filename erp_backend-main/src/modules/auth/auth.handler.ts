import { FastifyPluginAsync } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { AuthDto } from './auth.dto.js';
import { authTokenPayloadSchema, AuthTokenPayloadType } from '@/domain/auth-token-payload.js';
import bcrypt from 'bcryptjs';
import { userPublicSelect } from '@/domain/user.model.js';
import jwt from 'jsonwebtoken';
import { ENV } from '@/env.js';
import { roleSchema } from '@/domain/enums.js';
import cripto from 'node:crypto';
import { tryCatch } from '@/lib/try.js';

export const authHandler: FastifyPluginAsync = async (app) => {
  function generateTokens(payload: AuthTokenPayloadType) {
    const accessToken = jwt.sign(payload, ENV.JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign(payload, ENV.JWT_SECRET, { expiresIn: '30d' });
    return { accessToken, refreshToken };
  }

  function getAuthPayload(user: {
    id: string;
    role: { name: string } | null;
  }): AuthTokenPayloadType {
    return {
      id: user.id,
      role: user.role ? roleSchema.parse(user.role.name) : null,
      device: 'desktop',
    };
  }

  function hashToken(token: string) {
    return cripto.createHash('sha256').update(token).digest('hex');
  }

  const TRACKER_LOCKED_MESSAGE =
    'Трекер ФЛОУ доступен на тарифе ПРО. Сменить тариф можно в панели: Настройки → Подписка и платежи.';

  // На тарифе ФРИ трекер закрыт. Тарифы ведёт Laravel, поэтому читаем их сырым запросом.
  async function isTrackerLocked(userId: string) {
    try {
      const rows = await app.prisma.$queryRaw<{ plan: string | null }[]>`
        SELECT t.plan FROM users u
        JOIN companies c ON c.id = u.company_id
        LEFT JOIN tariffs t ON t.id = c.tariff_id
        WHERE u.id = ${userId}::uuid`;
      return rows[0]?.plan === 'free';
    } catch (error) {
      // Без колонки plan (миграция ещё не выложена) трекер не блокируем.
      app.log.warn({ err: error }, 'Tariff check failed');
      return false;
    }
  }

  app
    .withTypeProvider<ZodTypeProvider>()
    .post(
      '/auth/login',
      {
        schema: {
          tags: ['Auth'],
          body: AuthDto.loginBodySchema,
          response: {
            200: AuthDto.loginResponseSchema,
            400: AuthDto.loginResponseSchema,
            403: AuthDto.loginResponseSchema,
            404: AuthDto.loginResponseSchema,
            500: AuthDto.loginResponseSchema,
          },
        },
      },
      async (req, reply) => {
        try {
          const { email, password } = req.body;

          const user = await app.prisma.user.findUnique({
            where: { email },
            select: {
              ...userPublicSelect,
              passwordHash: true,
            },
          });
          if (!user) {
            throw app.httpErrors.notFound('Пользователь не найден');
          }

          if (user.role?.name === 'CLIENT') {
            throw app.httpErrors.forbidden('Клиентские аккаунты не могут входить в API сотрудников');
          }

          if (user.status === 'BLOCKED') {
            throw app.httpErrors.forbidden('Пользователь заблокирован');
          }

          const isValid = await bcrypt.compare(password, user.passwordHash);
          if (!isValid) {
            throw app.httpErrors.badRequest('Неверный пароль');
          }

          if (await isTrackerLocked(user.id)) {
            throw app.httpErrors.forbidden(TRACKER_LOCKED_MESSAGE);
          }

          const { accessToken, refreshToken } = generateTokens(getAuthPayload(user));

          const refreshHash = hashToken(refreshToken);
          await app.prisma.refreshSessions.create({
            data: {
              userId: user.id,
              tokenHash: refreshHash,
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 дней
              lastUsedAt: new Date(),
            },
          });

          return reply.send({
            ok: true,
            data: {
              accessToken,
              refreshToken,
              user: user,
            },
            error: null,
          });
        } catch (error) {
          req.log.error({ err: error }, 'Auth login failed');

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
    .post(
      '/auth/refresh',
      {
        schema: {
          tags: ['Auth'],
          body: AuthDto.refreshTokenBodySchema,
          response: {
            200: AuthDto.refreshTokenResponseSchema,
            401: AuthDto.refreshTokenResponseSchema,
            403: AuthDto.refreshTokenResponseSchema,
            500: AuthDto.refreshTokenResponseSchema,
          },
        },
      },
      async (req, reply) => {
        try {
          // Получаем ссессию по хэшу токена
          const refreshSession = await app.prisma.refreshSessions.findUnique({
            where: {
              tokenHash: hashToken(req.body.refreshToken),
            },
          });
          if (!refreshSession) throw app.httpErrors.unauthorized('Неверный refresh token');

          // Пытаемся верефицировать токен и получить из него данные
          const payload = tryCatch(() => jwt.verify(req.body.refreshToken, ENV.JWT_SECRET));
          if (payload.error) {
            await app.prisma.refreshSessions.update({
              where: { id: refreshSession.id },
              data: { revokedAt: new Date() },
            });
            throw app.httpErrors.unauthorized('Неверный refresh token');
          }

          // Проверяем, что данные в токене валидные
          const parsedPayload = authTokenPayloadSchema.safeParse(payload.data);
          if (!parsedPayload.success) {
            await app.prisma.refreshSessions.update({
              where: { id: refreshSession.id },
              data: { revokedAt: new Date() },
            });
            throw app.httpErrors.unauthorized('Неверные данные');
          }

          // Получаем польователя, на которого был выдан токен
          const user = await app.prisma.user.findUnique({
            where: { id: parsedPayload.data.id },
            select: userPublicSelect,
          });
          if (!user) throw app.httpErrors.unauthorized('Пользователь не найден');
          if (user.role?.name === 'CLIENT') throw app.httpErrors.forbidden('Клиентские аккаунты не могут обновлять сессию API сотрудников');
          if (await isTrackerLocked(user.id)) throw app.httpErrors.forbidden(TRACKER_LOCKED_MESSAGE);

          // Генерируем новые токены
          const tokensData = tryCatch(() => generateTokens(getAuthPayload(user)));
          if (tokensData.error || !tokensData.data) {
            app.log.error(tokensData.error);
            throw app.httpErrors.unauthorized('Неверный refresh token');
          }

          // Обновляем сессию в базе
          await app.prisma.refreshSessions.update({
            where: { id: refreshSession.id },
            data: {
              lastUsedAt: new Date(),
              tokenHash: hashToken(tokensData.data.refreshToken),
              revokedAt: null,
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 дней
            },
          });

          return reply.status(200).send({
            ok: true,
            data: {
              accessToken: tokensData.data.accessToken,
              refreshToken: tokensData.data.refreshToken,
            },
            error: null,
          });
        } catch (error) {
          req.log.error({ err: error }, 'Auth refresh failed');

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
