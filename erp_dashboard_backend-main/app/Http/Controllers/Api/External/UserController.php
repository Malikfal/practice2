<?php

namespace App\Http\Controllers\Api\External;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class UserController extends Controller
{
    public function index(\Illuminate\Http\Request $request): JsonResponse
    {
        $companyId = (string) $request->attributes->get('company_id', '');

        $users = User::query()
            ->select(['id', 'name', 'last_name', 'email'])
            ->when($companyId !== '', fn ($query) => $query->where('company_id', $companyId))
            ->orderBy('last_name')
            ->orderBy('name')
            ->orderBy('email')
            ->get()
            ->map(fn (User $user): array => [
                'id' => (string) $user->id,
                'firstName' => (string) $user->name,
                'lastName' => (string) $user->last_name,
                'email' => (string) $user->email,
            ])
            ->values();

        return response()->json($users);
    }
}
