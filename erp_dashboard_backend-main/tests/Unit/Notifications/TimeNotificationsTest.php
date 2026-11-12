<?php

namespace Tests\Unit\Notifications;

use App\Enums\NotificationEvent;
use App\Jobs\Notifications\SendTaskNotificationsJob;
use App\Models\Task;
use App\Models\UserNotification;
use App\Models\WorkSegment;
use App\Services\Notifications\NotificationRecipientResolver;
use App\Services\Notifications\NotificationSettingsService;
use App\Services\Notifications\TaskNotificationService;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

class TimeNotificationsTest extends NotificationTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->admin('admin-1');
        $this->admin('admin-2');
        $this->admin('admin-blocked', ['status' => 'BLOCKED']);
        DB::table('companies')->insert(['id' => 'company-b']);
        $this->admin('admin-foreign', ['company_id' => 'company-b']);
    }

    public function test_time_events_go_to_company_admins_only(): void
    {
        $recipients = app(NotificationRecipientResolver::class)
            ->resolve($this->task(), [NotificationEvent::TIME_DELETED], 'actor');

        $ids = $recipients->keys()->map(static fn ($id): string => (string) $id)->sort()->values()->all();
        $this->assertSame(['admin-1', 'admin-2'], $ids);
        $this->assertSame(['admin'], $recipients['admin-1']->reasonValues());
    }

    public function test_company_can_turn_off_time_notifications(): void
    {
        $this->rule(NotificationEvent::TIME_ADDED, 'admin', false);

        $recipients = app(NotificationRecipientResolver::class)
            ->resolve($this->task(), [NotificationEvent::TIME_ADDED], 'actor');

        $this->assertTrue($recipients->isEmpty());
    }

    public function test_admin_actions_with_time_are_not_notified(): void
    {
        Queue::fake();

        app(TaskNotificationService::class)->timeDeleted($this->segment(), 1_000, 2_000, $this->user('admin-1'));
        app(TaskNotificationService::class)->timeAdded($this->segment(), $this->user('admin-2'));

        Queue::assertNothingPushed();
    }

    public function test_worker_time_changes_notify_admins_even_on_drafts(): void
    {
        Queue::fake();
        DB::table('tasks')->where('id', self::TASK)->update(['is_draft' => true]);
        DB::table('tasks')->insert(['id' => 'task-2', 'project_id' => self::PROJECT, 'title' => 'Вёрстка']);
        $service = app(TaskNotificationService::class);

        $service->timeDeleted($this->segment(), 1_800, 3_600, $this->user('member'));
        $service->timeMoved($this->segment(), 0, 900, Task::query()->findOrFail('task-2'), $this->user('member'));

        Queue::assertPushed(SendTaskNotificationsJob::class, function (SendTaskNotificationsJob $job): bool {
            $data = $job->parts[0]['data'];

            return $job->parts[0]['events'] === ['time.deleted']
                && $job->taskId === self::TASK
                && $data['owner'] === ['id' => 'assignee', 'name' => 'Assignee']
                && $data['started_at'] === 1_800
                && $data['duration_seconds'] === 1_800;
        });
        Queue::assertPushed(SendTaskNotificationsJob::class, function (SendTaskNotificationsJob $job): bool {
            return $job->parts[0]['events'] === ['time.moved']
                && $job->taskId === 'task-2'
                && $job->parts[0]['data']['from_task'] === ['id' => self::TASK, 'title' => 'Главная страница'];
        });
    }

    public function test_job_stores_time_notification_for_admins(): void
    {
        $job = new SendTaskNotificationsJob(self::TASK, 'member', [[
            'events' => [NotificationEvent::TIME_ADDED->value],
            'data' => ['owner' => ['id' => 'assignee', 'name' => 'Assignee'], 'duration_seconds' => 3_600],
            'only_user_ids' => null,
        ]], null, CarbonImmutable::now()->toISOString());

        app()->call([$job, 'handle']);

        $notifications = UserNotification::query()->orderBy('user_id')->get();
        $this->assertSame(['admin-1', 'admin-2'], $notifications->pluck('user_id')->all());
        $this->assertSame('time.added', $notifications[0]->type);
        $this->assertSame(3_600, $notifications[0]->data['duration_seconds']);
    }

    public function test_only_admins_see_time_events_in_personal_settings(): void
    {
        $settings = app(NotificationSettingsService::class);

        $workerKeys = array_column($settings->userSettings($this->user('member'))['events'], 'key');
        $adminSettings = $settings->userSettings($this->user('admin-1'));
        $adminEvents = collect($adminSettings['events'])->keyBy('key');

        $this->assertNotContains('time.added', $workerKeys);
        $this->assertContains('task.status_changed', $workerKeys);
        $this->assertTrue($adminEvents['time.deleted']['available']);
        $this->assertSame('time', collect($adminSettings['groups'])->firstWhere('key', 'time')['scope']);

        $matrix = $settings->companyMatrix(self::COMPANY);
        $time = collect($matrix['events'])->firstWhere('key', 'time.moved');
        $this->assertTrue($time['relations']['admin']['enabled']);
        $this->assertFalse($time['relations']['assignee']['allowed']);
    }

    private function segment(): WorkSegment
    {
        return new WorkSegment([
            'id' => 'segment-1',
            'task_id' => self::TASK,
            'user_id' => 'assignee',
            'started_at' => 0,
            'ended_at' => 3_600,
        ]);
    }
}
