<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\AuthLinkMail;
use App\Models\User;
use App\Services\Auth\UserActionTokenService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;
use Throwable;

class PasswordResetController extends Controller
{
    public function __construct(
        private readonly UserActionTokenService $actionTokens,
    ) {}

    public function forgot(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'string', 'email', 'max:255']]);

        // Суперадмин входит через отдельную админку, ему ссылка не нужна.
        $user = User::query()
            ->whereRaw('lower(email) = ?', [mb_strtolower(trim($data['email']))])
            ->whereNotNull('company_id')
            ->first();

        if ($user && ! $user->company?->isBlocked()) {
            $plain = $this->actionTokens->issue($user, UserActionTokenService::PASSWORD_RESET, now()->addHours(2));
            $url = UserActionTokenService::frontendUrl('/reset-password', $plain);

            try {
                Mail::to($user->email)->send(AuthLinkMail::resetPassword($user->name, $url));
            } catch (Throwable $e) {
                Log::error('Не удалось отправить письмо для сброса пароля', ['user_id' => $user->id, 'message' => $e->getMessage()]);
            }
        }

        return response()->json([
            'message' => 'Если почта зарегистрирована в ФЛОУ, мы отправили на неё ссылку для смены пароля.',
        ]);
    }

    /**
     * Проверяет ссылку до ввода пароля, не погашая её.
     */
    public function check(Request $request): JsonResponse
    {
        $data = $request->validate(['token' => ['required', 'string']]);

        $user = $this->actionTokens->find($data['token'], UserActionTokenService::PASSWORD_RESET);
        if (! $user || $user->isBlocked()) {
            throw ValidationException::withMessages([
                'token' => ['Ссылка недействительна или устарела. Запросите новую.'],
            ]);
        }

        return response()->json(['valid' => true, 'email' => $user->email]);
    }

    public function reset(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'max:255', 'confirmed'],
        ], [
            'password.min' => 'Пароль должен быть не короче 8 символов.',
            'password.confirmed' => 'Пароли не совпадают.',
        ]);

        $user = $this->actionTokens->consume($data['token'], UserActionTokenService::PASSWORD_RESET);
        if (! $user || $user->isBlocked()) {
            throw ValidationException::withMessages([
                'token' => ['Ссылка недействительна или устарела. Запросите новую.'],
            ]);
        }

        DB::transaction(function () use ($user, $data): void {
            // Переход по ссылке из письма подтверждает и саму почту.
            $user->forceFill([
                'password_hash' => Hash::make($data['password']),
                'password_set_at' => now(),
                'email_verified_at' => $user->email_verified_at ?? now(),
            ])->save();
            $user->refreshSessions()->whereNull('revoked_at')->update(['revoked_at' => now()]);
        });

        return response()->json([
            'message' => 'Пароль изменён. Войдите с новым паролем.',
            'email' => $user->email,
        ]);
    }
}
