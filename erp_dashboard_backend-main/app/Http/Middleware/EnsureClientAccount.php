<?php

namespace App\Http\Middleware;

use App\Enums\UserRole;
use App\Models\Client;
use Closure;
use Illuminate\Http\Request;

class EnsureClientAccount
{
    public function handle(Request $request, Closure $next): mixed
    {
        $user = $request->user();
        if (! $user || $user->role !== UserRole::CLIENT->value || ! $user->client_id || $user->isBlocked()
            || ! Client::whereKey($user->client_id)->where('company_id', $user->company_id)->exists()) {
            return response()->json(['message' => 'Доступ клиента запрещен.'], 403);
        }

        return $next($request);
    }
}
