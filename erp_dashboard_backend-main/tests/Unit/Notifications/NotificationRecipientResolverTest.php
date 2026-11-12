<?php

namespace Tests\Unit\Notifications;

use App\Enums\NotificationEvent;
use App\Services\Notifications\NotificationRecipient;
use App\Services\Notifications\NotificationRecipientResolver;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class NotificationRecipientResolverTest extends NotificationTestCase
{
    public function test_status_change_goes_to_assignee_creator_pm_and_watcher_by_default(): void
    {
        $recipients = $this->resolve([NotificationEvent::TASK_STATUS_CHANGED], actorId: 'actor');

        $this->assertSame(['assignee', 'creator', 'pm', 'watcher'], $this->ids($recipients));
        $this->assertSame(['assignee'], $recipients['assignee']->reasonValues());
        $this->assertSame(['project_manager'], $recipients['pm']->reasonValues());
    }

    public function test_actor_and_muted_users_are_excluded(): void
    {
        $this->subscribe('creator', 'mute');

        $recipients = $this->resolve([NotificationEvent::TASK_STATUS_CHANGED], actorId: 'assignee');

        $this->assertSame(['pm', 'watcher'], $this->ids($recipients));
    }

    public function test_company_rules_override_defaults(): void
    {
        $this->rule(NotificationEvent::TASK_STATUS_CHANGED, 'project_manager', false);
        $this->rule(NotificationEvent::TASK_STATUS_CHANGED, 'project_member', true);

        $recipients = $this->resolve([NotificationEvent::TASK_STATUS_CHANGED], actorId: 'actor');

        // Участниками проекта считаются все из project_members, включая PM: его причина — «участник».
        $this->assertSame(['assignee', 'creator', 'member', 'pm', 'watcher'], $this->ids($recipients));
        $this->assertSame(['project_member'], $recipients['pm']->reasonValues());
    }

    public function test_personal_setting_disables_event(): void
    {
        DB::table('user_notification_settings')->insert([
            'user_id' => 'assignee',
            'disabled_events' => json_encode([NotificationEvent::TASK_STATUS_CHANGED->value]),
            'auto_watch' => true,
        ]);

        $recipients = $this->resolve([NotificationEvent::TASK_STATUS_CHANGED], actorId: 'actor');

        $this->assertNotContains('assignee', $this->ids($recipients));
    }

    public function test_client_gets_reply_only_with_project_access_and_visible_task(): void
    {
        $this->client('client-limited', ['client_all_projects' => false]);
        $this->client('client-linked', ['client_all_projects' => false]);
        $this->client('client-foreign', ['client_id' => 'client-2']);
        DB::table('client_account_projects')->insert(['user_id' => 'client-linked', 'project_id' => self::PROJECT]);

        $recipients = $this->resolve([NotificationEvent::TASK_CLIENT_REPLY_ADDED], actorId: 'actor');

        $this->assertSame(['assignee', 'client-linked', 'client-user', 'watcher'], $this->ids($recipients));
        $this->assertTrue($recipients['client-user']->isClient);
        $this->assertSame(['client'], $recipients['client-user']->reasonValues());

        DB::table('tasks')->where('id', self::TASK)->update(['is_client_visible' => false]);

        $this->assertSame(['assignee', 'watcher'], $this->ids($this->resolve([NotificationEvent::TASK_CLIENT_REPLY_ADDED], actorId: 'actor')));
    }

    public function test_client_does_not_see_untitled_draft(): void
    {
        DB::table('tasks')->where('id', self::TASK)->update(['is_draft' => true, 'title' => ' ']);

        $recipients = $this->resolve([NotificationEvent::TASK_CLIENT_REPLY_ADDED], actorId: 'actor');

        $this->assertNotContains('client-user', $this->ids($recipients));
    }

    public function test_internal_comment_never_reaches_client(): void
    {
        // Ячейка «Клиент» у комментария заблокирована: правило в базе ничего не меняет.
        $this->rule(NotificationEvent::TASK_COMMENT_ADDED, 'client', true);

        $recipients = $this->resolve([NotificationEvent::TASK_COMMENT_ADDED], actorId: 'actor');

        $this->assertSame(['assignee', 'creator', 'watcher'], $this->ids($recipients));
    }

    public function test_client_who_created_the_task_is_not_notified_as_staff_author(): void
    {
        DB::table('tasks')->where('id', self::TASK)->update(['created_by_id' => 'client-user']);

        $recipients = $this->resolve([NotificationEvent::TASK_COMMENT_ADDED], actorId: 'actor');

        $this->assertNotContains('client-user', $this->ids($recipients));
    }

    public function test_users_without_task_access_or_blocked_are_skipped(): void
    {
        $this->access->hiddenTaskFor = ['creator'];
        DB::table('users')->where('id', 'pm')->update(['status' => 'BLOCKED']);

        $recipients = $this->resolve([NotificationEvent::TASK_STATUS_CHANGED], actorId: 'actor');

        $this->assertSame(['assignee', 'watcher'], $this->ids($recipients));
    }

    public function test_reasons_are_unique_and_most_specific_first(): void
    {
        $this->subscribe('assignee', 'watch');

        $recipients = $this->resolve(
            [NotificationEvent::TASK_DESCRIPTION_CHANGED, NotificationEvent::TASK_DEADLINE_CHANGED],
            actorId: 'actor',
        );

        $this->assertSame(['assignee', 'watcher'], $recipients['assignee']->reasonValues());
        $this->assertCount(2, $recipients['assignee']->events);
        // Автор по умолчанию получает описание, но не дедлайн; PM — наоборот.
        $this->assertSame([NotificationEvent::TASK_DESCRIPTION_CHANGED], $recipients['creator']->events);
        $this->assertSame([NotificationEvent::TASK_DEADLINE_CHANGED], $recipients['pm']->events);
    }

    public function test_only_and_excluded_users_restrict_candidates(): void
    {
        DB::table('task_users')->insert(['task_id' => self::TASK, 'user_id' => 'member']);

        $assigned = $this->resolve([NotificationEvent::TASK_ASSIGNED], actorId: 'actor', only: ['member']);
        $this->assertSame(['member'], $this->ids($assigned));

        $rest = $this->resolve([NotificationEvent::TASK_STATUS_CHANGED], actorId: 'actor', exclude: ['assignee', 'pm']);
        $this->assertSame(['creator', 'member', 'watcher'], $this->ids($rest));
    }

    /**
     * @param  array<int, NotificationEvent>  $events
     * @param  array<int, string>|null  $only
     * @param  array<int, string>  $exclude
     * @return Collection<string, NotificationRecipient>
     */
    private function resolve(array $events, ?string $actorId, ?array $only = null, array $exclude = []): Collection
    {
        return app(NotificationRecipientResolver::class)->resolve($this->task(), $events, $actorId, $only, $exclude);
    }

    /**
     * @param  Collection<string, NotificationRecipient>  $recipients
     * @return array<int, string>
     */
    private function ids(Collection $recipients): array
    {
        $ids = $recipients->keys()->map(static fn ($id): string => (string) $id)->all();
        sort($ids);

        return $ids;
    }
}
