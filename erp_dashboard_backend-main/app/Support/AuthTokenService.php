<?php

namespace App\Support;

use App\Enums\UserRole;
use App\Models\RefreshSession;
use App\Models\User;
use Illuminate\Support\Str;
use RuntimeException;

class AuthTokenService
{
    public const TOKEN_TYPE_ACCESS = 'access';

    private const ACCESS_TOKEN_TTL = 15 * 60;
    private const REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60;

    private string $secret;

    public function __construct(?string $secret = null)
    {
        $this->secret = $secret ?? (string) env('JWT_SECRET', '');

        if ($this->secret === '') {
            throw new RuntimeException('Не задан секретный ключ JWT.');
        }
    }

    public function issueAuthTokens(User $user, bool $impersonatedBySuperadmin = false): array
    {
        return [
            'accessToken' => $this->issueAccessToken($user, $impersonatedBySuperadmin),
            'refreshToken' => $this->createRefreshSession($user),
        ];
    }

    public function accessTokenTtlSeconds(): int
    {
        return self::ACCESS_TOKEN_TTL;
    }

    public function refreshTokenTtlSeconds(): int
    {
        return self::REFRESH_TOKEN_TTL;
    }

    public function accessPayload(string $token): array
    {
        [$headerEncoded, $payloadEncoded, $signatureEncoded] = explode('.', $token) + [null, null, null];

        if (! $headerEncoded || ! $payloadEncoded || ! $signatureEncoded) {
            throw new RuntimeException('Токен JWT имеет неверный формат.');
        }

        $expectedSignature = hash_hmac('sha256', $headerEncoded.'.'.$payloadEncoded, $this->secret, true);
        $providedSignature = $this->base64UrlDecode($signatureEncoded);

        if (! hash_equals($expectedSignature, $providedSignature)) {
            throw new RuntimeException('Подпись токена JWT недействительна.');
        }

        $payload = json_decode($this->base64UrlDecode($payloadEncoded), true, 512, JSON_THROW_ON_ERROR);

        if (! is_array($payload)) {
            throw new RuntimeException('Содержимое токена JWT недействительно.');
        }

        if (($payload['token_type'] ?? null) !== self::TOKEN_TYPE_ACCESS) {
            throw new RuntimeException('Тип токена JWT не соответствует ожидаемому.');
        }

        if (isset($payload['exp']) && time() >= (int) $payload['exp']) {
            throw new RuntimeException('Срок действия токена JWT истёк.');
        }

        return $payload;
    }

    public function refresh(User $user, string $refreshToken): array
    {
        $session = $this->validRefreshSession($refreshToken, $user);
        $nextRefreshToken = $this->rotateRefreshSession($session);

        return [
            'accessToken' => $this->issueAccessToken($user),
            'refreshToken' => $nextRefreshToken,
        ];
    }

    public function revokeRefreshToken(?string $refreshToken): void
    {
        if (! is_string($refreshToken) || trim($refreshToken) === '') {
            return;
        }

        $session = RefreshSession::query()
            ->where('token_hash', $this->hashRefreshToken($refreshToken))
            ->first();

        if (! $session || $session->isRevoked()) {
            return;
        }

        $session->forceFill([
            'revoked_at' => now(),
            'last_used_at' => now(),
        ])->save();
    }

    public function findRefreshUser(string $refreshToken): ?User
    {
        $session = RefreshSession::query()
            ->where('token_hash', $this->hashRefreshToken($refreshToken))
            ->first();

        if (! $session || $session->isRevoked() || $session->isExpired()) {
            return null;
        }

        return $session->user;
    }

    private function issueAccessToken(User $user, bool $impersonatedBySuperadmin = false): string
    {
        $now = time();
        $claims = [
            'id' => (string) $user->id,
            'role' => $user->role,
            'device' => 'web',
            'token_type' => self::TOKEN_TYPE_ACCESS,
            'impersonated_by_superadmin' => $impersonatedBySuperadmin,
            'iat' => $now,
            'exp' => $now + self::ACCESS_TOKEN_TTL,
        ];

        $header = ['alg' => 'HS256', 'typ' => 'JWT'];
        $headerEncoded = $this->base64UrlEncode(json_encode($header, JSON_THROW_ON_ERROR));
        $payloadEncoded = $this->base64UrlEncode(json_encode($claims, JSON_THROW_ON_ERROR));
        $signature = hash_hmac('sha256', $headerEncoded.'.'.$payloadEncoded, $this->secret, true);

        return $headerEncoded.'.'.$payloadEncoded.'.'.$this->base64UrlEncode($signature);
    }

    private function createRefreshSession(User $user): string
    {
        $plainToken = $this->generateRefreshToken();

        RefreshSession::query()->create([
            'id' => (string) Str::uuid(),
            'user_id' => (string) $user->id,
            'token_hash' => $this->hashRefreshToken($plainToken),
            'expires_at' => now()->addSeconds(self::REFRESH_TOKEN_TTL),
        ]);

        return $plainToken;
    }

    private function rotateRefreshSession(RefreshSession $session): string
    {
        $plainToken = $this->generateRefreshToken();

        $session->forceFill([
            'token_hash' => $this->hashRefreshToken($plainToken),
            'expires_at' => now()->addSeconds(self::REFRESH_TOKEN_TTL),
            'revoked_at' => null,
            'last_used_at' => now(),
        ])->save();

        return $plainToken;
    }

    private function validRefreshSession(string $refreshToken, User $user): RefreshSession
    {
        $session = RefreshSession::query()
            ->where('token_hash', $this->hashRefreshToken($refreshToken))
            ->where('user_id', (string) $user->id)
            ->first();

        if (! $session || $session->isRevoked() || $session->isExpired()) {
            throw new RuntimeException('Токен обновления недействителен.');
        }

        return $session;
    }

    private function generateRefreshToken(): string
    {
        return rtrim(strtr(base64_encode(random_bytes(48)), '+/', '-_'), '=');
    }

    private function hashRefreshToken(string $refreshToken): string
    {
        return hash('sha256', trim($refreshToken));
    }

    private function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private function base64UrlDecode(string $data): string
    {
        $remainder = strlen($data) % 4;
        if ($remainder > 0) {
            $data .= str_repeat('=', 4 - $remainder);
        }

        $decoded = base64_decode(strtr($data, '-_', '+/'), true);

        if ($decoded === false) {
            throw new RuntimeException('Не удалось декодировать токен JWT.');
        }

        return $decoded;
    }
}
