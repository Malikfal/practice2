<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\Notifications\UserNotificationResource;
use App\Models\Task;
use App\Services\Notifications\NotificationSettingsService;
use App\Services\Notifications\UserNotificationService;
use App\Services\Workspace\TaskViewService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Лента уведомлений и личные настройки. Один контроллер обслуживает сотрудников (/api/notifications)
 * и клиентов (/api/client/notifications): пользователь видит только свои уведомления.
 */
class NotificationController extends Controller
{
    public function __construct(
        private readonly UserNotificationService $feed,
        private readonly NotificationSettingsService $settings,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'unread' => ['sometimes', 'boolean'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:50'],
            'cursor' => ['sometimes', 'nullable', 'string'],
            'type' => ['sometimes', 'string', 'max:64'],
        ]);
        $user = $request->user();
        $page = $this->feed->list($user, $filters);

        return response()->json([
            'data' => UserNotificationResource::collection(collect($page->items()))->resolve($request),
            'next_cursor' => $page->nextCursor()?->encode(),
            'unread_count' => $this->feed->unreadCount($user),
        ]);
    }

    public function unreadCount(Request $request): JsonResponse
    {
        return response()->json(['unread_count' => $this->feed->unreadCount($request->user())]);
    }

    public function read(Request $request, string $notification): JsonResponse
    {
        return response()->json(['unread_count' => $this->feed->markRead($request->user(), $notification)]);
    }

    public function readAll(Request $request): JsonResponse
    {
        return response()->json(['unread_count' => $this->feed->markAllRead($request->user())]);
    }

    /**
     * Пользователь открыл задачу: её уведомления прочитаны. Задача уже ограничена компанией пользователя.
     */
    public function readTask(Request $request, Task $task): JsonResponse
    {
        return response()->json(['unread_count' => $this->feed->markTaskRead($request->user(), $task)]);
    }

    /**
     * Пользователь открыл или закрыл задачу: метка "Есть изменения" для него снимается.
     */
    public function viewTask(Request $request, Task $task, TaskViewService $views): JsonResponse
    {
        $views->markViewed($request->user(), $task);

        return response()->json(['viewed' => true]);
    }

    public function settings(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->settings->userSettings($request->user())]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $data = $request->validate([
            'events' => ['sometimes', 'array'],
            'events.*.key' => ['required', 'string', 'max:64'],
            'events.*.enabled' => ['required', 'boolean'],
            'auto_watch' => ['sometimes', 'nullable', 'boolean'],
        ]);

        return response()->json(['data' => $this->settings->updateUserSettings($request->user(), [
            'events' => collect($data['events'] ?? [])
                ->mapWithKeys(static fn (array $item): array => [(string) $item['key'] => (bool) $item['enabled']])
                ->all(),
            'auto_watch' => $data['auto_watch'] ?? null,
        ])]);
    }
}
