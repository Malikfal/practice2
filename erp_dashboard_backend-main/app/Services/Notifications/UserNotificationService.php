<?php

namespace App\Services\Notifications;

use App\Http\Resources\Notifications\UserNotificationResource;
use App\Models\Task;
use App\Models\User;
use App\Models\UserNotification;
use Illuminate\Contracts\Pagination\CursorPaginator;
use Illuminate\Database\Eloquent\Builder;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Лента уведомлений пользователя: список, счётчик непрочитанных, прочтение.
 * После прочтения другие вкладки пользователя получают через WebSocket новый счётчик и id прочитанных.
 */
class UserNotificationService
{
    private const DEFAULT_LIMIT = 20;

    private const MAX_LIMIT = 50;

    public function __construct(
        private readonly NotificationPublisher $publisher,
    ) {}

    /**
     * @param  array{unread?: bool, limit?: int, type?: string}  $filters
     * @return CursorPaginator<int, UserNotification>
     */
    public function list(User $user, array $filters): CursorPaginator
    {
        $limit = min(self::MAX_LIMIT, max(1, (int) ($filters['limit'] ?? self::DEFAULT_LIMIT)));

        return UserNotification::query()
            ->where('user_id', $user->id)
            ->when((bool) ($filters['unread'] ?? false), fn ($query) => $query->whereNull('read_at'))
            ->when(($filters['type'] ?? '') !== '', fn ($query) => $query->where('type', $filters['type']))
            ->with(UserNotificationResource::RELATIONS)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->cursorPaginate($limit);
    }

    public function unreadCount(User $user): int
    {
        return $this->unreadCountFor((string) $user->id);
    }

    public function unreadCountFor(string $userId): int
    {
        return UserNotification::query()
            ->where('user_id', $userId)
            ->whereNull('read_at')
            ->count();
    }

    public function markRead(User $user, string $notificationId): int
    {
        $exists = UserNotification::query()
            ->where('user_id', $user->id)
            ->whereKey($notificationId)
            ->exists();

        if (! $exists) {
            throw new NotFoundHttpException;
        }

        return $this->markAsRead($user, static fn (Builder $query): Builder => $query->whereKey($notificationId));
    }

    public function markAllRead(User $user): int
    {
        return $this->markAsRead($user, static fn (Builder $query): Builder => $query);
    }

    /**
     * Пользователь открыл задачу: всё, что о ней пришло, прочитано.
     */
    public function markTaskRead(User $user, Task $task): int
    {
        return $this->markAsRead($user, static fn (Builder $query): Builder => $query->where('task_id', $task->id));
    }

    /**
     * Отмечает прочитанными непрочитанные уведомления из выборки и сообщает остальным вкладкам пользователя,
     * какие именно. Обновляются только найденные строки: пришедшее за это время останется непрочитанным и там, и там.
     *
     * @param  callable(Builder<UserNotification>): Builder<UserNotification>  $scope
     */
    private function markAsRead(User $user, callable $scope): int
    {
        $ids = $scope(UserNotification::query()->where('user_id', $user->id)->whereNull('read_at'))
            ->pluck('id')
            ->map(static fn ($id): string => (string) $id)
            ->all();

        if ($ids === []) {
            return $this->unreadCount($user);
        }

        UserNotification::query()->whereKey($ids)->whereNull('read_at')->update(['read_at' => now()]);

        $count = $this->unreadCount($user);
        $this->publisher->unreadCount((string) $user->id, $count, $ids);

        return $count;
    }
}
