import { FastifyPluginAsync } from 'fastify';
import {
  relayedMessageSchema,
  startTrackingMessageSchema,
  WebSocketConnection,
  websocketMessageSchema,
} from './websocker.types.js';
import { WebsocketService } from './websocker.service.js';
import { tryCatch, tryCatchAsync } from '@/lib/try.js';
import { ENV } from '@/env.js';
import { NotificationListener } from '../notifications/notification-listener.js';

type WebsocketAccount = {
  companyId: string | null;
  isClient: boolean;
  isAdmin: boolean;
};

export const websocketHanlder: FastifyPluginAsync = async (app) => {
  const logger = app.log.child({}, { msgPrefix: '[WebsocketHandler] ' });
  const websocketService = new WebsocketService(app.redis, logger);
  const notificationListener = new NotificationListener({
    connectionString: ENV.DATABASE_URL,
    logger: app.log.child({}, { msgPrefix: '[NotificationListener] ' }),
    onPayload: (payload) => {
      const { data: message, error } = tryCatch(() =>
        relayedMessageSchema.parse(JSON.parse(payload)),
      );
      if (error || !message) {
        logger.warn({ err: error }, 'Invalid notification payload');
        return;
      }
      websocketService.relay(message);
    },
    onReconnect: () => websocketService.requestNotificationsRefresh(),
  });
  app.addHook('onClose', async () => {
    await websocketService.close();
    await notificationListener.close();
  });
  await websocketService.listenTrackingChanges();
  websocketService.startHeartbeat();
  await notificationListener.start();

  // Компании и статуса нет в токене, а роль в нём могла устареть: берём их из базы при подключении.
  const loadAccount = async (userId: string): Promise<WebsocketAccount | null> => {
    const rows = await app.prisma.$queryRaw<
      Array<{ company_id: string | null; status: string; role: string | null }>
    >`
      SELECT u.company_id::text AS company_id, u.status::text AS status, r.name AS role
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.id::text = ${userId}
      LIMIT 1
    `;
    const account = rows[0];
    if (!account || account.status === 'BLOCKED') return null;

    return {
      companyId: account.company_id,
      isClient: account.role === 'CLIENT',
      isAdmin: account.role === 'ADMIN',
    };
  };

  app.get('/ws', { websocket: true, preHandler: [app.authWebsocket()] }, async (socket, req) => {
    const user = req.userFromWebsocket;

    const userConnection: WebSocketConnection = {
      socket: socket,
      device: user.device,
      userId: user.id,
      companyId: null,
      isClient: user.role === 'CLIENT',
      isAdmin: false,
      isAlive: true,
    };

    socket.on('pong', () => {
      userConnection.isAlive = true;
    });
    socket.on('error', (err) => {
      logger.warn({ err, userId: user.id }, 'Websocket error');
    });

    // Обработчики вешаются сразу: сообщения, пришедшие до конца регистрации, ждут её, а не теряются.
    const registration = (async () => {
      const { data: account, error } = await tryCatchAsync(() => loadAccount(user.id));
      if (error || !account) {
        if (error)
          logger.error({ err: error, userId: user.id }, 'Failed to load websocket account');
        socket.close(4401, 'Unauthorized');
        return null;
      }

      userConnection.companyId = account.companyId;
      userConnection.isClient = account.isClient;
      userConnection.isAdmin = account.isAdmin;

      return websocketService.addConnection(user.id, userConnection);
    })().catch((err) => {
      logger.error({ err, userId: user.id }, 'Failed to register websocket connection');
      socket.terminate();
      return null;
    });

    socket.on('message', async (data) => {
      const connectionId = await registration;
      if (!connectionId) return;

      const rawData = data.toString();
      const { data: messageData, error } = tryCatch(() =>
        websocketMessageSchema.parse(JSON.parse(rawData)),
      );

      if (error || !messageData) {
        logger.warn({ error, rawData }, 'Failed to parse websocket message');
        return;
      }

      // Клиентский аккаунт ничего не трекает.
      if (userConnection.isClient) {
        logger.warn(
          { event: messageData.event, userId: user.id },
          'Ignored client websocket event',
        );
        return;
      }

      switch (messageData.event) {
        case 'start-tracking':
          const startTrackingMessage = startTrackingMessageSchema.safeParse(messageData);
          if (!startTrackingMessage.success) {
            logger.warn(
              { error: startTrackingMessage.error, messageData },
              'Invalid start-tracking websocket message',
            );
            return;
          }
          await websocketService.startTracking(user.id, startTrackingMessage.data.data.projectId);
          break;
        case 'stop-tracking':
          await websocketService.stopTracking(user.id);
          break;
        default:
          logger.warn({ event: messageData.event }, 'Unknown websocket event');
          break;
      }
    });

    socket.on('close', async (code, reason) => {
      logger.info({ userId: user.id, code, reason }, 'User disconnected from websocket');
      const connectionId = await registration;
      if (!connectionId) return;
      await websocketService.removeConnection(user.id, connectionId);
    });
  });
};
