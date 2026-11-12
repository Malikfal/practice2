<?php

namespace App\Support;

use Illuminate\Support\Facades\Http;

final class SmartCaptcha
{
    /**
     * Ключ не задан только в локальной разработке и тестах: там капчу не проверяем.
     */
    public static function isEnabled(): bool
    {
        return trim((string) config('services.smartcaptcha.secret')) !== ''
            || ! app()->environment(['local', 'testing']);
    }

    /**
     * Возвращает текст ошибки или null, если проверка пройдена.
     */
    public static function verify(string $token, ?string $ip): ?string
    {
        $response = Http::asForm()->timeout(8)->post('https://smartcaptcha.yandexcloud.net/validate', [
            'secret' => config('services.smartcaptcha.secret'),
            'token' => $token,
            'ip' => $ip,
        ]);

        $result = $response->json();

        if (($result['status'] ?? null) === 'ok') {
            return null;
        }

        $message = (string) ($result['message'] ?? '');

        return $message !== '' ? $message : 'Проверка SmartCaptcha не пройдена.';
    }
}
