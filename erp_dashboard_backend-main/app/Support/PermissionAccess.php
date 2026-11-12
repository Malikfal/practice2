<?php

namespace App\Support;

use App\Models\User;

final class PermissionAccess
{
    /**
     * @param array<int, string> $permissions
     */
    public static function canAny(?User $user, array $permissions): bool
    {
        if (! $user) {
            return false;
        }

        if ($permissions === []) {
            return true;
        }

        foreach ($permissions as $permission) {
            if ($user->can($permission)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param array<int, string> $permissions
     */
    public static function canAll(?User $user, array $permissions): bool
    {
        if (! $user) {
            return false;
        }

        foreach ($permissions as $permission) {
            if (! $user->can($permission)) {
                return false;
            }
        }

        return true;
    }
}
