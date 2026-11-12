<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\EmployeeSalaryTabRequest;
use App\Http\Requests\Workspace\StoreBankDetailRequest;
use App\Http\Responses\Workspace\BankDetailResponse;
use App\Models\User;
use App\Services\Workspace\BankDetailService;
use Illuminate\Http\JsonResponse;

class BankDetailController extends Controller
{
    public function __construct(
        private readonly BankDetailService $bankDetails,
    ) {}

    public function show(EmployeeSalaryTabRequest $request, User $employee): JsonResponse
    {
        return new BankDetailResponse(
            $this->bankDetails->show($request->user(), $employee)
        );
    }

    public function store(StoreBankDetailRequest $request, User $employee): JsonResponse
    {
        $bankDetail = $this->bankDetails->store(
            $request->user(),
            $employee,
            (string) $request->validated('details')
        );

        return new BankDetailResponse($bankDetail, 201);
    }
}
