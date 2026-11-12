<?php

namespace App\Services\Notifications;

use App\Enums\NotificationEvent;
use App\Enums\NotificationRelation;
use App\Enums\TaskSubscriptionMode;
use App\Enums\UserRole;
use App\Models\Project;
use App\Models\Task;
use App\Models\TaskSubscription;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Собирает получателей уведомления о действии с задачей.
 *
 * кандидаты = все, у кого есть связь с задачей, включённая в настройках компании для события (наблюдатели — тоже связь);
 * минус автор действия, заглушившие задачу, выключившие событие у себя и потерявшие доступ к задаче.
 * Клиент получает уведомления только по связи «Клиент», внутренние события ему недоступны по каталогу.
 * События учёта времени получают администраторы компании (связь «Администраторы»).
 */
class NotificationRecipientResolver
{
    public function __construct(
        private readonly NotificationSettingsService $settings,
        private readonly NotificationAccess $access,
    ) {}

    /**
     * @param  array<int, NotificationEvent>  $events  События одного действия. Получатель попадает в результат,
     *                                                 если ему положено хотя бы одно из них.
     * @param  array<int, string>|null  $onlyUserIds  Ограничить кандидатов, например только новыми исполнителями.
     * @param  array<int, string>  $excludeUserIds  Уже уведомлены об этом действии.
     * @return Collection<string, NotificationRecipient>
     */
    public function resolve(
        Task $task,
        array $events,
        ?string $actorId,
        ?array $onlyUserIds = null,
        array $excludeUserIds = [],
    ): Collection {
        $task->loadMissing('project');
        $project = $task->project;

        if (! $project instanceof Project || $events === [] || $onlyUserIds === []) {
            return collect();
        }

        $companyId = (string) $project->company_id;
        $overrides = $this->settings->companyOverrides($companyId, $events);
        $neededRelations = $this->neededRelations($events, $overrides);

        if ($neededRelations === []) {
            return collect();
        }

        $members = DB::table('project_members')
            ->where('project_id', $project->id)
            ->get(['user_id', 'is_pm']);
        $memberIds = $members->pluck('user_id')->map(static fn ($id): string => (string) $id)->all();
        $relationsByUser = $this->candidateRelations($task, $project, $members, $neededRelations);

        // Кого упомянули, известно только из комментария: они приходят списком onlyUserIds.
        if (
            $onlyUserIds !== null
            && in_array(NotificationEvent::TASK_MENTIONED, $events, true)
            && in_array(NotificationRelation::MENTIONED, $neededRelations, true)
        ) {
            foreach ($onlyUserIds as $userId) {
                $relationsByUser[(string) $userId][] = NotificationRelation::MENTIONED;
            }
        }

        $excluded = array_flip(array_map('strval', $excludeUserIds));
        if ($actorId !== null) {
            $excluded[$actorId] = true;
        }
        $only = $onlyUserIds !== null ? array_flip(array_map('strval', $onlyUserIds)) : null;

        $candidateIds = array_values(array_filter(
            array_keys($relationsByUser),
            static fn (string $userId): bool => ! isset($excluded[$userId]) && ($only === null || isset($only[$userId])),
        ));

        if ($candidateIds === []) {
            return collect();
        }

        $mutedIds = array_flip(TaskSubscription::query()
            ->where('task_id', $task->id)
            ->where('mode', TaskSubscriptionMode::MUTE->value)
            ->whereIn('user_id', $candidateIds)
            ->pluck('user_id')
            ->map(static fn ($id): string => (string) $id)
            ->all());
        $candidateIds = array_values(array_filter($candidateIds, static fn (string $id): bool => ! isset($mutedIds[$id])));

        // Заблокированных пользователей отсекает глобальный scope модели.
        $users = User::query()
            ->with('roleModel')
            ->whereIn('id', $candidateIds)
            ->where('company_id', $companyId)
            ->get()
            ->keyBy(static fn (User $user): string => (string) $user->id);
        $disabledEvents = $this->settings->disabledEventsFor($users->keys()->all());

        $recipients = collect();

        foreach ($users as $userId => $user) {
            $isClient = $user->role === UserRole::CLIENT->value;
            $relations = array_values(array_filter(
                $relationsByUser[$userId] ?? [],
                // Клиент связан с задачей только как клиент, даже если сам её создал.
                static fn (NotificationRelation $relation): bool => $relation->isClient() === $isClient,
            ));

            if ($relations === []) {
                continue;
            }

            $matchedEvents = [];
            $reasons = [];

            foreach ($events as $event) {
                if (in_array($event->value, $disabledEvents[$userId] ?? [], true)) {
                    continue;
                }

                $eventRelations = array_values(array_filter(
                    $relations,
                    fn (NotificationRelation $relation): bool => $this->settings->isRelationEnabled($overrides, $event, $relation),
                ));

                if ($eventRelations === [] || ! $this->access->canSeeEvent($user, $isClient, $event)) {
                    continue;
                }

                $matchedEvents[] = $event;
                foreach ($eventRelations as $relation) {
                    $reasons[$relation->value] = $relation;
                }
            }

            if ($matchedEvents === []) {
                continue;
            }

            // Для учёта времени доступ задаёт право видеть всё время (проверено выше), а не доступ к задаче.
            $needsTaskAccess = array_filter(
                $matchedEvents,
                static fn (NotificationEvent $event): bool => ! $event->isTimeEvent(),
            ) !== [];
            if ($needsTaskAccess && ! $this->access->canSeeTask($user, $isClient, $task, $memberIds)) {
                continue;
            }

            $reasons = array_values($reasons);
            usort($reasons, static fn (NotificationRelation $a, NotificationRelation $b): int => $a->priority() <=> $b->priority());

            $recipients->put($userId, new NotificationRecipient($user, $isClient, $matchedEvents, $reasons));
        }

        return $recipients;
    }

    /**
     * Связи, которые включены хотя бы для одного события: остальные не нужно даже загружать.
     *
     * @param  array<int, NotificationEvent>  $events
     * @param  array<string, array<string, bool>>  $overrides
     * @return array<int, NotificationRelation>
     */
    private function neededRelations(array $events, array $overrides): array
    {
        return array_values(array_filter(
            NotificationRelation::cases(),
            function (NotificationRelation $relation) use ($events, $overrides): bool {
                foreach ($events as $event) {
                    if ($this->settings->isRelationEnabled($overrides, $event, $relation)) {
                        return true;
                    }
                }

                return false;
            },
        ));
    }

    /**
     * @param  Collection<int, object{user_id: string, is_pm: bool}>  $members
     * @param  array<int, NotificationRelation>  $neededRelations
     * @return array<string, array<int, NotificationRelation>>
     */
    private function candidateRelations(Task $task, Project $project, Collection $members, array $neededRelations): array
    {
        $relationsByUser = [];
        $add = static function (iterable $userIds, NotificationRelation $relation) use (&$relationsByUser): void {
            foreach ($userIds as $userId) {
                if ($userId !== null && $userId !== '') {
                    $relationsByUser[(string) $userId][] = $relation;
                }
            }
        };
        $needs = static fn (NotificationRelation $relation): bool => in_array($relation, $neededRelations, true);

        if ($needs(NotificationRelation::ASSIGNEE)) {
            $add(DB::table('task_users')->where('task_id', $task->id)->pluck('user_id'), NotificationRelation::ASSIGNEE);
        }
        if ($needs(NotificationRelation::CREATOR)) {
            $add([$task->created_by_id], NotificationRelation::CREATOR);
        }
        if ($needs(NotificationRelation::PROJECT_MANAGER)) {
            $add($members->filter(static fn (object $member): bool => (bool) $member->is_pm)->pluck('user_id'), NotificationRelation::PROJECT_MANAGER);
        }
        if ($needs(NotificationRelation::PROJECT_MEMBER)) {
            $add($members->pluck('user_id'), NotificationRelation::PROJECT_MEMBER);
        }
        if ($needs(NotificationRelation::WATCHER)) {
            $add(
                TaskSubscription::query()
                    ->where('task_id', $task->id)
                    ->where('mode', TaskSubscriptionMode::WATCH->value)
                    ->pluck('user_id'),
                NotificationRelation::WATCHER,
            );
        }
        if ($needs(NotificationRelation::CLIENT) && $this->isVisibleToClients($task, $project)) {
            $add($this->clientAccountIds($project), NotificationRelation::CLIENT);
        }
        if ($needs(NotificationRelation::ADMIN)) {
            $add($this->companyAdminIds((string) $project->company_id), NotificationRelation::ADMIN);
        }

        return $relationsByUser;
    }

    /**
     * Сотрудники компании с ролью «Админ».
     *
     * @return Collection<int, string>
     */
    private function companyAdminIds(string $companyId): Collection
    {
        return User::query()
            ->where('company_id', $companyId)
            ->whereHas('roleModel', fn (Builder $query) => $query->where('name', UserRole::ADMIN->value))
            ->pluck('id')
            ->map(static fn ($id): string => (string) $id);
    }

    /**
     * То же правило, что у доски клиента (ClientPortalService::visibleTasksQuery).
     */
    private function isVisibleToClients(Task $task, Project $project): bool
    {
        return $project->client_id !== null
            && (bool) $task->is_client_visible
            && (! $task->is_draft || trim((string) $task->title) !== '');
    }

    /**
     * Клиентские аккаунты клиента проекта, которым открыт этот проект.
     *
     * @return Collection<int, string>
     */
    private function clientAccountIds(Project $project): Collection
    {
        return User::query()
            ->where('company_id', $project->company_id)
            ->where('client_id', $project->client_id)
            ->where(fn (Builder $query) => $query
                ->where('client_all_projects', true)
                ->orWhereExists(fn ($exists) => $exists
                    ->selectRaw('1')
                    ->from('client_account_projects')
                    ->whereColumn('client_account_projects.user_id', 'users.id')
                    ->where('client_account_projects.project_id', $project->id)))
            ->pluck('id')
            ->map(static fn ($id): string => (string) $id);
    }
}
