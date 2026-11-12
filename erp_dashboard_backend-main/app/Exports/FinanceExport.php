<?php

namespace App\Exports;

use App\Enums\FinanceType;
use App\Models\Finance;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithCustomCsvSettings;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class FinanceExport implements FromCollection, WithCustomCsvSettings, WithHeadings, WithMapping
{
    public function __construct(
        private readonly Collection $finances,
    ) {}

    public function collection(): Collection
    {
        return $this->finances;
    }

    public function headings(): array
    {
        return [
            'Дата',
            'Тип',
            'Статья',
            'Сумма',
            'Проект',
            'Клиент',
            'Участник',
            'Комментарий',
        ];
    }

    /** @param Finance $finance */
    public function map($finance): array
    {
        $type = $finance->type instanceof FinanceType
            ? $finance->type
            : FinanceType::tryFrom((string) $finance->type);

        return [
            $finance->dateOfPayment?->format('d.m.Y') ?? '',
            $type?->label() ?? (string) $finance->type,
            $finance->article?->name ?? '',
            number_format((int) $finance->amount / 100, 2, '.', ''),
            $finance->project?->name ?? '',
            $finance->project?->client?->name ?? '',
            $finance->employee?->email ?? '',
            $finance->comment ?? '',
        ];
    }

    public function getCsvSettings(): array
    {
        return [
            'delimiter' => ';',
            'use_bom' => true,
        ];
    }
}
