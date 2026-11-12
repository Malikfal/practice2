<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class EnsureExternalApiToken
{
    public function handle(Request $request, Closure $next): mixed
    {
        $request->headers->set('Accept', 'application/json');

        $expectedToken = (string) config('services.external_api.token', '');

        if ($expectedToken === '') {
            return response()->json([
                'ok' => false,
                'data' => null,
                'error' => 'Токен API не настроен.',
            ], 500);
        }

        $providedToken = $this->extractToken($request);

        if ($providedToken === null || ! hash_equals($expectedToken, $providedToken)) {
            return response()->json([
                'ok' => false,
                'data' => null,
                'error' => 'Unauthorized.',
            ], 401);
        }

        $companyId = trim((string) config('services.external_api.company_id', ''));

        if ($companyId === '') {
            return response()->json([
                'ok' => false,
                'data' => null,
                'error' => 'External API company_id is not configured.',
            ], 500);
        }

        $request->attributes->set('company_id', $companyId);
        $request->merge(['company_id' => $companyId]);

        return $next($request);
    }

    private function extractToken(Request $request): ?string
    {
        $authorizationHeader = (string) $request->header('Authorization', '');

        if (str_starts_with($authorizationHeader, 'Bearer ')) {
            $bearerToken = trim(substr($authorizationHeader, 7));

            return $bearerToken !== '' ? $bearerToken : null;
        }

        return null;
    }
}
