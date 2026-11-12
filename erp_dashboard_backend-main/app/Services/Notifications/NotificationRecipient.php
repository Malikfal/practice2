<?php

namespace App\Services\Notifications;

use App\Enums\NotificationEvent;
use App\Enums\NotificationRelation;
use App\Models\User;

/**
 * Получатель уведомления: какие события действия ему положены и по каким связям с задачей.
 */
final class NotificationRecipient
{
    /**
     * @param  array<int, NotificationEvent>  $events
     * @param  array<int, NotificationRelation>  $reasons
     */
    public function __construct(
        public readonly User $user,
        public readonly bool $isClient,
        public readonly array $events,
        public readonly array $reasons,
    ) {}

    /**
     * @return array<int, string>
     */
    public function reasonValues(): array
    {
        return array_map(static fn (NotificationRelation $relation): string => $relation->value, $this->reasons);
    }

    public function receives(NotificationEvent $event): bool
    {
        return in_array($event, $this->events, true);
    }
}
