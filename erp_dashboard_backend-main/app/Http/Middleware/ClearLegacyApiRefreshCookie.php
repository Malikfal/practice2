<?php

namespace App\Http\Middleware;

use App\Support\AuthCookieService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ClearLegacyApiRefreshCookie
{
    public function __construct(
        private readonly AuthCookieService $authCookies,
    ) {
    }

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        return $this->authCookies->clearLegacyApiRefreshCookie($response);
    }
}
