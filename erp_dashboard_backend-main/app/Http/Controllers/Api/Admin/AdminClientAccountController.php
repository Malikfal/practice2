<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\RolesAccessRequest;
use App\Models\Client;
use App\Models\User;
use Illuminate\Http\JsonResponse;

/**
 * Клиентские аккаунты для вкладки «Клиенты» в разделе «Роли и права».
 * Индивидуальные права сохраняются через AdminEmployeeController::syncPermissions.
 */
class AdminClientAccountController extends Controller
{
    public function index(RolesAccessRequest $request): JsonResponse
    {
        $companyId = (string) ($request->attributes->get('company_id') ?? $request->user()?->company_id ?? '');

        $accounts = User::withBlocked()
            ->where('company_id', $companyId)
            ->whereHas('roleModel', fn ($query) => $query->where('name', UserRole::CLIENT->value))
            ->whereNotNull('client_id')
            ->orderBy('name')
            ->get();
        $clientNames = Client::query()
            ->whereIn('id', $accounts->pluck('client_id')->unique())
            ->pluck('name', 'id');

        return response()->json([
            'data' => $accounts->map(static fn (User $user): array => [
                'id' => (string) $user->id,
                'first_name' => $user->name,
                'last_name' => null,
                'email' => $user->email,
                'role' => UserRole::CLIENT->value,
                'status' => $user->status,
                'client_id' => (string) $user->client_id,
                'client_name' => $clientNames[(string) $user->client_id] ?? null,
                'permissions' => $user->effectivePermissionNames()->values()->all(),
                'role_permissions' => $user->rolePermissionNames()->values()->all(),
                'direct_permissions' => $user->getDirectPermissions()->pluck('name')->values()->all(),
                'denied_permissions' => $user->deniedPermissionNames()->values()->all(),
            ])->values(),
        ]);
    }
}
