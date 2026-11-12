<?php

namespace App\Services\Workspace\Reports\FlowStats;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Отправка статистики Flow в Telegram. Настройки свои (services.flow_stats), а не services.telegram,
 * через который уходят заявки с сайта.
 */
class FlowStatsTelegramSender
{
    public function isConfigured(): bool
    {
        return (string) config('services.flow_stats.bot_token', '') !== '' && $this->chatIds() !== [];
    }

    /**
     * Отправляет сообщения по порядку в каждый чат. Ошибка в одном чате не останавливает отправку в другие.
     *
     * @param  list<string>  $messages
     */
    public function send(array $messages): bool
    {
        $token = (string) config('services.flow_stats.bot_token', '');
        $sent = true;

        foreach ($this->chatIds() as $chatId) {
            foreach ($messages as $message) {
                if (! $this->sendMessage($token, $chatId, $message)) {
                    $sent = false;

                    break;
                }
            }
        }

        return $sent;
    }

    /**
     * @return list<string>
     */
    public function chatIds(): array
    {
        return array_values(array_filter(array_map(
            trim(...),
            explode(',', (string) config('services.flow_stats.chat_ids', '')),
        )));
    }

    private function sendMessage(string $token, string $chatId, string $message): bool
    {
        try {
            $proxy = (string) config('services.flow_stats.proxy', '');
            $response = Http::timeout(15)
                ->connectTimeout(5)
                ->withOptions($proxy !== '' ? ['proxy' => $proxy] : [])
                ->retry(2, 1000, throw: false)
                ->post("https://api.telegram.org/bot{$token}/sendMessage", [
                    'chat_id' => $chatId,
                    'text' => $message,
                    'parse_mode' => 'HTML',
                    'link_preview_options' => ['is_disabled' => true],
                ]);

            if ($response->failed()) {
                Log::error('Не удалось отправить статистику Flow в Telegram', [
                    'chat_id' => $chatId,
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return false;
            }

            return true;
        } catch (Throwable $e) {
            Log::error('Ошибка соединения с Telegram при отправке статистики Flow', [
                'chat_id' => $chatId,
                // Текст ошибки cURL содержит URL запроса, а в нем токен бота.
                'message' => str_replace($token, '***', $e->getMessage()),
            ]);

            return false;
        }
    }
}
