<?php

namespace App\Http\Resources\Workspace;

use App\Models\ProjectMember;
use App\Support\RoleCatalog;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin ProjectMember
 */
final class ProjectMemberResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $user = $this->user;

        return [
            'id' => (string) $this->id,
            'is_pm' => (bool) ($this->is_pm ?? false),
            'is_pm_payroll_enabled' => (bool) ($this->is_pm ?? false)
                && (bool) ($this->is_pm_payroll_enabled ?? true),
            'user' => $user ? [
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
            ] : null,
        ];
    }
}
