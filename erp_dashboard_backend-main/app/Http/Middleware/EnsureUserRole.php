<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class EnsureUserRole
{
    public function handle(Request $request, Closure $next, string ...$roles): mixed
    {
        $user = $request->user();

        if (! $user) {
            abort(403, 'Недостаточно прав.');
        }

        if (method_exists($user, 'isSuperAdmin') && $user->isSuperAdmin()) {
            return $next($request);
        }

        if ($roles !== []) {
            $hasLegacyRole = in_array((string) $user->role, $roles, true);

            if (! $hasLegacyRole) {
                abort(403, 'Недостаточно прав.');
            }
        }

        return $next($request);
    }
}
