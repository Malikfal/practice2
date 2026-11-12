import { useEffect, useRef, useState } from 'react';
import { WS_URL } from '../constants/app';
import { createRequest } from '../api/core/httpClient';
import { ApiRequestError } from '../api/core/error';
import { notificationsStore } from '../notifications/notificationsStore';
import type {
  NotificationMessage,
  NotificationsUnreadCountMessage,
  OnlineUsersMessage,
  TrackingProjectsMessage,
  TrackingUsersMessage,
  WebsocketEventIncoming,
  WebsocketMessage,
} from './websocket.types';

function resolveWebSocketUrl(): string {
  if (typeof window === 'undefined') return '';

  const rawUrl = WS_URL.trim();
  if (!rawUrl) return '';

  try {
    const url = new URL(rawUrl, window.location.origin);

    if (url.protocol === 'http:') {
      url.protocol = 'ws:';
    } else if (url.protocol === 'https:') {
      url.protocol = 'wss:';
    }

    return url.toString();
  } catch {
    return '';
  }
}

const RECONNECT_MIN_DELAY_MS = 1_000;
const RECONNECT_MAX_DELAY_MS = 30_000;
// Задержка сбрасывается, только если соединение продержалось: иначе сервер, закрывающий сокет сразу, опрашивали бы каждую секунду.
const RECONNECT_STABLE_MS = 10_000;

/**
 * Сокет основного API: сотрудникам — кто сейчас онлайн и трекает, всем — уведомления.
 * Клиентский аккаунт получает только уведомления.
 */
export function useWebSocketSubscription(isAuthorized: boolean, isClient = false) {
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const shouldReconnectRef = useRef(false);
  const [trackingUserIds, setTrackingUserIds] = useState<string[]>([]);
  const [trackingProjectIds, setTrackingProjectIds] = useState<string[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);

  useEffect(() => {
    const clearReconnectTimeout = () => {
      if (reconnectTimeoutRef.current !== null) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    const cleanupSocket = (socket?: WebSocket | null) => {
      const targetSocket = socket ?? socketRef.current;
      if (!targetSocket) return;

      if (socketRef.current === targetSocket) {
        socketRef.current = null;
      }

      targetSocket.close();
    };

    if (!isAuthorized) {
      shouldReconnectRef.current = false;
      clearReconnectTimeout();
      cleanupSocket();
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    const url = resolveWebSocketUrl();
    if (!url) return;

    shouldReconnectRef.current = true;
    const request = createRequest();
    let isConnectionAttemptInProgress = false;
    let isEffectActive = true;
    let reconnectAttempts = 0;
    let hasConnected = false;
    let stableTimeout: number | null = null;

    const scheduleReconnect = () => {
      if (!shouldReconnectRef.current || reconnectTimeoutRef.current !== null) {
        return;
      }

      // Если API недоступен, не опрашиваем его каждую секунду.
      const delay = Math.min(
        RECONNECT_MIN_DELAY_MS * 2 ** reconnectAttempts,
        RECONNECT_MAX_DELAY_MS,
      );
      reconnectAttempts += 1;

      reconnectTimeoutRef.current = window.setTimeout(() => {
        reconnectTimeoutRef.current = null;
        connect();
      }, delay);
    };

    const connect = async () => {
      if (!shouldReconnectRef.current || isConnectionAttemptInProgress) {
        return;
      }

      isConnectionAttemptInProgress = true;

      try {
        // WebSocket does not allow setting an Authorization header. Make an
        // authenticated HTTP request first so the HTTP client can refresh an
        // expired access cookie before the WebSocket handshake starts.
        await request(isClient ? '/client/profile' : '/users/me');
      } catch (error) {
        // 4xx (сессия, подписка, доступ) — не переподключаемся; недействительную сессию
        // HTTP-клиент сам сбрасывает и уводит на вход. Сеть и 5xx — пробуем позже.
        if (error instanceof ApiRequestError && error.status < 500) {
          shouldReconnectRef.current = false;
        } else if (isEffectActive) {
          scheduleReconnect();
        }
        return;
      } finally {
        isConnectionAttemptInProgress = false;
      }

      if (!isEffectActive || !shouldReconnectRef.current) return;

      const currentSocket = socketRef.current;
      if (
        currentSocket &&
        (currentSocket.readyState === WebSocket.OPEN ||
          currentSocket.readyState === WebSocket.CONNECTING)
      ) {
        return;
      }

      clearReconnectTimeout();

      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.addEventListener('open', () => {
        stableTimeout = window.setTimeout(() => {
          stableTimeout = null;
          reconnectAttempts = 0;
        }, RECONNECT_STABLE_MS);
        // Пока сокета не было, уведомления могли прийти: сверяем счётчик и список с сервером.
        if (hasConnected) notificationsStore.resync();
        hasConnected = true;
      });

      socket.addEventListener('message', (event) => {
        try {
          const message: WebsocketMessage<unknown, WebsocketEventIncoming> = JSON.parse(
            event.data,
          );
          if (message.event === 'tracking-users') {
            const trackingUsersMessage = message as TrackingUsersMessage;
            setTrackingUserIds(trackingUsersMessage.data);
          } else if (message.event === 'tracking-projects') {
            const trackingProjectsMessage = message as TrackingProjectsMessage;
            setTrackingProjectIds(trackingProjectsMessage.data);
          } else if (message.event === 'online-users') {
            setOnlineUserIds((message as OnlineUsersMessage).data);
          } else if (message.event === 'notification') {
            const { data } = message as NotificationMessage;
            notificationsStore.receive(data.notification, data.unread_count);
          } else if (message.event === 'notifications-unread-count') {
            const { data } = message as NotificationsUnreadCountMessage;
            notificationsStore.syncUnreadCount(
              data.unread_count,
              data.read_ids,
              data.resync,
            );
          } else if (message.event === 'notifications-refresh') {
            notificationsStore.resync();
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      });

      socket.addEventListener('close', () => {
        if (stableTimeout !== null) {
          window.clearTimeout(stableTimeout);
          stableTimeout = null;
        }
        if (socketRef.current === socket) {
          socketRef.current = null;
        }

        if (shouldReconnectRef.current) {
          scheduleReconnect();
        }
      });

      socket.addEventListener('error', (event) => {
        console.error('WebSocket error:', event);
        socket.close();
      });
    };

    connect();

    return () => {
      isEffectActive = false;
      shouldReconnectRef.current = false;
      if (stableTimeout !== null) window.clearTimeout(stableTimeout);
      clearReconnectTimeout();
      cleanupSocket();
      setTrackingUserIds([]);
      setTrackingProjectIds([]);
      setOnlineUserIds([]);
    };
  }, [isAuthorized, isClient]);

  return { trackingUserIds, trackingProjectIds, onlineUserIds };
}
