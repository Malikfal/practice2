<?php

namespace App\Http\Controllers\Api;

use App\Enums\TariffFeature;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Responses\Auth\LoginResponse;
use App\Http\Responses\Auth\RefreshTokenResponse;
use App\Models\Client;
use App\Models\User;
use App\Services\Auth\ClientPasswordSetupService;
use App\Support\AuthCookieService;
use App\Support\AuthTokenService;
use App\Support\TariffAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(
        private readonly AuthCookieService $authCookies,
        private readonly AuthTokenService $tokens,
        private readonly ClientPasswordSetupService $passwordSetup,
    ) {}

    public function login(LoginRequest $request): JsonResponse
    {
        $credentials = $request->validated();

        $user = User::withBlocked()->where('email', $credentials['email'])->first();

        if ($user && $user->role === UserRole::CLIENT->value && $user->password_set_at === null) {
            throw ValidationException::withMessages([
                'email' => ['Пароль ещё не установлен. Перейдите по ссылке из письма.'],
            ]);
        }

        if (! $user || ! password_verify($credentials['password'], $user->password_hash)) {
            throw ValidationException::withMessages([
                'email' => ['Неверный email или пароль.'],
            ]);
        }

        if ($user->role === UserRole::CLIENT->value && (empty($user->client_id)
            || ! Client::whereKey($user->client_id)->where('company_id', $user->company_id)->exists())) {
            throw ValidationException::withMessages(['email' => ['Клиентский аккаунт не привязан к клиенту.']]);
        }

        if (! $user->isSuperAdmin() && $user->isBlocked()) {
            throw ValidationException::withMessages([
                'email' => ['Пользователь заблокирован.'],
            ]);
        }

        if (! $user->isSuperAdmin() && $user->company?->isBlocked()) {
            return response()->json([
                'message' => 'Компания заблокирована.',
            ], 403);
        }

        if ($user->email_verified_at === null) {
            return response()->json([
                'message' => "Подтвердите почту: мы отправили письмо со ссылкой на {$user->email}.",
                'error_code' => 'EMAIL_NOT_VERIFIED',
                'email' => $user->email,
            ], 403);
        }

        if ($user->role === UserRole::CLIENT->value && $user->company && ! $user->company->hasTariffFeature(TariffFeature::CLIENT_ACCESS)) {
            return response()->json(TariffAccess::lockedResponseBody(TariffFeature::CLIENT_ACCESS), 403);
        }

        $user->flushPermissionCache();
        $user->forceFill(['last_login_at' => now()])->save();
        $tokens = $this->tokens->issueAuthTokens($user);

        return $this->authCookies->withAuthCookies(
            new LoginResponse($user),
            $tokens,
            $this->tokens->accessTokenTtlSeconds(),
            $this->tokens->refreshTokenTtlSeconds(),
        );
    }

    public function refresh(Request $request): JsonResponse
    {
        $refreshToken = (string) ($request->cookie('erp_refresh_token', '') ?: $request->input('refreshToken', ''));

        try {
            $user = $this->tokens->findRefreshUser($refreshToken);
            if (! $user) {
                return response()->json(['message' => 'Неверный refresh token'], 401);
            }
            if (! $user->isSuperAdmin() && $user->company?->isBlocked()) {
                return response()->json([
                    'message' => 'Компания заблокирована.',
                ], 403);
            }

            $tokens = $this->tokens->refresh($user, $refreshToken);

            return $this->authCookies->withAuthCookies(
                new RefreshTokenResponse,
                $tokens,
                $this->tokens->accessTokenTtlSeconds(),
                $this->tokens->refreshTokenTtlSeconds(),
            );
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Неверный refresh token'], 401);
        }
    }

    public function refreshClient(Request $request): JsonResponse
    {
        $refreshToken = (string) ($request->cookie('erp_refresh_token', '') ?: $request->input('refreshToken', ''));
        try {
            $user = $this->tokens->findRefreshUser($refreshToken);
            if (! $user || $user->role !== UserRole::CLIENT->value || ! $user->client_id || $user->isBlocked()
                || ! Client::whereKey($user->client_id)->where('company_id', $user->company_id)->exists()) {
                return response()->json(['message' => 'Неверный refresh token'], 401);
            }
            if ($user->company?->isBlocked()) {
                return response()->json(['message' => 'Компания заблокирована.'], 403);
            }
            if ($user->company && ! $user->company->hasTariffFeature(TariffFeature::CLIENT_ACCESS)) {
                return response()->json(TariffAccess::lockedResponseBody(TariffFeature::CLIENT_ACCESS), 403);
            }
            $tokens = $this->tokens->refresh($user, $refreshToken);

            return $this->authCookies->withAuthCookies(
                response()->json([
                    'user' => [
                        'id' => (string) $user->id,
                        'email' => $user->email,
                        'name' => $user->name,
                        'role' => $user->role,
                        'company_id' => $user->company_id,
                        'permissions' => $user->effectivePermissionNames()->values()->all(),
                        'client_id' => $user->client_id,
                    ],
                ]),
                $tokens,
                $this->tokens->accessTokenTtlSeconds(),
                $this->tokens->refreshTokenTtlSeconds(),
            );
        } catch (\Throwable) {
            return response()->json(['message' => 'Неверный refresh token'], 401);
        }
    }

    public function setClientPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);
        $user = $this->passwordSetup->consume($data['token'], $data['password']);
        $user->forceFill(['last_login_at' => now()])->save();
        $tokens = $this->tokens->issueAuthTokens($user);

        return $this->authCookies->withAuthCookies(
            new LoginResponse($user),
            $tokens,
            $this->tokens->accessTokenTtlSeconds(),
            $this->tokens->refreshTokenTtlSeconds(),
        );
    }

    public function logout(Request $request): JsonResponse
    {
        $refreshToken = (string) ($request->cookie('erp_refresh_token', '') ?: $request->input('refreshToken', ''));

        $this->tokens->revokeRefreshToken($refreshToken);

        return $this->authCookies->clearAuthCookies(
            response()->json(['message' => 'Вы вышли из системы.']),
        );
    }
}
