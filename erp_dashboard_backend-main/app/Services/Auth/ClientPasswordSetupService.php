<?php

namespace App\Services\Auth;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ClientPasswordSetupService
{
    public function issueUrl(User $user): string
    {
        $plain = Str::random(64);
        DB::table('client_password_tokens')->where('user_id', $user->id)->delete();
        DB::table('client_password_tokens')->insert([
            'id' => (string) Str::uuid(),
            'user_id' => $user->id,
            'token_hash' => hash('sha256', $plain),
            'expires_at' => now()->addDay(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $frontend = strtok((string) env('FRONTEND_URL', 'http://localhost:4000'), ',') ?: 'http://localhost:4000';

        return rtrim($frontend, '/').'/client/set-password?token='.urlencode($plain);
    }

    public function consume(string $plainToken, string $password): User
    {
        $row = DB::table('client_password_tokens')->where('token_hash', hash('sha256', $plainToken))->first();
        if (! $row || now()->greaterThan($row->expires_at)) {
            throw ValidationException::withMessages(['token' => ['Ссылка недействительна или устарела.']]);
        }

        $user = User::withBlocked()->whereKey($row->user_id)->first();
        if (! $user || $user->role !== UserRole::CLIENT->value || $user->isBlocked() || ! $user->client_id) {
            throw ValidationException::withMessages(['token' => ['Ссылка недействительна или устарела.']]);
        }

        DB::transaction(function () use ($user, $password, $row): void {
            $user->update([
                'password_hash' => Hash::make($password),
                'password_set_at' => now(),
            ]);
            $user->refreshSessions()->whereNull('revoked_at')->update(['revoked_at' => now()]);
            DB::table('client_password_tokens')->where('id', $row->id)->delete();
        });

        return $user->fresh();
    }
}
