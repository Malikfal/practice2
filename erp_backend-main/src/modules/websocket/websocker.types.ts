import { AuthTokenPayloadType } from '@/domain/auth-token-payload.js';
import { WebSocket } from '@fastify/websocket';
import { z } from 'zod';

export const websocketMessageSchema = z.object({
  event: z.string(),
  data: z.unknown().optional(),
});

export const trackingUsersMessageSchema = z.object({
  event: z.literal('tracking-users'),
  data: z.array(z.string()),
});

export const trackingProjectsMessageSchema = z.object({
  event: z.literal('tracking-projects'),
  data: z.array(z.string()),
});

// Сотрудники компании с открытой панелью или приложением, кроме админов.
export const onlineUsersMessageSchema = z.object({
  event: z.literal('online-users'),
  data: z.array(z.string()),
});

export const startTrackingMessageSchema = z.object({
  event: z.literal('start-tracking'),
  data: z.object({
    projectId: z.string().min(1),
  }),
});

export const stopTrackingMessageSchema = z.object({
  event: z.literal('stop-tracking'),
  data: z.unknown().optional(),
});

export const notificationsRefreshMessageSchema = z.object({
  event: z.literal('notifications-refresh'),
  data: z.null(),
});

export const websocketOutgoingMessageSchema = z.union([
  trackingUsersMessageSchema,
  trackingProjectsMessageSchema,
  onlineUsersMessageSchema,
  notificationsRefreshMessageSchema,
]);

export const websocketIncomingMessageSchema = z.union([
  startTrackingMessageSchema,
  stopTrackingMessageSchema,
]);

export type WebsocketMessage = z.infer<typeof websocketMessageSchema>;
export type WebsocketOutgoingMessage = z.infer<typeof websocketOutgoingMessageSchema>;
export type WebsocketIncomingMessage = z.infer<typeof websocketIncomingMessageSchema>;
export type TrackingUsersMessage = z.infer<typeof trackingUsersMessageSchema>;
export type TrackingProjectsMessage = z.infer<typeof trackingProjectsMessageSchema>;
export type OnlineUsersMessage = z.infer<typeof onlineUsersMessageSchema>;
export type StartTrackingMessage = z.infer<typeof startTrackingMessageSchema>;
export type StopTrackingMessage = z.infer<typeof stopTrackingMessageSchema>;
export type NotificationsRefreshMessage = z.infer<typeof notificationsRefreshMessageSchema>;

// Сообщения, которые панель передаёт через PostgreSQL (pg_notify): Node только пересылает их пользователям.
export const relayedEventSchema = z.enum(['notification', 'notifications-unread-count']);

export const relayedMessageSchema = z.object({
  user_ids: z.array(z.string().min(1)).min(1),
  event: relayedEventSchema,
  data: z.unknown(),
});

export type RelayedMessage = z.infer<typeof relayedMessageSchema>;

export type WebSocketConnection = {
  device: AuthTokenPayloadType['device'];
  socket: WebSocket;
  userId: string;
  // null у пользователя без компании (суперадмин).
  companyId: string | null;
  // Клиентский аккаунт получает только уведомления: трекинг сотрудников ему не отправляется.
  isClient: boolean;
  // Админ трекает как обычно, но в «онлайн» не показывается.
  isAdmin: boolean;
  // Для heartbeat: ответил ли клиент на последний ping.
  isAlive: boolean;
};
