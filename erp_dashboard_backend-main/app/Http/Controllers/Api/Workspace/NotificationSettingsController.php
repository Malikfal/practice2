<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\ShowNotificationSettingsRequest;
use App\Http\Requests\Workspace\UpdateNotificationSettingsRequest;
use App\Services\Notifications\NotificationSettingsService;
use Illuminate\Http\JsonResponse;

/**
 * Вкладка «Уведомления» в настройках рабочего пространства: кому из связанных с задачей приходят события.
 */
class NotificationSettingsController extends Controller
{
    public function __construct(
        private readonly NotificationSettingsService $settings,
    ) {}

    public function show(ShowNotificationSettingsRequest $request): JsonResponse
    {
        return response()->json(['data' => $this->settings->companyMatrix((string) $request->user()->company_id)]);
    }

    public function update(UpdateNotificationSettingsRequest $request): JsonResponse
    {
        $rules = [];
        foreach ($request->validated('rules') as $rule) {
            $rules[(string) $rule['event']][(string) $rule['relation']] = (bool) $rule['enabled'];
        }

        return response()->json([
            'data' => $this->settings->updateCompanyMatrix((string) $request->user()->company_id, $rules),
        ]);
    }
}
