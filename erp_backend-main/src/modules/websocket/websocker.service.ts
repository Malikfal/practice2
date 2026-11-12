import { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import { FastifyBaseLogger } from 'fastify';
import {
  WebSocketConnection,
  TrackingProjectsMessage,
  TrackingUsersMessage,
  OnlineUsersMessage,
  NotificationsRefreshMessage,
  RelayedMessage,
} from './websocker.types.js';

const ONLINE_USERS_KEY = 'websocket:online-users';
const TRACKING_USERS_KEY = 'websocket:tracking-users';
const TRACKING_PROJECTS_BY_USER_KEY = 'websocket:tracking-projects-by-user';
const TRACKING_CHANGED_CHANNEL = 'websocket:tracking:changed';
const USER_CONNECTIONS_KEY_PREFIX = 'websocket:user-connections:';
// Компания подключённого сотрудника: трекинг рассылается только внутри компании.
const USER_COMPANIES_KEY = 'websocket:user-companies';
// Сервер сам пингует сокеты: прокси закрывает соединения без трафика, а оборванные нужно вовремя убирать.
const HEARTBEAT_INTERVAL_MS = 30_000;

type TrackingState = {
  userIds: string[];
  onlineUserIds: string[];
  projectIdByUser: Record<string, string>;
  companyByUser: Record<string, string>;
};

export class WebsocketService {
  private readonly instanceId = randomUUID();
  private readonly redisSubscriber: Redis;
  private readonly connectionIdsByUserId = new Map<string, Set<string>>();
  private readonly connectionsById = new Map<string, WebSocketConnection>();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  // Сокеты закрываются раньше close() (preClose в @fastify/websocket): их уборку в Redis нужно дождаться.
  private readonly pendingRemovals = new Set<Promise<void>>();
  private isClosing = false;

  constructor(
    private readonly redis: Redis,
    private readonly logger: FastifyBaseLogger,
  ) {
    this.redisSubscriber = this.redis.duplicate();
  }

  async listenTrackingChanges() {
    await this.redisSubscriber.subscribe(TRACKING_CHANGED_CHANNEL);
    this.redisSubscriber.on('message', (channel) => {
      if (channel !== TRACKING_CHANGED_CHANNEL || this.isClosing) return;
      this.broadcastTrackingState().catch((err) => {
        this.logger.warn({ err }, 'Failed to broadcast tracking state');
      });
    });
  }

  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => this.checkConnections(), HEARTBEAT_INTERVAL_MS);
  }

  /**
   * Пересылает сообщение панели (например, новое уведомление) всем открытым вкладкам и приложениям пользователей.
   */
  relay(message: RelayedMessage) {
    const payload = JSON.stringify({ event: message.event, data: message.data });

    for (const userId of message.user_ids) {
      for (const connectionId of this.connectionIdsByUserId.get(userId) ?? []) {
        const connection = this.connectionsById.get(connectionId);
        if (connection) this.sendRaw(connection, payload);
      }
    }
  }

  /**
   * Канал уведомлений переподключился: за время обрыва что-то могло не дойти, клиенты перечитают счётчик.
   */
  requestNotificationsRefresh() {
    const message: NotificationsRefreshMessage = { event: 'notifications-refresh', data: null };
    const payload = JSON.stringify(message);

    for (const connection of this.connectionsById.values()) {
      this.sendRaw(connection, payload);
    }
  }

  async addConnection(userId: string, userConnection: WebSocketConnection) {
    if (this.isClosing) {
      userConnection.socket.close();
      return null;
    }

    const connectionId = this.createConnectionId();

    this.connectionsById.set(connectionId, userConnection);
    if (!this.connectionIdsByUserId.has(userId)) {
      this.connectionIdsByUserId.set(userId, new Set());
    }
    this.connectionIdsByUserId.get(userId)?.add(connectionId);

    this.logger.info(
      `User ${userId} connected via websocket, connections count: ${this.connectionIdsByUserId.get(userId)?.size}`,
    );

    // Клиентский аккаунт не участвует в «онлайн» и трекинге, ему нужны только уведомления.
    if (userConnection.isClient) {
      return connectionId;
    }

    const transaction = this.redis.multi();
    // Админа убираем и из старых записей: процесс мог упасть, не убрав свои подключения.
    if (userConnection.isAdmin) transaction.srem(ONLINE_USERS_KEY, userId);
    else transaction.sadd(ONLINE_USERS_KEY, userId);
    await transaction
      .sadd(this.getUserConnectionsKey(userId), connectionId)
      .hset(USER_COMPANIES_KEY, userId, userConnection.companyId ?? '')
      .exec()
      .catch((err) => {
        this.logger.error({ err, userId, connectionId }, 'Failed to add websocket connection');
      });

    // Новый сотрудник онлайн: состояние нужно всем вкладкам компании, а не только этой.
    await this.publishTrackingChanged(userId).catch((err) => {
      this.logger.error({ err, userId, connectionId }, 'Failed to publish online state');
    });

    return connectionId;
  }

  async startTracking(userId: string, projectId: string) {
    await this.redis
      .multi()
      .sadd(TRACKING_USERS_KEY, userId)
      .hset(TRACKING_PROJECTS_BY_USER_KEY, userId, projectId)
      .publish(TRACKING_CHANGED_CHANNEL, userId)
      .exec();
  }

  async stopTracking(userId: string) {
    await this.redis
      .multi()
      .srem(TRACKING_USERS_KEY, userId)
      .hdel(TRACKING_PROJECTS_BY_USER_KEY, userId)
      .publish(TRACKING_CHANGED_CHANNEL, userId)
      .exec();
  }

  async removeConnection(userId: string, connectionId: string) {
    if (this.isClosing) return;

    const removal = this.removeConnectionState(userId, connectionId);
    this.pendingRemovals.add(removal);
    try {
      await removal;
    } finally {
      this.pendingRemovals.delete(removal);
    }
  }

  private async removeConnectionState(userId: string, connectionId: string) {
    const connection = this.connectionsById.get(connectionId);
    this.connectionsById.delete(connectionId);
    this.connectionIdsByUserId.get(userId)?.delete(connectionId);
    if (this.connectionIdsByUserId.get(userId)?.size === 0) {
      this.connectionIdsByUserId.delete(userId);
    }

    if (connection?.isClient) return;

    await this.redis.srem(this.getUserConnectionsKey(userId), connectionId);

    const userConnectionsCount = await this.redis.scard(this.getUserConnectionsKey(userId));
    if (userConnectionsCount === 0) {
      await this.redis
        .multi()
        .del(this.getUserConnectionsKey(userId))
        .srem(ONLINE_USERS_KEY, userId)
        .srem(TRACKING_USERS_KEY, userId)
        .hdel(TRACKING_PROJECTS_BY_USER_KEY, userId)
        .hdel(USER_COMPANIES_KEY, userId)
        .publish(TRACKING_CHANGED_CHANNEL, userId)
        .exec();
      return;
    }

    await this.publishTrackingChanged(userId);
  }

  async close() {
    this.isClosing = true;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    await Promise.allSettled(Array.from(this.pendingRemovals));

    const connectionIdsByUserId = new Map(
      Array.from(this.connectionIdsByUserId.entries())
        .filter(([, connectionIds]) =>
          Array.from(connectionIds).some((id) => !this.connectionsById.get(id)?.isClient),
        )
        .map(([userId, connectionIds]) => [userId, new Set(connectionIds)]),
    );
    const connections = Array.from(this.connectionsById.values());

    await Promise.all(
      Array.from(connectionIdsByUserId.entries()).map(async ([userId, localConnectionIds]) => {
        if (!localConnectionIds?.size) return;

        await this.redis.srem(this.getUserConnectionsKey(userId), ...localConnectionIds);

        const userConnectionsCount = await this.redis.scard(this.getUserConnectionsKey(userId));
        if (userConnectionsCount === 0) {
          await this.redis.del(this.getUserConnectionsKey(userId));
          await this.redis.srem(ONLINE_USERS_KEY, userId);
          await this.redis.srem(TRACKING_USERS_KEY, userId);
          await this.redis.hdel(TRACKING_PROJECTS_BY_USER_KEY, userId);
          await this.redis.hdel(USER_COMPANIES_KEY, userId);
        }
      }),
    );
    await this.publishTrackingChanged(this.instanceId);
    this.redisSubscriber.disconnect();

    for (const { socket } of connections) {
      if (socket.readyState === socket.CLOSED) continue;
      socket.close();
    }

    this.connectionIdsByUserId.clear();
    this.connectionsById.clear();
  }

  private async getTrackingState(): Promise<TrackingState> {
    const [userIds, onlineUserIds, projectIdByUser, companyByUser] = await Promise.all([
      this.redis.smembers(TRACKING_USERS_KEY),
      this.redis.smembers(ONLINE_USERS_KEY),
      this.redis.hgetall(TRACKING_PROJECTS_BY_USER_KEY),
      this.redis.hgetall(USER_COMPANIES_KEY),
    ]);

    return { userIds, onlineUserIds, projectIdByUser, companyByUser };
  }

  /**
   * Кто онлайн, кто трекает и в каких проектах — только по компании получателя.
   */
  private trackingMessagesFor(
    companyId: string | null,
    state: TrackingState,
  ): [TrackingUsersMessage, TrackingProjectsMessage, OnlineUsersMessage] {
    const company = companyId ?? '';
    const inCompany = (userId: string) => (state.companyByUser[userId] ?? '') === company;
    const userIds = state.userIds.filter(inCompany);
    const projectIds = new Set(
      userIds
        .map((userId) => state.projectIdByUser[userId])
        .filter((projectId): projectId is string => Boolean(projectId)),
    );

    return [
      { event: 'tracking-users', data: userIds },
      { event: 'tracking-projects', data: Array.from(projectIds) },
      { event: 'online-users', data: state.onlineUserIds.filter(inCompany) },
    ];
  }

  private async broadcastTrackingState() {
    const state = await this.getTrackingState();
    this.logger.info({ trackingUsersCount: state.userIds.length }, 'Broadcasting tracking state');

    for (const connection of this.connectionsById.values()) {
      if (connection.isClient) continue;
      this.sendMessages(connection, ...this.trackingMessagesFor(connection.companyId, state));
    }
  }

  private sendMessages(
    connection: WebSocketConnection,
    ...messages: Array<TrackingUsersMessage | TrackingProjectsMessage | OnlineUsersMessage>
  ) {
    for (const message of messages) {
      this.sendRaw(connection, JSON.stringify(message));
    }
  }

  private sendRaw(connection: WebSocketConnection, payload: string) {
    const { socket } = connection;
    if (socket.readyState !== socket.OPEN) return;

    socket.send(payload);
  }

  /**
   * Сокет, не ответивший на прошлый ping, считается оборванным: закрытие вызовет removeConnection.
   */
  private checkConnections() {
    for (const connection of this.connectionsById.values()) {
      const { socket } = connection;
      if (socket.readyState !== socket.OPEN) continue;

      if (!connection.isAlive) {
        socket.terminate();
        continue;
      }

      connection.isAlive = false;
      socket.ping();
    }
  }

  private async publishTrackingChanged(message: string) {
    await this.redis.publish(TRACKING_CHANGED_CHANNEL, message);
  }

  private getUserConnectionsKey(userId: string) {
    return `${USER_CONNECTIONS_KEY_PREFIX}${userId}`;
  }

  private createConnectionId() {
    return `${this.instanceId}:${randomUUID()}`;
  }
}
