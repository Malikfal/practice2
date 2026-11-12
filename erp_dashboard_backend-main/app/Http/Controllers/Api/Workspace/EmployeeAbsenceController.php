<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\CalculateEmployeeAbsenceFixedAmountRequest;
use App\Http\Requests\Workspace\DeleteEmployeeAbsenceRequest;
use App\Http\Requests\Workspace\EmployeeAbsenceIndexRequest;
use App\Http\Requests\Workspace\StoreEmployeeAbsenceRequest;
use App\Http\Requests\Workspace\UpdateEmployeeAbsenceRequest;
use App\Http\Responses\Workspace\EmployeeAbsenceIndexResponse;
use App\Http\Responses\Workspace\EmployeeAbsenceResponse;
use App\Models\EmployeeAbsence;
use App\Models\User;
use App\Services\Workspace\EmployeeAbsenceFixedAmountService;
use App\Services\Workspace\EmployeeAbsenceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

class EmployeeAbsenceController extends Controller
{
    public function __construct(
        private readonly EmployeeAbsenceService $absences,
        private readonly EmployeeAbsenceFixedAmountService $fixedAmounts,
    ) {}

    public function index(EmployeeAbsenceIndexRequest $request, User $employee): JsonResponse
    {
        return new EmployeeAbsenceIndexResponse(
            $this->absences->list($request->user(), $employee, $request->validated()),
        );
    }

    public function calendar(EmployeeAbsenceIndexRequest $request, User $employee): JsonResponse
    {
        return response()->json($this->absences->calendar(
            $request->user(),
            $employee,
            $request->validated(),
        ));
    }

    public function store(StoreEmployeeAbsenceRequest $request, User $employee): JsonResponse
    {
        return new EmployeeAbsenceResponse(
            $this->absences->store($request->user(), $employee, $request->validated()),
            201,
        );
    }

    public function update(UpdateEmployeeAbsenceRequest $request, EmployeeAbsence $absence): JsonResponse
    {
        return new EmployeeAbsenceResponse(
            $this->absences->update($request->user(), $absence, $request->validated()),
        );
    }

    public function destroy(DeleteEmployeeAbsenceRequest $request, EmployeeAbsence $absence): Response
    {
        $this->absences->delete($request->user(), $absence);

        return response()->noContent();
    }

    public function calculateFixedDailyAmount(
        CalculateEmployeeAbsenceFixedAmountRequest $request,
        User $employee,
    ): JsonResponse {
        return response()->json([
            'data' => $this->fixedAmounts->calculate(
                $request->user(),
                $employee,
                $request->validated(),
            ),
        ]);
    }
}
