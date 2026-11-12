<?php

namespace App\Http\Responses\Workspace;

use App\Models\User;
use Illuminate\Http\JsonResponse;

final class CompanyPayrollSummaryResponse extends JsonResponse
{
    /**
     * @param  array<string, mixed>  $summary
     */
    public function __construct(array $summary)
    {
        $summary['employees'] = $summary['employees']
            ->map(static function (array $row): array {
                /** @var User $employee */
                $employee = $row['employee'];
                unset($row['employee']);

                return [
                    'id' => (string) $employee->id,
                    'name' => $employee->name,
                    'first_name' => $employee->first_name,
                    'last_name' => $employee->last_name,
                    'is_archived' => $employee->archived_at !== null,
                    ...$row,
                ];
            })
            ->all();
        $summary['groups'] = $summary['groups']->all();
        $summary['periods'] = $summary['periods']->all();

        parent::__construct($summary);
    }
}
