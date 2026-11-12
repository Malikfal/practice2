<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class InjectCompanyContext
{
    public function handle(Request $request, Closure $next): mixed
    {
        $user = $request->user();

        if (! $user || $user->isSuperAdmin()) {
            return $next($request);
        }

        $companyId = (string) ($user->company_id ?? '');

        $request->attributes->set('company_id', $companyId);

        $request->merge([
            'company_id' => $companyId,
        ]);

        return $next($request);
    }
}
