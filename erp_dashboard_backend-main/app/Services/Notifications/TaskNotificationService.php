<?php

namespace App\Services\Notifications;

use App\Enums\NotificationEvent;
use App\Enums\UserRole;
use App\Support\CommentMentions;
use App\Jobs\Notifications\SendTaskNotificationsJob;
use App\Models\Task;
use App\Models\TaskAttachment;
use App\Models\TaskClientMessage;
use App\Models\TaskComment;
use App\Models\TaskStatusColumn;
use App\Models\User;
use App\Models\WorkSegment;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

/**
 * Точка входа для уведомлений о действиях с задачей и с учтённым по ней временем. Вызывается рядом
 * с записью истории (TaskActivityService) или правкой времени (TimeEntryService), после сохранения данных.
 *
 * Здесь только собираются данные события и ставится задание в очередь: получателей вычисляет задание,
 * поэтому запрос не замедляется. Методы никогда не бросают исключений — данные уже сохранены,
 * и ошибка уведомлений не должна превращаться в ответ 500.
 */
class TaskNotificationService
{
    public const ACTOR_PUBLIC_LINK = 'public_link';

    private const EXCERPT_LIMIT = 200;

    /**
     * Поля задачи, изменения которых попадают в уведомление «Задача изменена».
     */
    private const NOTIFIED_FIELDS = ['title', 'description', 'deadline', 'priority'];

    public function __construct(
        private readonly TaskSubscriptionService $subscriptions,
    ) {}

    /**
     * Задача опубликована (создана сразу с названием и исполнителем или вышла из черновика):
     * исполнители получают «Назначение», остальные по настройкам — «Новую задачу».
     */
    public function taskPublished(Task $task, ?User $actor = null): void
    {
        $this->safely(function () use ($task, $actor): void {
            $this->dispatch($task, $actor, [
                $this->part([NotificationEvent::TASK_ASSIGNED], onlyUserIds: $this->assigneeIds($task)),
                $this->part([NotificationEvent::TASK_CREATED]),
            ]);
        });
    }

    /**
     * Клиент создал задачу в кабинете. Без исполнителя она черновик, поэтому PM узнаёт о ней только так.
     */
    public function clientTaskCreated(Task $task, User $client): void
    {
        $this->safely(function () use ($task, $client): void {
            $this->dispatch($task, $client, [$this->part([NotificationEvent::TASK_CLIENT_CREATED])]);
        });
    }

    /**
     * Сохранение задачи. Новые исполнители получают «Назначение», остальные — одно уведомление
     * обо всех изменённых полях, которые им положены по настройкам.
     *
     * @param  array<int, string>  $oldAssigneeIds
     */
    public function taskUpdated(Task $oldTask, Task $updatedTask, array $oldAssigneeIds, ?User $actor = null): void
    {
        $this->safely(function () use ($oldTask, $updatedTask, $oldAssigneeIds, $actor): void {
            $parts = [];
            $newAssigneeIds = array_values(array_diff($this->assigneeIds($updatedTask), array_map('strval', $oldAssigneeIds)));

            if ($newAssigneeIds !== []) {
                $parts[] = $this->part([NotificationEvent::TASK_ASSIGNED], onlyUserIds: $newAssigneeIds);
            }

            $changes = $this->fieldChanges($oldTask, $updatedTask);
            if ($changes !== []) {
                $events = [];
                foreach (array_keys($changes) as $field) {
                    $event = NotificationEvent::forField($field);
                    $events[$event->value] = $event;
                }
                $parts[] = $this->part(array_values($events), ['changes' => $changes]);
            }

            $this->dispatch($updatedTask, $actor, $parts);
        });
    }

    public function statusChanged(Task $task, ?string $oldColumnId, ?User $actor = null): void
    {
        $this->safely(function () use ($task, $oldColumnId, $actor): void {
            $newColumnId = $task->task_status_column_id ? (string) $task->task_status_column_id : null;
            if ($newColumnId === $oldColumnId) {
                return;
            }

            $columns = TaskStatusColumn::query()
                ->whereIn('id', array_filter([$oldColumnId, $newColumnId]))
                ->get(['id', 'name', 'color'])
                ->keyBy(static fn (TaskStatusColumn $column): string => (string) $column->id);
            $status = static fn (?string $id): ?array => $id !== null && isset($columns[$id]) ? [
                'id' => $id,
                'name' => (string) $columns[$id]->name,
                'color' => $columns[$id]->color,
            ] : null;

            $this->dispatch($task, $actor, [$this->part([NotificationEvent::TASK_STATUS_CHANGED], [
                'from' => $status($oldColumnId),
                'to' => $status($newColumnId),
            ])]);
        });
    }

    public function commentAdded(Task $task, TaskComment $comment, ?User $actor = null): void
    {
        $this->safely(function () use ($task, $comment, $actor): void {
            $actor ??= $this->currentUser();
            if ($actor) {
                $this->subscriptions->autoWatch($actor, $task);
            }

            $data = [
                'comment_id' => (string) $comment->id,
                'excerpt' => $this->excerpt(CommentMentions::toPlainText($comment->text)),
                'attachments_count' => $comment->relationLoaded('attachments') ? $comment->attachments->count() : 0,
            ];
            $parts = [];
            $mentionedIds = CommentMentions::userIds($comment->text);

            // Упоминание первым: упомянутый получает его, а не обычный "Комментарий".
            if ($mentionedIds !== []) {
                $parts[] = $this->part([NotificationEvent::TASK_MENTIONED], $data, onlyUserIds: $mentionedIds);
            }
            $parts[] = $this->part([NotificationEvent::TASK_COMMENT_ADDED], $data);

            $this->dispatch($task, $actor, $parts);
        });
    }

    public function attachmentAdded(Task $task, TaskAttachment $attachment, ?User $actor = null): void
    {
        $this->safely(function () use ($task, $attachment, $actor): void {
            $this->dispatch($task, $actor, [$this->part([NotificationEvent::TASK_ATTACHMENT_ADDED], [
                'attachment_id' => (string) $attachment->id,
                'file_name' => Str::limit((string) $attachment->original_name, 120),
            ])]);
        });
    }

    /**
     * Сообщение в переписке с клиентом: от клиента (кабинет или публичная ссылка) или ответ сотрудника.
     */
    public function clientMessageAdded(Task $task, TaskClientMessage $message, ?User $actor = null): void
    {
        $this->safely(function () use ($task, $message, $actor): void {
            $event = $message->is_from_client
                ? NotificationEvent::TASK_CLIENT_MESSAGE_ADDED
                : NotificationEvent::TASK_CLIENT_REPLY_ADDED;

            if (! $message->is_from_client && $actor) {
                $this->subscriptions->autoWatch($actor, $task);
            }

            $this->dispatch(
                $task,
                $actor,
                [$this->part([$event], [
                    'message_id' => (string) $message->id,
                    'excerpt' => $this->excerpt($message->text),
                    'attachments_count' => $message->relationLoaded('attachments') ? $message->attachments->count() : 0,
                ])],
                actorKind: $actor === null && $message->is_from_client ? self::ACTOR_PUBLIC_LINK : null,
                resolveActor: false,
            );
        });
    }

    public function clientApproved(Task $task, ?User $actor, bool $viaPublicLink = false): void
    {
        $this->safely(function () use ($task, $actor, $viaPublicLink): void {
            $this->dispatch(
                $task,
                $actor,
                [$this->part([NotificationEvent::TASK_CLIENT_APPROVED])],
                actorKind: $viaPublicLink ? self::ACTOR_PUBLIC_LINK : null,
                resolveActor: ! $viaPublicLink,
            );
        });
    }

    /**
     * Время добавлено вручную, себе или другому сотруднику.
     */
    public function timeAdded(WorkSegment $entry, ?User $actor = null): void
    {
        $this->safely(function () use ($entry, $actor): void {
            $actor ??= $this->currentUser();
            $task = $this->shouldNotifyAboutTime($actor) ? Task::query()->find($entry->task_id) : null;
            if (! $task) {
                return;
            }

            $note = trim((string) $entry->note);
            $this->dispatch($task, $actor, [$this->part([NotificationEvent::TIME_ADDED], [
                ...$this->timeData($entry, (int) $entry->started_at, (int) $entry->ended_at),
                'note' => $note !== '' ? Str::limit($note, self::EXCERPT_LIMIT) : null,
            ])]);
        });
    }

    /**
     * Из сегмента удалён интервал [$from, $to] (весь сегмент или его часть).
     */
    public function timeDeleted(WorkSegment $segment, int $from, int $to, ?User $actor = null): void
    {
        $this->safely(function () use ($segment, $from, $to, $actor): void {
            $actor ??= $this->currentUser();
            $task = $this->shouldNotifyAboutTime($actor) ? Task::query()->find($segment->task_id) : null;
            if (! $task) {
                return;
            }

            $this->dispatch($task, $actor, [$this->part(
                [NotificationEvent::TIME_DELETED],
                $this->timeData($segment, $from, $to),
            )]);
        });
    }

    /**
     * Интервал [$from, $to] сегмента перенесён в другую задачу. Уведомление относится к задаче, куда перенесли.
     */
    public function timeMoved(WorkSegment $segment, int $from, int $to, Task $destination, ?User $actor = null): void
    {
        $this->safely(function () use ($segment, $from, $to, $destination, $actor): void {
            $actor ??= $this->currentUser();
            if (! $this->shouldNotifyAboutTime($actor)) {
                return;
            }

            $source = Task::query()->find($segment->task_id);
            $this->dispatch($destination, $actor, [$this->part([NotificationEvent::TIME_MOVED], [
                ...$this->timeData($segment, $from, $to),
                'from_task' => $source ? ['id' => (string) $source->id, 'title' => (string) $source->title] : null,
            ])]);
        });
    }

    /**
     * @param  array<int, array{events: array<int, string>, data: array<string, mixed>, only_user_ids: array<int, string>|null}>  $parts
     */
    private function dispatch(
        Task $task,
        ?User $actor,
        array $parts,
        ?string $actorKind = null,
        bool $resolveActor = true,
    ): void {
        if ($resolveActor) {
            $actor ??= $this->currentUser();
        }

        // Черновик: отправляем только события, которые уведомляют и по черновикам.
        $parts = array_values(array_filter(array_map(function (array $part) use ($task): array {
            if ($task->is_draft) {
                $part['events'] = array_values(array_filter(
                    $part['events'],
                    static fn (string $event): bool => NotificationEvent::from($event)->notifiesForDrafts(),
                ));
            }

            return $part;
        }, $parts), static fn (array $part): bool => $part['events'] !== [] && $part['only_user_ids'] !== []));

        if ($parts === []) {
            return;
        }

        SendTaskNotificationsJob::dispatch(
            (string) $task->id,
            $actor ? (string) $actor->id : null,
            $parts,
            $actorKind,
            now()->toISOString(),
        )->afterCommit();
    }

    /**
     * @param  array<int, NotificationEvent>  $events
     * @param  array<string, mixed>  $data
     * @param  array<int, string>|null  $onlyUserIds
     * @return array{events: array<int, string>, data: array<string, mixed>, only_user_ids: array<int, string>|null}
     */
    private function part(array $events, array $data = [], ?array $onlyUserIds = null): array
    {
        return [
            'events' => array_map(static fn (NotificationEvent $event): string => $event->value, $events),
            'data' => $data,
            'only_user_ids' => $onlyUserIds,
        ];
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    private function fieldChanges(Task $oldTask, Task $updatedTask): array
    {
        $changes = [];

        foreach (self::NOTIFIED_FIELDS as $field) {
            $old = $this->fieldValue($oldTask, $field);
            $new = $this->fieldValue($updatedTask, $field);

            if ($old === $new) {
                continue;
            }

            // Описание может быть большим HTML, в уведомлении достаточно факта изменения.
            $changes[$field] = $field === 'description' ? [] : ['old' => $old, 'new' => $new];
        }

        return $changes;
    }

    private function fieldValue(Task $task, string $field): ?string
    {
        $value = $task->{$field};

        return match (true) {
            $value === null => null,
            $value instanceof \DateTimeInterface => $value->format(\DateTimeInterface::ATOM),
            $value instanceof \BackedEnum => (string) $value->value,
            $field === 'description' => trim((string) $value) === '' ? null : (string) $value,
            default => (string) $value,
        };
    }

    /**
     * @return array<int, string>
     */
    private function assigneeIds(Task $task): array
    {
        return DB::table('task_users')
            ->where('task_id', $task->id)
            ->pluck('user_id')
            ->map(static fn ($id): string => (string) $id)
            ->all();
    }

    /**
     * Администраторам приходят изменения времени, сделанные всеми, кроме самих администраторов.
     */
    private function shouldNotifyAboutTime(?User $actor): bool
    {
        return $actor !== null
            && ! in_array($actor->role, [UserRole::ADMIN->value, UserRole::SUPERADMIN->value], true);
    }

    /**
     * @return array<string, mixed>
     */
    private function timeData(WorkSegment $segment, int $from, int $to): array
    {
        $owner = User::query()->withBlocked()->find($segment->user_id);

        return [
            // Чьё время: может отличаться от автора действия.
            'owner' => $owner ? [
                'id' => (string) $owner->id,
                'name' => trim($owner->name.' '.($owner->getRawOriginal('last_name') ?? '')),
            ] : null,
            'started_at' => $from,
            'ended_at' => $to,
            'duration_seconds' => max(0, $to - $from),
        ];
    }

    private function excerpt(?string $text): ?string
    {
        $plain = trim((string) preg_replace('/\s+/u', ' ', html_entity_decode(strip_tags((string) $text), ENT_QUOTES | ENT_HTML5)));

        return $plain === '' ? null : Str::limit($plain, self::EXCERPT_LIMIT);
    }

    private function currentUser(): ?User
    {
        $user = Auth::user();

        return $user instanceof User ? $user : null;
    }

    private function safely(callable $callback): void
    {
        try {
            $callback();
        } catch (Throwable $e) {
            report($e);
        }
    }
}
