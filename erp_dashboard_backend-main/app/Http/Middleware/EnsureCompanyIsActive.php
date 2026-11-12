<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class EnsureCompanyIsActive
{
    public function handle(Request $request, Closure $next): mixed
    {
        $user = $request->user();
        $impersonatedBySuperadmin = (bool) $request->attributes->get('impersonated_by_superadmin', false);

        if (! $user || $user->isSuperAdmin()) {
            return $next($request);
        }

        if ($impersonatedBySuperadmin) {
            return $next($request);
        }

        $company = $user->company;

        if ($company && $company->isBlocked()) {
            return response()->json([
                'message' => 'Компания заблокирована.',
            ], 403);
        }

        return $next($request);
    }
}
