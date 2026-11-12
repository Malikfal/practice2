<?php

namespace App\Services\Auth;

use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Одноразовые ссылки из писем: подтверждение почты и сброс пароля.
 */
class UserActionTokenService
{
    public const EMAIL_VERIFICATION = 'email_verification';

    public const PASSWORD_RESET = 'password_reset';

    /**
     * Выдаёт новую ссылку. С $replacePrevious прежние ссылки того же назначения перестают работать.
     */
    public function issue(User $user, string $purpose, CarbonInterface $expiresAt, bool $replacePrevious = true): string
    {
        $plain = Str::random(64);

        DB::transaction(function () use ($user, $purpose, $expiresAt, $plain, $replacePrevious): void {
            $query = DB::table('user_action_tokens')->where('user_id', $user->id)->where('purpose', $purpose);
            $replacePrevious ? $query->delete() : $query->where('expires_at', '<', now())->delete();
            DB::table('user_action_tokens')->insert([
                'id' => (string) Str::uuid(),
                'user_id' => $user->id,
                'purpose' => $purpose,
                'token_hash' => hash('sha256', $plain),
                'expires_at' => $expiresAt,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });

        return $plain;
    }

    /**
     * Гасит ссылку и возвращает её владельца, если ссылка действительна.
     */
    public function consume(string $plainToken, string $purpose): ?User
    {
        if ($plainToken === '') {
            return null;
        }

        return DB::transaction(function () use ($plainToken, $purpose): ?User {
            $row = DB::table('user_action_tokens')
                ->where('token_hash', hash('sha256', $plainToken))
                ->where('purpose', $purpose)
                ->lockForUpdate()
                ->first();

            if (! $row) {
                return null;
            }

            DB::table('user_action_tokens')->where('id', $row->id)->delete();

            if (now()->greaterThan($row->expires_at)) {
                return null;
            }

            return User::withBlocked()->whereKey($row->user_id)->first();
        });
    }

    /**
     * Владелец действующей ссылки без её погашения.
     */
    public function find(string $plainToken, string $purpose): ?User
    {
        if ($plainToken === '') {
            return null;
        }

        $row = DB::table('user_action_tokens')
            ->where('token_hash', hash('sha256', $plainToken))
            ->where('purpose', $purpose)
            ->where('expires_at', '>', now())
            ->first();

        return $row ? User::withBlocked()->whereKey($row->user_id)->first() : null;
    }

    public static function frontendUrl(string $path, string $plainToken): string
    {
        $frontend = strtok((string) env('FRONTEND_URL', 'http://localhost:4000'), ',') ?: 'http://localhost:4000';

        return rtrim($frontend, '/').$path.'?token='.urlencode($plainToken);
    }
}
