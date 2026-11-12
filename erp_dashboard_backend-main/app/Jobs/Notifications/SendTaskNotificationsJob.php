<?php

namespace App\Jobs\Notifications;

use App\Enums\NotificationEvent;
use App\Models\Task;
use App\Models\User;
use App\Models\UserNotification;
use App\Services\Notifications\NotificationPublisher;
use App\Services\Notifications\NotificationRecipient;
use App\Services\Notifications\NotificationRecipientResolver;
use App\Services\Notifications\UserNotificationService;
use Carbon\CarbonImmutable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Создаёт уведомления об одном действии с задачей и отправляет их в WebSocket.
 *
 * Действие состоит из частей по приоритету: например, при сохранении задачи новые исполнители получают
 * «Назначение», а остальные — «Задача изменена». Каждый пользователь получает не больше одного уведомления
 * о действии: часть пропускает тех, кого уже уведомила предыдущая.
 */
class SendTaskNotificationsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Повторы одного автора по одной задаче сводятся в одно непрочитанное уведомление (×N в списке).
     */
    public const COLLAPSE_MINUTES = 15;

    private const COLLAPSIBLE_TYPES = [
        NotificationEvent::TASK_UPDATED_TYPE,
        'task.status_changed',
        'task.comment_added',
        'task.client_message_added',
        'task.client_reply_added',
        'task.attachment_added',
    ];

    public int $tries = 3;

    public int $timeout = 60;

    /**
     * @var array<int, int>
     */
    public array $backoff = [5, 30];

    /**
     * @param  array<int, array{events: array<int, string>, data: array<string, mixed>, only_user_ids: array<int, string>|null}>  $parts
     */
    public function __construct(
        public readonly string $taskId,
        public readonly ?string $actorId,
        public readonly array $parts,
        public readonly ?string $actorKind,
        public readonly string $occurredAt,
    ) {}

    public function handle(
        NotificationRecipientResolver $resolver,
        NotificationPublisher $publisher,
        UserNotificationService $feed,
    ): void {
        $task = Task::query()->with('project')->find($this->taskId);

        if (! $task || ! $task->project) {
            return;
        }

        $occurredAt = CarbonImmutable::parse($this->occurredAt);
        // Автор действия мог быть удалён, пока задание ждало очереди.
        $actorId = $this->actorId !== null && User::query()->withBlocked()->whereKey($this->actorId)->exists()
            ? $this->actorId
            : null;

        $stored = DB::transaction(function () use ($task, $resolver, $actorId, $occurredAt): array {
            $notified = [];
            $stored = [];

            foreach ($this->parts as $part) {
                $events = $this->events($part, $task);
                if ($events === []) {
                    continue;
                }

                $recipients = $resolver->resolve($task, $events, $this->actorId, $part['only_user_ids'] ?? null, $notified);

                foreach ($recipients as $userId => $recipient) {
                    $stored[] = $this->store($task, $actorId, $recipient, $part['data'] ?? [], $occurredAt);
                    $notified[] = (string) $userId;
                }
            }

            return $stored;
        });

        // После коммита: клиент сразу запросит то, что ему прислали. Ошибка здесь не должна повторять задание —
        // повтор сохранил бы уведомления ещё раз; без сокета лента всё равно обновится по REST.
        foreach ($stored as $notification) {
            try {
                $publisher->notification($notification, $feed->unreadCountFor((string) $notification->user_id));
            } catch (Throwable $exception) {
                report($exception);
            }
        }
    }

    /**
     * @param  array{events: array<int, string>}  $part
     * @return array<int, NotificationEvent>
     */
    private function events(array $part, Task $task): array
    {
        $events = array_values(array_filter(array_map(
            static fn (string $event): ?NotificationEvent => NotificationEvent::tryFrom($event),
            $part['events'] ?? [],
        )));

        // Задача могла стать черновиком, пока задание ждало очереди.
        if ($task->is_draft) {
            $events = array_values(array_filter(
                $events,
                static fn (NotificationEvent $event): bool => $event->notifiesForDrafts(),
            ));
        }

        return $events;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function store(
        Task $task,
        ?string $actorId,
        NotificationRecipient $recipient,
        array $data,
        CarbonImmutable $occurredAt,
    ): UserNotification {
        $type = $recipient->events[0]->type();
        $payload = $this->payloadFor($type, $data, $recipient);

        if (in_array($type, self::COLLAPSIBLE_TYPES, true)) {
            $existing = $this->collapsible($task, $actorId, $recipient, $type, $occurredAt);
            $merged = $existing ? $this->merge($type, $existing->data ?? [], $payload) : null;

            if ($existing && $merged !== null) {
                $existing->data = $merged;
                $existing->reasons = array_values(array_unique([...($existing->reasons ?? []), ...$recipient->reasonValues()]));
                $existing->created_at = $occurredAt;
                $existing->save();

                return $existing;
            }
        }

        $notification = new UserNotification([
            'company_id' => $task->project->company_id,
            'user_id' => $recipient->user->id,
            'actor_id' => $actorId,
            'type' => $type,
            'task_id' => $task->id,
            'project_id' => $task->project_id,
            'data' => $payload,
            'reasons' => $recipient->reasonValues(),
        ]);
        $notification->created_at = $occurredAt;
        $notification->updated_at = $occurredAt;
        $notification->save();

        return $notification;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function payloadFor(string $type, array $data, NotificationRecipient $recipient): array
    {
        if ($type === NotificationEvent::TASK_UPDATED_TYPE) {
            // Каждый видит только те изменения, о которых просил: например, только дедлайн.
            $changes = array_filter(
                $data['changes'] ?? [],
                static fn (string $field): bool => $recipient->receives(NotificationEvent::forField($field)),
                ARRAY_FILTER_USE_KEY,
            );
            $data = ['fields' => array_keys($changes), 'changes' => (object) $changes];
        }

        if ($this->actorKind !== null) {
            $data['actor_kind'] = $this->actorKind;
        }

        return $data;
    }

    private function collapsible(
        Task $task,
        ?string $actorId,
        NotificationRecipient $recipient,
        string $type,
        CarbonImmutable $occurredAt,
    ): ?UserNotification {
        return UserNotification::query()
            ->where('user_id', $recipient->user->id)
            ->where('task_id', $task->id)
            ->where('type', $type)
            ->when(
                $actorId !== null,
                fn ($query) => $query->where('actor_id', $actorId),
                fn ($query) => $query->whereNull('actor_id'),
            )
            ->whereNull('read_at')
            ->where('created_at', '>=', $occurredAt->subMinutes(self::COLLAPSE_MINUTES))
            ->orderByDesc('created_at')
            ->lockForUpdate()
            ->first();
    }

    /**
     * Сводит новое изменение с непрочитанным уведомлением. null — сводить нельзя, нужно новое уведомление.
     *
     * @param  array<string, mixed>  $existing
     * @param  array<string, mixed>  $incoming
     * @return array<string, mixed>|null
     */
    private function merge(string $type, array $existing, array $incoming): ?array
    {
        $count = (int) ($existing['count'] ?? 1) + 1;

        if ($type === 'task.status_changed') {
            $from = $existing['from'] ?? null;
            $to = $incoming['to'] ?? null;

            // Задачу вернули в исходный статус: «В работе → В работе» ничего не сообщает, пусть будет отдельная запись.
            if (($from['id'] ?? null) === ($to['id'] ?? null)) {
                return null;
            }

            return [...$incoming, 'from' => $from, 'to' => $to, 'count' => $count];
        }

        // Комментарии, сообщения и файлы: в списке виден последний, остальные — в самой задаче.
        if ($type !== NotificationEvent::TASK_UPDATED_TYPE) {
            return [...$incoming, 'count' => $count];
        }

        $changes = (array) ($existing['changes'] ?? []);
        foreach ((array) ($incoming['changes'] ?? []) as $field => $change) {
            $change = (array) $change;
            $previous = isset($changes[$field]) ? (array) $changes[$field] : null;
            $changes[$field] = $field === 'description' || $previous === null
                ? $change
                : ['old' => $previous['old'] ?? null, 'new' => $change['new'] ?? null];
        }

        // Поле вернули к исходному значению — изменения нет.
        $changes = array_filter(
            $changes,
            static fn (mixed $change, string $field): bool => $field === 'description'
                || ($change['old'] ?? null) !== ($change['new'] ?? null),
            ARRAY_FILTER_USE_BOTH,
        );

        if ($changes === []) {
            return null;
        }

        return [
            ...$incoming,
            'fields' => array_keys($changes),
            'changes' => (object) $changes,
            'count' => $count,
        ];
    }
}
