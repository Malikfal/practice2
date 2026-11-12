<?php

namespace Database\Seeders;

use App\Models\Tariff;
use App\Models\Company;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class TariffSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        Tariff::updateOrCreate(
          ['slug' => 'five_employees'],
          [
            'name'=>'Пять сотрудников',
            'max_employees'=>6,
            'is_active'=>true,
          ]  
        );

        Tariff::updateOrCreate(
          ['slug' => 'ten_employees'],
          [
            'name'=>'Десять сотрудников',
            'max_employees'=>11,
            'is_active'=>true,
          ]  
        );

        Tariff::updateOrCreate(
          ['slug' => 'twenty_employees'],
          [
            'name'=>'Двадцать сотрудников',
            'max_employees'=>21,
            'is_active'=>true,
          ]  
        );
        Tariff::updateOrCreate(
          ['slug' => 'thirty_employees'],
          [
            'name'=>'Тридцать сотрудников',
            'max_employees'=>31,
            'is_active'=>true,
          ]  
        );

        Tariff::updateOrCreate(
          ['slug' => 'fifty_employees'],
          [
            'name'=>'Пятьдесят сотрудников',
            'max_employees'=>51,
            'is_active'=>true,
          ]  
        );

        $unlimitedTatiff = Tariff::updateOrCreate(
          ['slug' => 'inf_employees'],
          [
            'name'=>'Неограничено сотрудников',
            'max_employees'=>null,
            'is_active'=>true,
          ]  
        );

        if (Company::whereNull('tariff_id')->exists()) {
          Company::whereNull('tariff_id')->update([
            'tariff_id' => $unlimitedTatiff->id,
          ]);
        }
    }
}
