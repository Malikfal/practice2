<?php

namespace App\Http\Resources\Workspace;

use App\Models\EmployeeAbsence;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin EmployeeAbsence
 */
final class EmployeeAbsenceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $calculatedDailyAmount = $this->calculatedFixedDailyAmount();

        return [
            'id' => (string) $this->id,
            'company_id' => (string) $this->company_id,
            'employee_id' => (string) $this->employee_id,
            'type' => $this->type?->value,
            'date_from' => $this->date_from?->toDateString(),
            'date_to' => $this->date_to?->toDateString(),
            'payment_mode' => $this->payment_mode?->value,
            'fixed_daily_amount' => $this->fixed_daily_amount,
            'coefficient' => (float) ($this->coefficient ?? 1),
            'amount_kopecks' => $calculatedDailyAmount !== null
                ? $calculatedDailyAmount * $this->periodDaysCount()
                : null,
            'comment' => $this->comment,
            'created_by' => $this->userData($this->whenLoaded('creator')),
            'updated_by' => $this->userData($this->whenLoaded('updater')),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }

    private function userData(mixed $user): ?array
    {
        if (! $user instanceof User) {
            return null;
        }

        return [
            'id' => (string) $user->id,
            'name' => $user->name,
            'last_name' => $user->last_name,
            'email' => $user->email,
        ];
    }

    private function periodDaysCount(): int
    {
        if (! $this->date_from || ! $this->date_to) {
            return 0;
        }

        return (int) $this->date_from->diffInDays($this->date_to) + 1;
    }
}
