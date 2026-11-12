<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Support\AuthTokenService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class EnsureAccessToken
{
    public function __construct(
        private readonly AuthTokenService $tokens,
    ) {
    }

    public function handle(Request $request, Closure $next): mixed
    {
        $token = (string) ($request->bearerToken() ?: $request->cookie('erp_access_token', ''));

        if ($token === '') {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        try {
            $payload = $this->tokens->accessPayload($token);
            $user = User::find((string) ($payload['id'] ?? ''));

            if (! $user) {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            }

            $impersonatedBySuperadmin = (bool) ($payload['impersonated_by_superadmin'] ?? false);

            if ($user->isBlocked()) {
                return response()->json(['message' => 'Пользователь заблокирован.'], 403);
            }

            if (! $user->isSuperAdmin() && ! $impersonatedBySuperadmin && $user->company?->isBlocked()) {
                return response()->json(['message' => 'Компания заблокирована.'], 403);
            }

            Auth::shouldUse('web');
            Auth::setUser($user);
            $request->setUserResolver(fn () => $user);
            $request->attributes->set('impersonated_by_superadmin', $impersonatedBySuperadmin);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        return $next($request);
    }
}
