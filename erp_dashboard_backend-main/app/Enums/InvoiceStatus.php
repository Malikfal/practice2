<?php

namespace App\Enums;

enum InvoiceStatus: string
{
    case AWAITING_PAYMENT = 'AWAITING_PAYMENT';
    case PAID = 'PAID';
    case CANCELLED = 'CANCELLED';

    public function label(): string
    {
        return match ($this) {
            self::AWAITING_PAYMENT => 'Ожидает оплаты',
            self::PAID => 'Оплачен',
            self::CANCELLED => 'Отменен',
        };
    }
}