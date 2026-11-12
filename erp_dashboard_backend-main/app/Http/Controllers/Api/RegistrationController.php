<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\RegisterCompanyRequest;
use App\Http\Responses\Auth\LoginResponse;
use App\Models\User;
use App\Services\Auth\CompanyRegistrationService;
use App\Services\Auth\UserActionTokenService;
use App\Support\AuthCookieService;
use App\Support\AuthTokenService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class RegistrationController extends Controller
{
    public function __construct(
        private readonly CompanyRegistrationService $registration,
        private readonly UserActionTokenService $actionTokens,
        private readonly AuthCookieService $authCookies,
        private readonly AuthTokenService $tokens,
    ) {}

    public function register(RegisterCompanyRequest $request): JsonResponse
    {
        $owner = $this->registration->register($request->validated(), $request->ip());

        return response()->json([
            'message' => 'Компания создана. Мы отправили письмо для подтверждения почты.',
            'email' => $owner->email,
        ], 201);
    }

    /**
     * Подтверждает почту по ссылке из письма и сразу выполняет вход.
     */
    public function verifyEmail(Request $request): JsonResponse
    {
        $data = $request->validate(['token' => ['required', 'string']]);

        // Ссылку не гасим: повторный переход по ней покажет «почта уже подтверждена», но не выполнит вход.
        $user = $this->actionTokens->find($data['token'], UserActionTokenService::EMAIL_VERIFICATION);
        if (! $user || $user->isBlocked() || $user->company?->isBlocked()) {
            throw ValidationException::withMessages([
                'token' => ['Ссылка недействительна или устарела. Запросите новое письмо.'],
            ]);
        }

        if ($user->email_verified_at !== null) {
            return response()->json([
                'already_verified' => true,
                'email' => $user->email,
            ]);
        }

        $user->forceFill([
            'email_verified_at' => now(),
            'last_login_at' => now(),
        ])->save();
        $user->flushPermissionCache();
        $tokens = $this->tokens->issueAuthTokens($user);

        return $this->authCookies->withAuthCookies(
            new LoginResponse($user),
            $tokens,
            $this->tokens->accessTokenTtlSeconds(),
            $this->tokens->refreshTokenTtlSeconds(),
        );
    }

    public function resendVerification(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'string', 'email', 'max:255']]);

        $user = User::query()
            ->whereRaw('lower(email) = ?', [mb_strtolower(trim($data['email']))])
            ->whereNull('email_verified_at')
            ->first();

        if ($user) {
            $this->registration->sendVerification($user);
        }

        // Ответ одинаковый, чтобы по нему нельзя было проверить, зарегистрирована ли почта.
        return response()->json([
            'message' => 'Если почта ожидает подтверждения, мы отправили на неё новое письмо.',
        ]);
    }
}
