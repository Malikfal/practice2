<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureActiveSubscription
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $impersonatedBySuperadmin = (bool) $request->attributes->get('impersonated_by_superadmin', false);

        if (! $user || $user->isSuperAdmin()) {
            return $next($request);
        }

        if ($impersonatedBySuperadmin) {
            return $next($request);
        }

        // Список путей, которые всегда будут доступны, даже если истекла подписка
        $allowedPrefixes = [
            'api/logout',
            'api/users/me',
            'api/admin/roles*',
            'api/imports*',
            'api/billing*',
            'api/settings*',
            'api/meta*',
            'api/profile*'
        ];

        if ($request->is($allowedPrefixes)) {
            return $next($request);
        }

        $company = $user->company;
        $subscription = $company?->subscription;

        // Блокируем если дата окончания есть и она в прошлом или вообще нет подписки 
        if (!$subscription || ($subscription->ends_at && $subscription->ends_at->isPast())) {
            return response()->json([
                'message' => 'Срок действия подписки истек. Пожалуйста, олатите тариф для продолжения работы. Настройки -> Подписка и платежи',
                'error_code' => 'SUBSCRIPTION_EXPIRED',
            ], 402);
        }

        return $next($request);
    }
}
