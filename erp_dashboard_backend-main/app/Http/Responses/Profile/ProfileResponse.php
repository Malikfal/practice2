<?php

namespace App\Http\Responses\Profile;

use App\Enums\UserPermission;
use App\Models\User;
use App\Support\RoleCatalog;
use App\Support\TariffAccess;
use Illuminate\Http\JsonResponse;

final class ProfileResponse extends JsonResponse
{
    public function __construct(User $user)
    {
        $uiPermissionValues = collect(UserPermission::uiValues());
        $permissions = $user->effectivePermissionNames()
            ->filter(static fn (string $permission): bool => $uiPermissionValues->contains($permission))
            ->values()
            ->all();

        parent::__construct([
            'id' => $user->id,
            'company_id' => $user->company_id,
            'email' => $user->email,
            'name' => $user->name,
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'role' => $user->role,
            'role_label' => RoleCatalog::labelForRole((string) $user->company_id, (string) $user->role),
            'status' => $user->status,
            'avatar_url' => $user->avatar_url,
            'position' => $user->position,
            'birthday' => $user->birthday,
            'phone' => $user->phone,
            'socials' => empty($user->socials) ? (object) [] : $user->socials,
            'skills' => $user->skills,
            'payload' => empty($user->payload) ? (object) [] : $user->payload,
            'permissions' => $permissions,
            ...TariffAccess::payload($user),
        ]);
    }
}
