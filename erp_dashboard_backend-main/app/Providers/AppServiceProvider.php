<?php

namespace App\Providers;

use App\Console\Kernel as AppConsoleKernel;
use App\Services\Workspace\TaskViewService;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Contracts\Console\Kernel as ConsoleKernelContract;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use Spatie\Activitylog\Models\Activity;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(ConsoleKernelContract::class, AppConsoleKernel::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Gate::before(function ($user, string $ability): ?bool {
            if ($user->hasDeniedPermission($ability)) {
                return false;
            }

            return null;
        });

        // Публичные формы входа и регистрации: счётчик свой у каждого адреса и IP.
        RateLimiter::for('auth-public', static fn (Request $request): Limit => Limit::perMinute(5)
            ->by($request->path().'|'.$request->ip()));

        Activity::created(static function (Activity $activity): void {
            app(TaskViewService::class)->recordActivity($activity);
        });
    }
}
