<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\PayrollRecalculationRequest;
use App\Http\Resources\Workspace\PayrollRecalculationResource;
use App\Services\Workspace\PayrollRecalculationService;
use Illuminate\Http\JsonResponse;

class PayrollRecalculationController extends Controller
{
    public function __construct(private readonly PayrollRecalculationService $recalculations) {}

    /**
     * Ставит перерасчет компании за период в очередь.
     */
    public function store(PayrollRecalculationRequest $request): JsonResponse
    {
        $recalculation = $this->recalculations->dispatch(
            actor: $request->user(),
            periodFrom: (string) $request->validated('period_from'),
            periodTo: (string) $request->validated('period_to'),
        );

        return PayrollRecalculationResource::make($recalculation)
            ->response()
            ->setStatusCode(202);
    }

    /**
     * Возвращает состояние перерасчета компании за период.
     */
    public function show(PayrollRecalculationRequest $request): JsonResponse
    {
        $recalculation = $this->recalculations->show(
            actor: $request->user(),
            periodFrom: (string) $request->validated('period_from'),
            periodTo: (string) $request->validated('period_to'),
        );

        return $recalculation
            ? PayrollRecalculationResource::make($recalculation)->response()
            : response()->json(['data' => null]);
    }
}
