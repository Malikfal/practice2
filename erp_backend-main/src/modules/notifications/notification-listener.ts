import pg from 'pg';
import { FastifyBaseLogger } from 'fastify';

// Канал, в который панель (Laravel) пишет через pg_notify после сохранения уведомления.
export const NOTIFICATIONS_CHANNEL = 'erp_notifications';

const RECONNECT_MIN_DELAY_MS = 1_000;
const RECONNECT_MAX_DELAY_MS = 30_000;

type NotificationListenerOptions = {
  connectionString: string;
  logger: FastifyBaseLogger;
  onPayload: (payload: string) => void;
  // Соединение восстановлено после обрыва: уведомления за это время могли потеряться.
  onReconnect?: () => void;
};

/**
 * Отдельное соединение с PostgreSQL, которое слушает канал уведомлений (LISTEN).
 * Prisma держит свой пул, поэтому здесь используется pg.Client напрямую.
 * pg.Client сам не переподключается: после обрыва создаём новое соединение с нарастающей задержкой.
 */
export class NotificationListener {
  private client: pg.Client | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private attempts = 0;
  private hasConnected = false;
  private isClosing = false;

  constructor(private readonly options: NotificationListenerOptions) {}

  async start() {
    await this.connect();
  }

  async close() {
    this.isClosing = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const client = this.client;
    this.client = null;
    await client?.end().catch(() => undefined);
  }

  private async connect() {
    if (this.isClosing) return;

    const client = new pg.Client({ connectionString: this.options.connectionString });
    this.client = client;

    client.on('notification', (message) => {
      if (message.channel !== NOTIFICATIONS_CHANNEL || !message.payload) return;
      this.options.onPayload(message.payload);
    });
    client.on('error', (err) => {
      this.options.logger.error({ err }, 'Notifications listener connection error');
      this.scheduleReconnect(client);
    });
    client.on('end', () => this.scheduleReconnect(client));

    try {
      await client.connect();
      await client.query(`LISTEN ${NOTIFICATIONS_CHANNEL}`);
    } catch (err) {
      this.options.logger.error({ err }, 'Failed to listen for notifications');
      this.scheduleReconnect(client);
      return;
    }

    const isReconnect = this.hasConnected;
    this.hasConnected = true;
    this.attempts = 0;
    this.options.logger.info(`Listening for notifications on channel ${NOTIFICATIONS_CHANNEL}`);

    if (isReconnect) {
      this.options.onReconnect?.();
    }
  }

  private scheduleReconnect(client: pg.Client) {
    // 'error' и 'end' приходят для одного обрыва, переподключаемся один раз.
    if (this.isClosing || this.client !== client) return;
    this.client = null;
    client.removeAllListeners('notification');
    void client.end().catch(() => undefined);

    const delay = Math.min(RECONNECT_MIN_DELAY_MS * 2 ** this.attempts, RECONNECT_MAX_DELAY_MS);
    this.attempts += 1;
    this.options.logger.warn({ delay }, 'Notifications listener reconnect scheduled');

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delay);
  }
}
