<?php

namespace App\Http\Middleware;

use App\Support\PermissionAccess;
use Closure;
use Illuminate\Http\Request;

class EnsureUserPermission
{
    public function handle(Request $request, Closure $next, string ...$permissions): mixed
    {
        $user = $request->user();

        if (! $user) {
            abort(403, 'Недостаточно прав.');
        }

        if (! PermissionAccess::canAny($user, $permissions)) {
            abort(403, 'Недостаточно прав.');
        }

        return $next($request);
    }
}
