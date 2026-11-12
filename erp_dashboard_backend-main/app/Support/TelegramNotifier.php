<?php

namespace App\Support;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class TelegramNotifier
{
    public function send(string $text): bool
    {
        $token = config('services.telegram.bot_token');
        $chatId = config('services.telegram.chat_id');

        if (! $token || ! $chatId) {
            Log::warning('Telegram не настроен: пропускаю отправку сообщения.');

            return false;
        }

        try {
            $response = Http::timeout(6)
                ->connectTimeout(4)
                ->retry(1, 300, throw: false)
                ->post("https://api.telegram.org/bot{$token}/sendMessage", [
                    'chat_id' => $chatId,
                    'text' => $text,
                    'parse_mode' => 'HTML',
                ]);

            if ($response->failed()) {
                Log::error('Не удалось отправить сообщение в Telegram', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return false;
            }

            return true;
        } catch (Throwable $e) {
            Log::error('Ошибка соединения с Telegram', [
                'message' => $e->getMessage(),
            ]);

            return false;
        }
    }
}
