<?php

namespace Tests\Unit\Notifications;

use App\Enums\NotificationEvent;
use App\Jobs\Notifications\SendTaskNotificationsJob;
use App\Models\UserNotification;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class SendTaskNotificationsJobTest extends NotificationTestCase
{
    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();

        parent::tearDown();
    }

    public function test_each_user_gets_one_notification_per_action_by_part_priority(): void
    {
        DB::table('task_users')->insert(['task_id' => self::TASK, 'user_id' => 'member']);

        $this->handle([
            $this->part([NotificationEvent::TASK_ASSIGNED], only: ['member']),
            $this->part(
                [NotificationEvent::TASK_DESCRIPTION_CHANGED, NotificationEvent::TASK_DEADLINE_CHANGED],
                ['changes' => [
                    'description' => [],
                    'deadline' => ['old' => null, 'new' => '2026-10-10T00:00:00+00:00'],
                ]],
            ),
        ]);

        $this->assertSame('task.assigned', $this->notificationFor('member')->type);
        $this->assertSame(['assignee'], $this->notificationFor('member')->reasons);

        $assignee = $this->notificationFor('assignee');
        $this->assertSame(NotificationEvent::TASK_UPDATED_TYPE, $assignee->type);
        $this->assertSame(['description', 'deadline'], $assignee->data['fields']);

        // PM по умолчанию узнаёт только о дедлайне, автор — только об описании.
        $this->assertSame(['deadline'], $this->notificationFor('pm')->data['fields']);
        $this->assertSame(['description'], $this->notificationFor('creator')->data['fields']);
        $this->assertSame(1, UserNotification::query()->where('user_id', 'member')->count());
        $this->assertNull($this->notificationFor('actor'));
    }

    public function test_mentioned_user_gets_mention_instead_of_comment(): void
    {
        $data = ['comment_id' => 'comment-1', 'excerpt' => '@Участник посмотри', 'attachments_count' => 0];

        $this->handle([
            $this->part([NotificationEvent::TASK_MENTIONED], $data, only: ['member']),
            $this->part([NotificationEvent::TASK_COMMENT_ADDED], $data),
        ]);

        $member = $this->notificationFor('member');
        $this->assertSame('task.mentioned', $member->type);
        $this->assertSame(['mentioned'], $member->reasons);
        $this->assertSame(1, UserNotification::query()->where('user_id', 'member')->count());
        $this->assertSame('task.comment_added', $this->notificationFor('assignee')->type);
    }

    public function test_repeated_status_changes_collapse_into_one_unread_notification(): void
    {
        CarbonImmutable::setTestNow('2026-10-03 10:00:00');
        $this->handle([$this->statusPart('todo', 'Сделать', 'progress', 'В работе')]);
        CarbonImmutable::setTestNow('2026-10-03 10:05:00');
        $this->handle([$this->statusPart('progress', 'В работе', 'review', 'На проверке')]);

        $notifications = UserNotification::query()->where('user_id', 'assignee')->get();
        $this->assertCount(1, $notifications);
        $this->assertSame('Сделать', $notifications[0]->data['from']['name']);
        $this->assertSame('На проверке', $notifications[0]->data['to']['name']);
        $this->assertSame(2, $notifications[0]->data['count']);
        $this->assertSame('2026-10-03 10:05:00', $notifications[0]->created_at->format('Y-m-d H:i:s'));
    }

    public function test_status_returned_to_original_or_read_notification_is_not_collapsed(): void
    {
        CarbonImmutable::setTestNow('2026-10-03 10:00:00');
        $this->handle([$this->statusPart('todo', 'Сделать', 'progress', 'В работе')]);
        $this->handle([$this->statusPart('progress', 'В работе', 'todo', 'Сделать')]);

        $this->assertSame(2, UserNotification::query()->where('user_id', 'assignee')->count());

        UserNotification::query()->update(['read_at' => now()]);
        $this->handle([$this->statusPart('todo', 'Сделать', 'review', 'На проверке')]);

        $this->assertSame(3, UserNotification::query()->where('user_id', 'assignee')->count());
    }

    public function test_field_changes_merge_and_drop_reverted_values(): void
    {
        CarbonImmutable::setTestNow('2026-10-03 10:00:00');
        $this->handle([$this->part([NotificationEvent::TASK_PRIORITY_CHANGED], ['changes' => ['priority' => ['old' => 'LOW', 'new' => 'HIGH']]])]);
        $this->handle([$this->part([NotificationEvent::TASK_DEADLINE_CHANGED], ['changes' => ['deadline' => ['old' => null, 'new' => '2026-10-10T00:00:00+00:00']]])]);
        $this->handle([$this->part([NotificationEvent::TASK_PRIORITY_CHANGED], ['changes' => ['priority' => ['old' => 'HIGH', 'new' => 'LOW']]])]);

        $notification = $this->notificationFor('assignee');
        $this->assertSame(1, UserNotification::query()->where('user_id', 'assignee')->count());
        $this->assertSame(['deadline'], $notification->data['fields']);
        $this->assertSame(3, $notification->data['count']);
    }

    public function test_comments_of_one_author_collapse_while_unread(): void
    {
        CarbonImmutable::setTestNow('2026-10-03 10:00:00');
        $this->handle([$this->part([NotificationEvent::TASK_COMMENT_ADDED], ['excerpt' => 'Первый'])]);
        CarbonImmutable::setTestNow('2026-10-03 10:02:00');
        $this->handle([$this->part([NotificationEvent::TASK_COMMENT_ADDED], ['excerpt' => 'Второй'])]);

        $notifications = UserNotification::query()->where('user_id', 'assignee')->get();
        $this->assertCount(1, $notifications);
        $this->assertSame('Второй', $notifications[0]->data['excerpt']);
        $this->assertSame(2, $notifications[0]->data['count']);

        // Комментарий другого автора — отдельное уведомление.
        $this->handle([$this->part([NotificationEvent::TASK_COMMENT_ADDED], ['excerpt' => 'От PM'])], actorId: 'pm');
        $this->assertSame(2, UserNotification::query()->where('user_id', 'assignee')->count());

        // Прочитанное не дополняется: новый комментарий снова виден отдельно.
        UserNotification::query()->update(['read_at' => now()]);
        CarbonImmutable::setTestNow('2026-10-03 10:04:00');
        $this->handle([$this->part([NotificationEvent::TASK_COMMENT_ADDED], ['excerpt' => 'Третий'])]);
        $this->assertSame(3, UserNotification::query()->where('user_id', 'assignee')->count());
        $this->assertSame('Третий', $this->notificationFor('assignee')->data['excerpt']);
    }

    public function test_draft_task_notifies_only_about_client_events(): void
    {
        DB::table('tasks')->where('id', self::TASK)->update(['is_draft' => true]);

        $this->handle([$this->statusPart('todo', 'Сделать', 'progress', 'В работе')]);
        $this->assertSame(0, UserNotification::query()->count());

        $this->handle(
            [$this->part([NotificationEvent::TASK_CLIENT_MESSAGE_ADDED], ['excerpt' => 'Добрый день'])],
            actorId: null,
            actorKind: 'public_link',
        );

        $notification = $this->notificationFor('assignee');
        $this->assertSame('task.client_message_added', $notification->type);
        $this->assertSame('public_link', $notification->data['actor_kind']);
        $this->assertNull($notification->actor_id);
    }

    /**
     * @param  array<int, array<string, mixed>>  $parts
     */
    private function handle(array $parts, ?string $actorId = 'actor', ?string $actorKind = null): void
    {
        $job = new SendTaskNotificationsJob(self::TASK, $actorId, $parts, $actorKind, CarbonImmutable::now()->toISOString());
        app()->call([$job, 'handle']);
    }

    /**
     * @param  array<int, NotificationEvent>  $events
     * @param  array<string, mixed>  $data
     * @param  array<int, string>|null  $only
     * @return array<string, mixed>
     */
    private function part(array $events, array $data = [], ?array $only = null): array
    {
        return [
            'events' => array_map(static fn (NotificationEvent $event): string => $event->value, $events),
            'data' => $data,
            'only_user_ids' => $only,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function statusPart(string $fromId, string $fromName, string $toId, string $toName): array
    {
        return $this->part([NotificationEvent::TASK_STATUS_CHANGED], [
            'from' => ['id' => $fromId, 'name' => $fromName, 'color' => null],
            'to' => ['id' => $toId, 'name' => $toName, 'color' => null],
        ]);
    }

    private function notificationFor(string $userId): ?UserNotification
    {
        return UserNotification::query()->where('user_id', $userId)->latest('created_at')->first();
    }
}
