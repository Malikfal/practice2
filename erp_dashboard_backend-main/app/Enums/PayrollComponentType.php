<?php

namespace App\Enums;

enum PayrollComponentType: string
{
    case WEEKLY_SALARY = 'WEEKLY_SALARY';
    case HOURLY = 'HOURLY';
    case SUPERVISED_HOURLY = 'SUPERVISED_HOURLY';
    case COMPANY_HOURLY = 'COMPANY_HOURLY';
    case FIXED_ABSENCE = 'FIXED_ABSENCE';

    /**
     * Преобразует тип ставки в тип расчетного компонента.
     */
    public static function fromRateType(EmployeeRateType $type): self
    {
        return self::from($type->value);
    }
}
