<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Enums\PayrollPayoutKind;
use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\PayrollPayoutClosingRequest;
use App\Http\Requests\Workspace\PayrollPayoutManageRequest;
use App\Http\Requests\Workspace\PayrollPayoutReportRequest;
use App\Http\Requests\Workspace\PayrollPayoutViewRequest;
use App\Http\Requests\Workspace\StorePayrollPayoutRequest;
use App\Http\Requests\Workspace\UpdatePayrollPayoutOpeningRequest;
use App\Http\Requests\Workspace\UpdatePayrollPayoutPlanRequest;
use App\Http\Requests\Workspace\UpdatePayrollPayoutSettingsRequest;
use App\Models\Company;
use App\Models\PayrollPayout;
use App\Services\Workspace\PayrollPayoutService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class PayrollPayoutController extends Controller
{
    public function __construct(
        private readonly PayrollPayoutService $payouts,
    ) {}

    public function settings(PayrollPayoutViewRequest $request): JsonResponse
    {
        return response()->json($this->payouts->settings($this->company($request)));
    }

    public function updateSettings(UpdatePayrollPayoutSettingsRequest $request): JsonResponse
    {
        return response()->json(
            $this->payouts->updateSettings($this->company($request), $request->validated('start_month')),
        );
    }

    public function sheet(PayrollPayoutViewRequest $request): JsonResponse
    {
        return response()->json(
            $this->payouts->sheet($this->company($request), $request->validated('month')),
        );
    }

    public function debts(PayrollPayoutViewRequest $request): JsonResponse
    {
        return response()->json($this->payouts->debts($this->company($request)));
    }

    public function report(PayrollPayoutReportRequest $request): JsonResponse
    {
        $data = $request->validated();

        return response()->json($this->payouts->report(
            $this->company($request),
            $data['from'] ?? null,
            $data['to'] ?? null,
            $data['employee_id'] ?? null,
            $data['article_id'] ?? null,
        ));
    }

    public function store(StorePayrollPayoutRequest $request): JsonResponse
    {
        return response()->json([
            'data' => $this->payouts->createPayouts($this->company($request), $request->user(), $request->validated()),
        ], 201);
    }

    public function destroy(PayrollPayoutManageRequest $request, PayrollPayout $payout): Response
    {
        $this->payouts->deletePayout($this->company($request), $request->user(), $payout);

        return response()->noContent();
    }

    public function updatePlan(UpdatePayrollPayoutPlanRequest $request): Response
    {
        $data = $request->validated();
        $this->payouts->updatePlan(
            $this->company($request),
            $data['employee_id'],
            $data['month'],
            PayrollPayoutKind::from($data['kind']),
            $data['amount'] === null ? null : (int) $data['amount'],
        );

        return response()->noContent();
    }

    public function close(PayrollPayoutClosingRequest $request): Response
    {
        $this->payouts->closeMonth($this->company($request), $request->user(), $request->validated('month'));

        return response()->noContent();
    }

    public function reopen(PayrollPayoutClosingRequest $request): Response
    {
        $this->payouts->reopenMonth($this->company($request), $request->validated('month'));

        return response()->noContent();
    }

    public function updateOpening(UpdatePayrollPayoutOpeningRequest $request): Response
    {
        $data = $request->validated();
        $this->payouts->updateOpening($this->company($request), $data['employee_id'], (int) $data['amount']);

        return response()->noContent();
    }

    private function company(Request $request): Company
    {
        return Company::query()->findOrFail($this->companyId($request));
    }
}
