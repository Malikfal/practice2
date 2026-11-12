<?php

namespace App\Services\Notifications;

use App\Enums\NotificationEvent;
use App\Enums\NotificationRelation;
use App\Enums\UserRole;
use App\Models\NotificationRule;
use App\Models\User;
use App\Models\UserNotificationSetting;
use Illuminate\Support\Facades\DB;

/**
 * Настройки уведомлений: матрица компании «событие × связь с задачей» и личные настройки пользователя.
 * Пока компания или пользователь ничего не меняли, действуют значения по умолчанию из NotificationEvent.
 */
class NotificationSettingsService
{
    public function __construct(
        private readonly NotificationAccess $access,
    ) {}

    /**
     * Отличия компании от значений по умолчанию.
     *
     * @param  array<int, NotificationEvent>|null  $events
     * @return array<string, array<string, bool>> событие → связь → включено
     */
    public function companyOverrides(string $companyId, ?array $events = null): array
    {
        $overrides = [];

        NotificationRule::query()
            ->where('company_id', $companyId)
            ->when($events !== null, fn ($query) => $query->whereIn(
                'event',
                array_map(static fn (NotificationEvent $event): string => $event->value, $events),
            ))
            ->get(['event', 'relation', 'enabled'])
            ->each(function (NotificationRule $rule) use (&$overrides): void {
                $overrides[$rule->event][$rule->relation] = (bool) $rule->enabled;
            });

        return $overrides;
    }

    /**
     * @param  array<string, array<string, bool>>  $overrides
     */
    public function isRelationEnabled(array $overrides, NotificationEvent $event, NotificationRelation $relation): bool
    {
        if (! $event->allowsRelation($relation)) {
            return false;
        }

        return $overrides[$event->value][$relation->value] ?? $event->isEnabledByDefault($relation);
    }

    /**
     * Матрица для вкладки «Уведомления» в настройках рабочего пространства.
     *
     * @return array<string, mixed>
     */
    public function companyMatrix(string $companyId): array
    {
        $overrides = $this->companyOverrides($companyId);

        return [
            'relations' => array_map(static fn (NotificationRelation $relation): array => [
                'key' => $relation->value,
                'label' => $relation->label(),
            ], NotificationRelation::cases()),
            'groups' => $this->groups(NotificationEvent::cases()),
            'events' => array_map(fn (NotificationEvent $event): array => [
                'key' => $event->value,
                'label' => $event->label(),
                'hint' => $event->hint(),
                'group' => $event->group(),
                'relations' => collect(NotificationRelation::cases())
                    ->mapWithKeys(fn (NotificationRelation $relation): array => [$relation->value => [
                        'allowed' => $event->allowsRelation($relation),
                        'enabled' => $this->isRelationEnabled($overrides, $event, $relation),
                        'default' => $event->allowsRelation($relation) && $event->isEnabledByDefault($relation),
                    ]])
                    ->all(),
            ], NotificationEvent::cases()),
        ];
    }

    /**
     * Сохраняет матрицу компании. Хранятся только ячейки, отличные от значений по умолчанию,
     * поэтому новые события и изменённые значения по умолчанию подхватываются без миграций.
     *
     * @param  array<string, array<string, bool>>  $rules  событие → связь → включено
     * @return array<string, mixed>
     */
    public function updateCompanyMatrix(string $companyId, array $rules): array
    {
        DB::transaction(function () use ($companyId, $rules): void {
            foreach ($rules as $eventKey => $relations) {
                $event = NotificationEvent::tryFrom((string) $eventKey);
                if (! $event || ! is_array($relations)) {
                    continue;
                }

                foreach ($relations as $relationKey => $enabled) {
                    $relation = NotificationRelation::tryFrom((string) $relationKey);
                    if (! $relation || ! $event->allowsRelation($relation)) {
                        continue;
                    }

                    $query = NotificationRule::query()
                        ->where('company_id', $companyId)
                        ->where('event', $event->value)
                        ->where('relation', $relation->value);

                    if ((bool) $enabled === $event->isEnabledByDefault($relation)) {
                        $query->delete();

                        continue;
                    }

                    NotificationRule::query()->updateOrCreate(
                        ['company_id' => $companyId, 'event' => $event->value, 'relation' => $relation->value],
                        ['enabled' => (bool) $enabled],
                    );
                }
            }
        });

        return $this->companyMatrix($companyId);
    }

    /**
     * Выключенные пользователями события.
     *
     * @param  array<int, string>  $userIds
     * @return array<string, array<int, string>>
     */
    public function disabledEventsFor(array $userIds): array
    {
        if ($userIds === []) {
            return [];
        }

        return UserNotificationSetting::query()
            ->whereIn('user_id', $userIds)
            ->get(['user_id', 'disabled_events'])
            ->mapWithKeys(static fn (UserNotificationSetting $setting): array => [
                (string) $setting->user_id => array_values(array_map('strval', $setting->disabled_events ?? [])),
            ])
            ->all();
    }

    public function autoWatchEnabled(User $user): bool
    {
        $setting = UserNotificationSetting::query()->find($user->id);

        return $setting === null || (bool) $setting->auto_watch;
    }

    /**
     * Личные настройки для «Мои уведомления»: только события, которые пользователю вообще могут прийти.
     *
     * @return array<string, mixed>
     */
    public function userSettings(User $user): array
    {
        $isClient = $this->isClient($user);
        $events = $this->eventsFor($user);
        $relations = $this->relationsFor($user);
        $overrides = $this->companyOverrides((string) $user->company_id, $events);
        $setting = UserNotificationSetting::query()->find($user->id);
        $disabled = array_map('strval', $setting?->disabled_events ?? []);

        // Выключенное компанией сотрудник видит серым (может попросить администратора), клиенту оно ни к чему.
        if ($isClient) {
            $events = array_values(array_filter(
                $events,
                fn (NotificationEvent $event): bool => $this->isAvailableFor($overrides, $event, $relations),
            ));
        }

        return [
            'auto_watch' => $isClient ? null : ($setting === null || (bool) $setting->auto_watch),
            'groups' => $this->groups($events, $isClient),
            'events' => array_map(fn (NotificationEvent $event): array => [
                'key' => $event->value,
                'label' => $isClient ? $event->clientLabel() : $event->label(),
                'hint' => $isClient ? $event->clientHint() : $event->hint(),
                'group' => $event->group(),
                'enabled' => ! in_array($event->value, $disabled, true),
                // Компания выключила событие для всех связей, доступных пользователю: личный выключатель ни на что не влияет.
                'available' => $this->isAvailableFor($overrides, $event, $relations),
            ], $events),
        ];
    }

    /**
     * @param  array{events?: array<string, bool>, auto_watch?: bool|null}  $data
     * @return array<string, mixed>
     */
    public function updateUserSettings(User $user, array $data): array
    {
        $isClient = $this->isClient($user);
        $setting = UserNotificationSetting::query()->find($user->id);
        $disabled = array_map('strval', $setting?->disabled_events ?? []);
        $events = $this->eventsFor($user);

        foreach ($data['events'] ?? [] as $eventKey => $enabled) {
            $event = NotificationEvent::tryFrom((string) $eventKey);
            if (! $event || ! in_array($event, $events, true)) {
                continue;
            }

            $disabled = array_values(array_diff($disabled, [$event->value]));
            if (! $enabled) {
                $disabled[] = $event->value;
            }
        }

        UserNotificationSetting::query()->updateOrCreate(
            ['user_id' => $user->id],
            [
                'disabled_events' => array_values(array_unique($disabled)),
                'auto_watch' => ! $isClient && array_key_exists('auto_watch', $data) && $data['auto_watch'] !== null
                    ? (bool) $data['auto_watch']
                    : ($setting === null || (bool) $setting->auto_watch),
            ],
        );

        return $this->userSettings($user);
    }

    /**
     * События, которые вообще могут прийти пользователю: клиенту — клиентские, учёт времени — только админу,
     * переписка с клиентом — только с правом её видеть.
     *
     * @return array<int, NotificationEvent>
     */
    public function eventsFor(User $user): array
    {
        $isClient = $this->isClient($user);
        $relations = array_map(
            static fn (NotificationRelation $relation): string => $relation->value,
            $this->relationsFor($user),
        );

        return array_values(array_filter(
            NotificationEvent::cases(),
            fn (NotificationEvent $event): bool => array_intersect(
                array_map(static fn (NotificationRelation $relation): string => $relation->value, $event->relations()),
                $relations,
            ) !== [] && $this->access->canSeeEvent($user, $isClient, $event),
        ));
    }

    /**
     * Связи, которые у пользователя могут быть с задачами компании.
     *
     * @return array<int, NotificationRelation>
     */
    public function relationsFor(User $user): array
    {
        if ($this->isClient($user)) {
            return [NotificationRelation::CLIENT];
        }

        return array_values(array_filter(
            NotificationRelation::cases(),
            fn (NotificationRelation $relation): bool => ! $relation->isClient()
                && ($relation !== NotificationRelation::ADMIN || $this->isAdmin($user)),
        ));
    }

    public function isClient(User $user): bool
    {
        return $user->role === UserRole::CLIENT->value;
    }

    public function isAdmin(User $user): bool
    {
        return $user->role === UserRole::ADMIN->value;
    }

    /**
     * @param  array<string, array<string, bool>>  $overrides
     * @param  array<int, NotificationRelation>  $relations
     */
    private function isAvailableFor(array $overrides, NotificationEvent $event, array $relations): bool
    {
        foreach ($relations as $relation) {
            if ($this->isRelationEnabled($overrides, $event, $relation)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array<int, NotificationEvent>  $events
     * @return array<int, array{key: string, label: string, scope: string}>
     */
    private function groups(array $events, bool $forClient = false): array
    {
        return collect($events)
            ->map(static fn (NotificationEvent $event): string => $event->group())
            ->unique()
            ->values()
            ->map(static fn (string $group): array => [
                'key' => $group,
                'label' => NotificationEvent::groupLabel($group, $forClient),
                'scope' => NotificationEvent::groupScope($group),
            ])
            ->all();
    }
}
