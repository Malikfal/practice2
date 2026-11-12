<?php

namespace App\Http\Resources\Notifications;

use App\Enums\NotificationRelation;
use App\Enums\UserRole;
use App\Models\User;
use App\Models\UserNotification;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Уведомление для ленты. Тот же вид уходит в WebSocket, поэтому формат один для REST и сокета.
 *
 * @mixin UserNotification
 */
class UserNotificationResource extends JsonResource
{
    /**
     * Связи, которые нужно загрузить перед выдачей.
     *
     * @var array<int, string>
     */
    public const RELATIONS = [
        'actor:id,name,last_name,role_id',
        'actor.roleModel:id,name',
        'task:id,title,project_id',
        'project:id,name,company_id',
        'project.company:id,name',
        'user:id,role_id',
        'user.roleModel:id,name',
    ];

    public function toArray(Request $request): array
    {
        $task = $this->task;
        $project = $this->project;

        return [
            'id' => (string) $this->id,
            'type' => $this->type,
            'task' => $task ? [
                'id' => (string) $task->id,
                'title' => (string) $task->title,
                'project_id' => (string) $task->project_id,
            ] : null,
            'project' => $project ? [
                'id' => (string) $project->id,
                'name' => (string) $project->name,
            ] : null,
            'actor' => $this->actorPayload(),
            'data' => (object) ($this->data ?? []),
            'reasons' => array_values(array_filter(array_map(
                static function (string $reason): ?array {
                    $relation = NotificationRelation::tryFrom($reason);

                    return $relation ? ['key' => $relation->value, 'label' => $relation->reason()] : null;
                },
                $this->reasons ?? [],
            ))),
            'read_at' => $this->read_at?->toISOString(),
            'created_at' => $this->created_at?->toISOString(),
        ];
    }

    /**
     * Клиенту имена сотрудников не показываются, как и в переписке кабинета: вместо них название компании.
     *
     * @return array{id: string|null, name: string}|null
     */
    private function actorPayload(): ?array
    {
        $actor = $this->actor;

        if (! $actor instanceof User) {
            return null;
        }

        $recipientIsClient = $this->user?->role === UserRole::CLIENT->value;
        $actorIsClient = $actor->role === UserRole::CLIENT->value;

        if ($recipientIsClient && ! $actorIsClient) {
            return [
                'id' => null,
                'name' => (string) ($this->project?->company?->name ?: 'Компания'),
            ];
        }

        // Аксессор last_name достраивает фамилию из имени, поэтому берём сохранённое значение.
        return [
            'id' => (string) $actor->id,
            'name' => trim($actor->name.' '.($actor->getRawOriginal('last_name') ?? '')),
        ];
    }
}
