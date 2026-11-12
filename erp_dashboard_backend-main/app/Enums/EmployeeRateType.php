<?php

namespace App\Enums;

enum EmployeeRateType: string
{
    case WEEKLY_SALARY = 'WEEKLY_SALARY';
    case HOURLY = 'HOURLY';
    case SUPERVISED_HOURLY = 'SUPERVISED_HOURLY';
    case COMPANY_HOURLY = 'COMPANY_HOURLY';

    public function baseColumn(): string
    {
        return match ($this) {
            self::WEEKLY_SALARY => 'salary',
            self::HOURLY => 'hourly_rate',
            self::SUPERVISED_HOURLY => 'supervised_hourly_rate',
            self::COMPANY_HOURLY => 'company_hourly_rate',
        };
    }

    public function isHourly(): bool
    {
        return $this !== self::WEEKLY_SALARY;
    }

    public static function values(): array
    {
        return array_map(
            static fn (self $type): string => $type->value,
            self::cases(),
        );
    }
}
