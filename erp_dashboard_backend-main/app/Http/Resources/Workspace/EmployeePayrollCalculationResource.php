<?php

namespace App\Http\Resources\Workspace;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class EmployeePayrollCalculationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'period_from' => data_get($this->resource, 'period_from'),
            'period_to' => data_get($this->resource, 'period_to'),
            'own_seconds' => (int) data_get($this->resource, 'own_seconds', 0),
            'supervised_seconds' => (int) data_get($this->resource, 'supervised_seconds', 0),
            'total_seconds' => (int) data_get($this->resource, 'total_seconds', 0),
            'amount_kopecks' => (int) data_get($this->resource, 'amount_kopecks', 0),
            'finance_ids' => collect(data_get($this->resource, 'finance_ids', []))
                ->map(static fn (mixed $id): string => (string) $id)
                ->values()
                ->all(),
            'details' => collect(data_get($this->resource, 'details', []))->map(static fn (mixed $detail): array => [
                'project_id' => data_get($detail, 'project_id') !== null ? (string) data_get($detail, 'project_id') : null,
                'project_name' => data_get($detail, 'project_name'),
                'own_seconds' => (int) data_get($detail, 'own_seconds', 0),
                'duration_seconds' => (int) data_get($detail, 'duration_seconds', 0),
                'supervised_seconds' => (int) data_get($detail, 'supervised_seconds', 0),
                'amount_kopecks' => (int) data_get($detail, 'amount_kopecks', 0),
                'finance_ids' => collect(data_get($detail, 'finance_ids', []))
                    ->map(static fn (mixed $id): string => (string) $id)
                    ->values()
                    ->all(),
            ])->values()->all(),
            'formulas' => collect(data_get($this->resource, 'formulas', []))
                ->map(fn (mixed $formula): array => $this->formula($formula))
                ->values()
                ->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function formula(mixed $formula): array
    {
        return [
            'rate_id' => data_get($formula, 'rate_id') !== null ? (string) data_get($formula, 'rate_id') : null,
            'rate_effective_from' => data_get($formula, 'rate_effective_from'),
            'rate_type' => data_get($formula, 'rate_type'),
            'base_rate_kopecks' => data_get($formula, 'base_rate_kopecks') !== null
                ? (int) data_get($formula, 'base_rate_kopecks')
                : null,
            'is_advanced' => (bool) data_get($formula, 'is_advanced', false),
            'default_rate_kopecks' => data_get($formula, 'default_rate_kopecks') !== null
                ? (int) data_get($formula, 'default_rate_kopecks')
                : null,
            'split_by_project_type' => (bool) data_get($formula, 'split_by_project_type', false),
            'hours_scope' => data_get($formula, 'hours_scope'),
            'range_calculation_method' => data_get($formula, 'range_calculation_method'),
            'calculation_hours_seconds' => (int) data_get($formula, 'calculation_hours_seconds', 0),
            'project_hours_seconds' => [
                'ALL' => (int) data_get($formula, 'project_hours_seconds.ALL', 0),
                'COMMERCIAL' => (int) data_get($formula, 'project_hours_seconds.COMMERCIAL', 0),
                'INTERNAL' => (int) data_get($formula, 'project_hours_seconds.INTERNAL', 0),
            ],
            'reached_range' => data_get($formula, 'reached_range') !== null
                ? $this->formulaRange(data_get($formula, 'reached_range'))
                : null,
            'reached_ranges' => collect(data_get($formula, 'reached_ranges', []))
                ->map(fn (mixed $range): array => $this->formulaRange($range))
                ->values()
                ->all(),
            'ranges' => collect(data_get($formula, 'ranges', []))
                ->map(fn (mixed $range): array => $this->formulaRange($range))
                ->values()
                ->all(),
            'project_rates' => collect(data_get($formula, 'project_rates', []))
                ->map(static fn (mixed $projectRate): array => [
                    'project_id' => (string) data_get($projectRate, 'project_id'),
                    'project_name' => (string) data_get($projectRate, 'project_name', ''),
                    'rate_kopecks' => (int) data_get($projectRate, 'rate_kopecks', 0),
                    'hours_seconds' => (int) data_get($projectRate, 'hours_seconds', 0),
                    'amount_kopecks' => (int) data_get($projectRate, 'amount_kopecks', 0),
                ])
                ->values()
                ->all(),
            'regular_lines' => collect(data_get($formula, 'regular_lines', []))
                ->map(static fn (mixed $line): array => [
                    'project_hours_type' => data_get($line, 'project_hours_type'),
                    'from_hours' => data_get($line, 'from_hours') !== null ? (float) data_get($line, 'from_hours') : null,
                    'to_hours' => data_get($line, 'to_hours') !== null ? (float) data_get($line, 'to_hours') : null,
                    'rate_kopecks' => (int) data_get($line, 'rate_kopecks', 0),
                    'hours_seconds' => (int) data_get($line, 'hours_seconds', 0),
                    'amount_kopecks' => (int) data_get($line, 'amount_kopecks', 0),
                ])
                ->values()
                ->all(),
            'regular_from' => data_get($formula, 'regular_from'),
            'regular_to' => data_get($formula, 'regular_to'),
            'previous_part' => data_get($formula, 'previous_part') !== null ? [
                'from' => data_get($formula, 'previous_part.from'),
                'to' => data_get($formula, 'previous_part.to'),
                'amount_kopecks' => (int) data_get($formula, 'previous_part.amount_kopecks', 0),
            ] : null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function formulaRange(mixed $range): array
    {
        return [
            'project_hours_type' => data_get($range, 'project_hours_type'),
            'from_hours' => (float) data_get($range, 'from_hours', 0),
            'to_hours' => data_get($range, 'to_hours') !== null ? (float) data_get($range, 'to_hours') : null,
            'rate_kopecks' => (int) data_get($range, 'rate_kopecks', 0),
            'position' => (int) data_get($range, 'position', 0),
            'calculation_hours_seconds' => (int) data_get($range, 'calculation_hours_seconds', 0),
            'is_reached' => (bool) data_get($range, 'is_reached', false),
        ];
    }
}
