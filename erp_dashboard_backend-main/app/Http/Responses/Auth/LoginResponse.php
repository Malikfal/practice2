<?php

namespace App\Http\Responses\Auth;

use App\Models\User;
use App\Support\RoleCatalog;
use App\Support\TariffAccess;
use Illuminate\Http\JsonResponse;

final class LoginResponse extends JsonResponse
{
    public function __construct(User $user)
    {
        $permissions = $user->effectivePermissionNames()->values()->all();

        parent::__construct([
            'user' => [
                'id' => (string) $user->id,
                'company_id' => $user->company_id,
                'createdAt' => $user->created_at?->toISOString(),
                'updatedAt' => $user->updated_at?->toISOString(),
                'email' => $user->email,
                'name' => $user->name,
                'role' => $user->role,
                'role_label' => RoleCatalog::labelForRole((string) $user->company_id, (string) $user->role),
                'status' => $user->status,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'avatar_url' => $user->avatar_url,
                'position' => $user->position,
                'birthday' => $user->birthday,
                'phone' => $user->phone,
                'socials' => empty($user->socials) ? (object) [] : $user->socials,
                'skills' => $user->skills,
                'payload' => empty($user->payload) ? (object) [] : $user->payload,
                'permissions' => $permissions,
                ...TariffAccess::payload($user),
            ],
        ]);
    }
}
