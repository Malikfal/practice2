<?php

namespace App\Support;

use App\Enums\TariffFeature;
use App\Models\User;
use Illuminate\Http\Request;

final class TariffAccess
{
    /**
     * Сведения о тарифе для фронта: что закрыто и где показать «Доступно на ПРО».
     *
     * @return array{tariff: array<string, mixed>|null, locked_features: array<int, string>, tariff_locked_permissions: array<int, string>}
     */
    public static function payload(User $user): array
    {
        $tariff = $user->company_id ? $user->company?->tariff : null;

        return [
            'tariff' => $tariff ? [
                'id' => (string) $tariff->id,
                'name' => $tariff->name,
                'plan' => $tariff->plan,
                'max_employees' => $tariff->max_employees,
            ] : null,
            'locked_features' => array_map(
                static fn (TariffFeature $feature): string => $feature->value,
                $user->company_id ? ($user->company?->lockedTariffFeatures() ?? []) : [],
            ),
            'tariff_locked_permissions' => $user->tariffBlockedPermissionNames()->values()->all(),
        ];
    }

    /**
     * Возможность ПРО, к которой относится запрос, если она закрыта тарифом компании.
     */
    public static function lockedFeatureForRequest(User $user, Request $request): ?TariffFeature
    {
        foreach ($user->company?->lockedTariffFeatures() ?? [] as $feature) {
            $patterns = $feature->routePatterns();
            if ($patterns !== [] && $request->is($patterns)) {
                return $feature;
            }
        }

        return null;
    }

    /**
     * @return array{message: string, error_code: string, feature: string}
     */
    public static function lockedResponseBody(TariffFeature $feature): array
    {
        return [
            'message' => "Раздел «{$feature->label()}» доступен на тарифе ПРО. Сменить тариф можно в разделе Настройки → Подписка и платежи.",
            'error_code' => 'TARIFF_FEATURE_LOCKED',
            'feature' => $feature->value,
        ];
    }
}
