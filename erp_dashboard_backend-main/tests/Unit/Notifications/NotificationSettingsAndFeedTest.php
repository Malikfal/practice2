<?php

namespace Tests\Unit\Notifications;

use App\Enums\NotificationEvent;
use App\Models\UserNotification;
use App\Services\Notifications\NotificationPublisher;
use App\Services\Notifications\NotificationSettingsService;
use App\Services\Notifications\UserNotificationService;
use Illuminate\Support\Facades\DB;
use Mockery;

class NotificationSettingsAndFeedTest extends NotificationTestCase
{
    public function test_company_matrix_stores_only_differences_from_defaults(): void
    {
        $service = app(NotificationSettingsService::class);

        $matrix = $service->updateCompanyMatrix(self::COMPANY, [
            'task.status_changed' => ['assignee' => true, 'project_manager' => false, 'client' => true],
            // Недопустимая ячейка и неизвестное событие игнорируются.
            'task.comment_added' => ['client' => true],
            'task.unknown' => ['assignee' => false],
        ]);

        $rules = DB::table('notification_rules')->orderBy('relation')->get(['event', 'relation', 'enabled']);
        $this->assertCount(2, $rules);
        $this->assertSame(['client', 'project_manager'], $rules->pluck('relation')->all());

        $status = collect($matrix['events'])->firstWhere('key', 'task.status_changed');
        $this->assertFalse($status['relations']['project_manager']['enabled']);
        $this->assertTrue($status['relations']['project_manager']['default']);
        $this->assertTrue($status['relations']['client']['enabled']);
        $comment = collect($matrix['events'])->firstWhere('key', 'task.comment_added');
        $this->assertFalse($comment['relations']['client']['allowed']);

        // Возврат к значению по умолчанию удаляет строку.
        $service->updateCompanyMatrix(self::COMPANY, ['task.status_changed' => ['project_manager' => true]]);
        $this->assertSame(['client'], DB::table('notification_rules')->pluck('relation')->all());
    }

    public function test_client_settings_contain_only_events_that_can_reach_clients(): void
    {
        $service = app(NotificationSettingsService::class);
        $this->rule(NotificationEvent::TASK_STATUS_CHANGED, 'client', true);

        $settings = $service->updateUserSettings($this->user('client-user'), [
            'events' => ['task.client_reply_added' => false, 'task.comment_added' => false],
            'auto_watch' => false,
        ]);

        $keys = array_column($settings['events'], 'key');
        $this->assertNotContains('task.comment_added', $keys);
        $this->assertNull($settings['auto_watch']);

        $byKey = collect($settings['events'])->keyBy('key');
        $this->assertFalse($byKey['task.client_reply_added']['enabled']);
        $this->assertSame('Ответы по задачам', $byKey['task.client_reply_added']['label']);
        $this->assertNotNull($byKey['task.client_reply_added']['hint']);
        // Смену статуса компания включила клиентам, изменение приоритета — нет: клиенту его не показываем.
        $this->assertTrue($byKey['task.status_changed']['available']);
        $this->assertArrayNotHasKey('task.priority_changed', $byKey->all());
        $this->assertSame('Переписка', collect($settings['groups'])->firstWhere('key', 'client')['label']);
        $this->assertSame(['task.client_reply_added'], json_decode((string) DB::table('user_notification_settings')->value('disabled_events'), true));
    }

    public function test_staff_settings_hide_events_without_access_and_keep_company_disabled_ones(): void
    {
        $service = app(NotificationSettingsService::class);
        $this->access->hiddenEventsFor['member'] = [
            NotificationEvent::TASK_CLIENT_MESSAGE_ADDED,
            NotificationEvent::TASK_CLIENT_REPLY_ADDED,
        ];
        foreach (['assignee', 'creator', 'project_manager', 'project_member', 'watcher'] as $relation) {
            $this->rule(NotificationEvent::TASK_ATTACHMENT_ADDED, $relation, false);
        }

        $byKey = collect($service->userSettings($this->user('member'))['events'])->keyBy('key');

        // Переписку без права видеть не получить, а согласование клиентом прав не требует.
        $this->assertArrayNotHasKey('task.client_message_added', $byKey->all());
        $this->assertArrayNotHasKey('task.client_reply_added', $byKey->all());
        $this->assertTrue($byKey['task.client_approved']['available']);
        // Выключенное компанией сотрудник видит серым.
        $this->assertFalse($byKey['task.attachment_added']['available']);
    }

    public function test_opening_task_marks_only_its_notifications_read(): void
    {
        DB::table('tasks')->insert(['id' => 'task-2', 'project_id' => self::PROJECT, 'title' => 'Другая']);
        foreach ([self::TASK, self::TASK, 'task-2'] as $index => $taskId) {
            UserNotification::query()->create([
                'company_id' => self::COMPANY,
                'user_id' => 'assignee',
                'type' => 'task.comment_added',
                'task_id' => $taskId,
                'project_id' => self::PROJECT,
                'data' => ['excerpt' => 'Комментарий '.$index],
                'reasons' => ['assignee'],
            ]);
        }
        $feed = app(UserNotificationService::class);

        $this->assertSame(1, $feed->markTaskRead($this->user('assignee'), $this->task()));
        $this->assertSame(1, $feed->unreadCount($this->user('assignee')));

        $page = $feed->list($this->user('assignee'), ['unread' => true]);
        $this->assertSame(['task-2'], collect($page->items())->pluck('task_id')->all());
        $this->assertSame(0, $feed->markAllRead($this->user('assignee')));
    }

    public function test_reading_tells_other_tabs_which_notifications_were_read(): void
    {
        $publisher = Mockery::mock(NotificationPublisher::class);
        $this->app->instance(NotificationPublisher::class, $publisher);
        $first = $this->notification(self::TASK);
        $second = $this->notification(self::TASK);
        $other = $this->notification(self::TASK);
        $other->update(['read_at' => now()]);
        $last = $this->notification('task-2');

        $publisher->shouldReceive('unreadCount')
            ->once()
            ->withArgs(fn (string $userId, int $count, array $ids): bool => $userId === 'assignee'
                && $count === 1
                && collect($ids)->sort()->values()->all() === collect([$first->id, $second->id])->sort()->values()->all());
        $publisher->shouldReceive('unreadCount')
            ->once()
            ->with('assignee', 0, [$last->id]);

        $feed = app(UserNotificationService::class);
        $this->assertSame(1, $feed->markTaskRead($this->user('assignee'), $this->task()));
        // Читать нечего — никому ничего не отправляется.
        $this->assertSame(1, $feed->markTaskRead($this->user('assignee'), $this->task()));
        $this->assertSame(0, $feed->markRead($this->user('assignee'), $last->id));
    }

    private function notification(string $taskId): UserNotification
    {
        DB::table('tasks')->insertOrIgnore(['id' => $taskId, 'project_id' => self::PROJECT, 'title' => 'Задача '.$taskId]);

        return UserNotification::query()->create([
            'company_id' => self::COMPANY,
            'user_id' => 'assignee',
            'type' => 'task.comment_added',
            'task_id' => $taskId,
            'project_id' => self::PROJECT,
            'data' => ['excerpt' => 'Комментарий'],
            'reasons' => ['assignee'],
        ]);
    }
}
