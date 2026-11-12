<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\Subscription;
use App\Models\Tariff;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class BillingInitSeeder extends Seeder
{
    public function run(): void
    {
        // Обновляем базовые тарифы
        $tariffsData = [
            ['name' => '5 + 1 сотрудник', 'max_employees' => 6, 'price' => 1500, 'is_public' => true],
            ['name' => '10 + 1 сотрудник', 'max_employees' => 11, 'price' => 2500, 'is_public' => true],
            ['name' => '20 + 1 сотрудник', 'max_employees' => 21, 'price' => 4500, 'is_public' => true],
            ['name' => '30 + 1 сотрудник', 'max_employees' => 31, 'price' => 6500, 'is_public' => true],
            ['name' => '50 + 1 сотрудник', 'max_employees' => 51, 'price' => 10000, 'is_public' => true],
            // Тариф по умолчанию, для компаний, у которых не был назначен тариф.
            // Нужно будет изменить через суперадминку
            ['name' => '50+ сотрудников', 'max_employees' => null, 'price' => 0, 'is_public' => false], 
        ];

        $defaultTariffId = null;

        foreach ($tariffsData as $data) {
            $tariff = Tariff::firstOrNew(['max_employees' => $data['max_employees'], 'plan' => Tariff::PLAN_PRO]);
            
            $tariff->name = $data['name'];
            if (!$tariff->exists) {
                $tariff->slug = Str::slug($data['name']) . '-' . uniqid();
            }
            $tariff->price = $data['price'];
            $tariff->is_public = $data['is_public'];
            $tariff->is_active = true;
            $tariff->save();

            // Запоминаем id безлимитного тарифа, чтобы назначать его по умолчанию
            if ($data['max_employees'] === null) {
                $defaultTariffId = $tariff->id;
            }
        }

        $companies = Company::all();

        foreach ($companies as $company) {
            // Если у компании вообще нет тарифа, даем базовый
            if (!$company->tariff_id) {
                $company->update(['tariff_id' => $defaultTariffId]);
            }

            // Создаем подписку для всех существующих компаний
            if (!$company->subscription) {
                Subscription::create([
                    'id' => (string) Str::uuid(),
                    'company_id' => $company->id,
                    'tariff_id' => $company->tariff_id,
                    'starts_at' => $company->created_at ?? now(),
                    'ends_at' => null, // По умолчанию бессрочная, потом через суперадминку нужно будет изменить
                ]);
            }
        }
    }
}