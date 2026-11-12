<?php

namespace App\Http\Middleware;

use App\Support\TariffAccess;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Закрывает на ФРИ маршруты возможностей ПРО, которые не покрыты правами.
 */
class EnsureTariffFeature
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || $user->isSuperAdmin() || ! $user->company_id) {
            return $next($request);
        }

        $feature = TariffAccess::lockedFeatureForRequest($user, $request);
        if ($feature !== null) {
            return response()->json(TariffAccess::lockedResponseBody($feature), 403);
        }

        return $next($request);
    }
}
