<?php

namespace App\Http\Resources\Workspace;

use App\Models\Template;
use App\Support\RoleCatalog;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Template
 */
class TemplateResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'name' => $this->name,
            'is_default_template' => (bool) $this->is_default,
            'manager' => $this->manager ? [
                'id' => (string) $this->manager->id,
                'first_name' => $this->manager->first_name,
                'last_name' => $this->manager->last_name,
                'email' => $this->manager->email,
                'role' => $this->manager->role,
                'role_label' => RoleCatalog::labelForRole(
                    (string) $this->manager->company_id,
                    (string) $this->manager->role,
                ),
                'status' => $this->manager->status,
            ] : null,
            'members' => $this->members->map(function (object $member): array {
                $user = $member->user;

                return [
                    'id' => (string) $member->id,
                    'user' => [
                        'id' => (string) $user->id,
                        'first_name' => $user->first_name,
                        'last_name' => $user->last_name,
                        'email' => $user->email,
                        'role' => $user->role,
                        'role_label' => RoleCatalog::labelForRole(
                            (string) $user->company_id,
                            (string) $user->role,
                        ),
                        'status' => $user->status,
                    ],
                ];
            })->values()->all(),
            'status_columns' => $this->statusColumns->map(static function (object $column): array {
                return [
                    'id' => (string) $column->id,
                    'name' => $column->name,
                    'label' => $column->name,
                    'slug' => $column->slug,
                    'color' => $column->color,
                    'position' => (int) $column->position,
                    'order' => (int) $column->position,
                    'is_final' => (bool) $column->is_final,
                ];
            })->values()->all(),
        ];
    }
}
