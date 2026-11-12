<?php

namespace Tests\Unit\Notifications;

use App\Jobs\Notifications\SendTaskNotificationsJob;
use App\Models\Task;
use App\Models\TaskComment;
use App\Services\Notifications\TaskNotificationService;
use App\Services\Notifications\TaskSubscriptionService;
use Illuminate\Contracts\Debug\ExceptionHandler;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Mockery;
use RuntimeException;

class TaskNotificationServiceTest extends NotificationTestCase
{
    public function test_task_update_sends_assignment_to_new_assignees_and_field_changes_to_others(): void
    {
        Queue::fake();
        $old = $this->task();
        $old->deadline = null;
        $old->priority = 'LOW';
        DB::table('task_users')->insert(['task_id' => self::TASK, 'user_id' => 'member']);
        $updated = $this->task();
        $updated->deadline = '2026-10-10 00:00:00';
        $updated->priority = 'LOW';
        $updated->estimation = 3600;

        app(TaskNotificationService::class)->taskUpdated($old, $updated, ['assignee'], $this->user('actor'));

        Queue::assertPushed(SendTaskNotificationsJob::class, function (SendTaskNotificationsJob $job): bool {
            return $job->actorId === 'actor'
                && $job->parts[0]['events'] === ['task.assigned']
                && $job->parts[0]['only_user_ids'] === ['member']
                // Оценка не уведомляет, приоритет не изменился.
                && $job->parts[1]['events'] === ['task.deadline_changed']
                && array_keys($job->parts[1]['data']['changes']) === ['deadline']
                && $job->parts[1]['data']['changes']['deadline']['old'] === null;
        });
    }

    public function test_draft_skips_events_that_do_not_notify_for_drafts(): void
    {
        Queue::fake();
        DB::table('tasks')->where('id', self::TASK)->update(['is_draft' => true]);

        app(TaskNotificationService::class)->statusChanged($this->task(), null, $this->user('actor'));

        Queue::assertNothingPushed();
    }

    public function test_comment_subscribes_author_unless_disabled_or_muted(): void
    {
        Queue::fake();
        $service = app(TaskNotificationService::class);
        DB::table('user_notification_settings')->insert(['user_id' => 'member', 'disabled_events' => '[]', 'auto_watch' => false]);
        $this->subscribe('pm', 'mute');

        foreach (['actor', 'member', 'pm'] as $author) {
            $service->commentAdded($this->task(), $this->comment($author, '<p>Готово, <b>проверьте</b></p>'), $this->user($author));
        }

        $this->assertSame('watch', $this->subscriptionMode('actor'));
        $this->assertNull($this->subscriptionMode('member'));
        $this->assertSame('mute', $this->subscriptionMode('pm'));
        Queue::assertPushed(
            SendTaskNotificationsJob::class,
            fn (SendTaskNotificationsJob $job): bool => $job->parts[0]['data']['excerpt'] === 'Готово, проверьте',
        );
    }

    public function test_unsubscribed_author_is_not_resubscribed_by_comment(): void
    {
        Queue::fake();
        $this->subscribe('actor', 'watch');
        $subscriptions = app(TaskSubscriptionService::class);

        $state = $subscriptions->update($this->user('actor'), $this->task(), null);
        app(TaskNotificationService::class)->commentAdded($this->task(), $this->comment('actor', 'ещё'), $this->user('actor'));

        $this->assertNull($state['mode']);
        $this->assertNotContains('actor', $state['watchers']->pluck('id')->all());
        $this->assertSame('none', $this->subscriptionMode('actor'));
    }

    public function test_errors_are_reported_instead_of_thrown(): void
    {
        $subscriptions = Mockery::mock(TaskSubscriptionService::class);
        $subscriptions->shouldReceive('autoWatch')->andThrow(new RuntimeException('База недоступна'));
        $this->app->instance(TaskSubscriptionService::class, $subscriptions);
        $reported = [];
        $this->app->make(ExceptionHandler::class)
            ->reportable(function (RuntimeException $e) use (&$reported): bool {
                $reported[] = $e->getMessage();

                return false;
            });

        app(TaskNotificationService::class)->commentAdded($this->task(), $this->comment('actor', 'текст'), $this->user('actor'));

        $this->assertSame(['База недоступна'], $reported);
    }

    private function comment(string $authorId, string $text): TaskComment
    {
        $comment = new TaskComment(['id' => 'comment-'.$authorId, 'task_id' => self::TASK, 'author_id' => $authorId, 'text' => $text]);
        $comment->setRelation('attachments', collect());

        return $comment;
    }

    private function subscriptionMode(string $userId): ?string
    {
        $mode = DB::table('task_subscriptions')->where('task_id', self::TASK)->where('user_id', $userId)->value('mode');

        return $mode !== null ? (string) $mode : null;
    }

    protected function task(): Task
    {
        return parent::task()->load('assignees');
    }
}
