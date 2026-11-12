<?php

namespace App\Http\Controllers\Api\Web;

use App\Http\Controllers\Controller;
use App\Http\Requests\Web\StoreApplicationRequest;
use App\Models\Application;
use App\Support\TelegramNotifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;

class ApplicationController extends Controller
{
    public function __construct(
        private readonly TelegramNotifier $telegram,
    ) {
    }

    public function store(StoreApplicationRequest $request): JsonResponse
    {
        $data = $request->validated();

        $application = Application::create([
            'id' => (string) Str::uuid(),
            'name' => $data['name'],
            'phone' => $data['phone'],
            'tariff' => $data['tariff'] ?? null,
            'personal_data_consent' => true,
            'marketing_consent' => (bool) ($data['marketing_consent'] ?? false),
            'ip' => $request->ip(),
        ]);

        $text = "<b>🆕 Новая заявка на доступ к ФЛОУ</b>\n\n"
            ."👤 Имя: ".e($application->name)."\n"
            ."📞 Телефон / Telegram: ".e($application->phone)."\n"
            ."💳 Тариф: ".e($application->tariff ?: 'не выбран')."\n"
            ."📣 Согласия на получение рекламных и информационных сообщений: ".($application->marketing_consent ? 'да' : 'нет');

        $this->telegram->send($text);

        return response()->json([
            'message' => 'Заявка успешно отправлена. Мы свяжемся с вами в ближайшее время.',
        ], 201);
    }
}
