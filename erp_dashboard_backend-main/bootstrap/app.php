<?php

use App\Http\Middleware\ClearLegacyApiRefreshCookie;
use App\Http\Middleware\EnsureAccessToken;
use App\Http\Middleware\EnsureActiveSubscription;
use App\Http\Middleware\EnsureClientAccount;
use App\Http\Middleware\EnsureCompanyIsActive;
use App\Http\Middleware\EnsureEmployeeAccount;
use App\Http\Middleware\EnsureExternalApiToken;
use App\Http\Middleware\EnsureSuperAdmin;
use App\Http\Middleware\EnsureTariffFeature;
use App\Http\Middleware\EnsureUserPermission;
use App\Http\Middleware\EnsureUserRole;
use App\Http\Middleware\InjectCompanyContext;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Request as SymfonyRequest;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->trustProxies(
            at: '*',
            headers: SymfonyRequest::HEADER_X_FORWARDED_FOR
                | SymfonyRequest::HEADER_X_FORWARDED_HOST
                | SymfonyRequest::HEADER_X_FORWARDED_PORT
                | SymfonyRequest::HEADER_X_FORWARDED_PROTO
                | SymfonyRequest::HEADER_X_FORWARDED_PREFIX
                | SymfonyRequest::HEADER_X_FORWARDED_AWS_ELB
        );
        $middleware->redirectGuestsTo(static fn (Request $request): string => route('admin.login'));
        $middleware->encryptCookies(except: [
            'erp_access_token',
            'erp_refresh_token',
        ]);
        $middleware->appendToGroup('api', ClearLegacyApiRefreshCookie::class);

        $middleware->alias([
            'auth.access' => EnsureAccessToken::class,
            'company.active' => EnsureCompanyIsActive::class,
            'company.context' => InjectCompanyContext::class,
            'subscription.active' => EnsureActiveSubscription::class,
            'tariff.features' => EnsureTariffFeature::class,
            'role' => EnsureUserRole::class,
            'permission' => EnsureUserPermission::class,
            'external-api.token' => EnsureExternalApiToken::class,
            'superadmin' => EnsureSuperAdmin::class,
            'employee.only' => EnsureEmployeeAccount::class,
            'client.only' => EnsureClientAccount::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
