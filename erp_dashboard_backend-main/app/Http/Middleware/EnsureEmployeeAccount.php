<?php

namespace App\Http\Middleware;

use App\Enums\UserRole;
use Closure;
use Illuminate\Http\Request;

class EnsureEmployeeAccount
{
    public function handle(Request $request, Closure $next): mixed
    {
        if ($request->user()?->role === UserRole::CLIENT->value) {
            return response()->json(['message' => 'Этот API доступен только сотрудникам.'], 403);
        }

        return $next($request);
    }
}
