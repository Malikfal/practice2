<?php

namespace App\Services\Notifications;

use App\Http\Resources\Notifications\UserNotificationResource;
use App\Models\UserNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Сообщает основному API (Node, WebSocket /ws) о новых уведомлениях через PostgreSQL NOTIFY.
 *
 * Node слушает канал и пересылает {event, data} открытым сокетам пользователей из user_ids.
 * NOTIFY внутри транзакции доставляется только после коммита, поэтому клиент не узнает о строке,
 * которой ещё нет в базе. Источник истины — REST: сокет только подсказывает, что пора обновиться.
 */
class NotificationPublisher
{
    public const CHANNEL = 'erp_notifications';

    public const EVENT_NOTIFICATION = 'notification';

    public const EVENT_UNREAD_COUNT = 'notifications-unread-count';

    /**
     * Лимит PostgreSQL на payload — 8000 байт, оставляем запас на служебные поля.
     */
    private const MAX_PAYLOAD_BYTES = 7500;

    public function notification(UserNotification $notification, int $unreadCount): void
    {
        $notification->loadMissing(UserNotificationResource::RELATIONS);

        $sent = $this->send([(string) $notification->user_id], self::EVENT_NOTIFICATION, [
            'notification' => UserNotificationResource::make($notification)->resolve(),
            'unread_count' => $unreadCount,
        ]);

        // Слишком длинное уведомление не пролезет в канал: открытые списки перечитают ленту сами.
        if (! $sent) {
            $this->resync((string) $notification->user_id, $unreadCount);
        }
    }

    /**
     * Новый счётчик после прочтения. read_ids — что именно прочитано: другие вкладки и устройства
     * снимут отметки в уже загруженном списке, не перезагружая его.
     *
     * @param  array<int, string>  $readIds
     */
    public function unreadCount(string $userId, int $unreadCount, array $readIds = []): void
    {
        $data = ['unread_count' => $unreadCount];
        if ($readIds !== []) {
            $data['read_ids'] = array_values($readIds);
        }

        // Слишком много id для канала: открытые списки перечитают ленту сами.
        if (! $this->send([$userId], self::EVENT_UNREAD_COUNT, $data)) {
            $this->resync($userId, $unreadCount);
        }
    }

    private function resync(string $userId, int $unreadCount): void
    {
        $this->send([$userId], self::EVENT_UNREAD_COUNT, ['unread_count' => $unreadCount, 'resync' => true]);
    }

    /**
     * @param  array<int, string>  $userIds
     * @param  array<string, mixed>  $data
     */
    private function send(array $userIds, string $event, array $data): bool
    {
        // Канал есть только в PostgreSQL; в тестах на SQLite отправлять некуда.
        if (DB::connection()->getDriverName() !== 'pgsql') {
            return true;
        }

        try {
            $payload = json_encode(
                ['user_ids' => array_values($userIds), 'event' => $event, 'data' => $data],
                JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
            );

            if (strlen($payload) > self::MAX_PAYLOAD_BYTES) {
                return false;
            }

            DB::select('SELECT pg_notify(?, ?)', [self::CHANNEL, $payload]);
        } catch (Throwable $e) {
            // Доставка в реальном времени не должна ломать сохранение: уведомление уже в ленте.
            Log::warning('Не удалось отправить уведомление в канал PostgreSQL', [
                'event' => $event,
                'message' => $e->getMessage(),
            ]);
        }

        return true;
    }
}
