<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\EmployeeSalaryTabRequest;
use App\Http\Requests\Workspace\UpdateEmployeePayrollSettingsRequest;
use App\Http\Resources\Workspace\EmployeePayrollSettingsResource;
use App\Models\User;
use App\Services\Workspace\EmployeePayrollSettingsService;
use Illuminate\Http\JsonResponse;

class EmployeePayrollSettingsController extends Controller
{
    /**
     * Подключает сервис индивидуальных payroll-настроек сотрудника.
     */
    public function __construct(
        private readonly EmployeePayrollSettingsService $settings,
    ) {}

    /**
     * Возвращает индивидуальные настройки оплаты труда сотрудника.
     */
    public function show(EmployeeSalaryTabRequest $request, User $employee): JsonResponse
    {
        return EmployeePayrollSettingsResource::make(
            $this->settings->show($request->user(), $employee),
        )->response();
    }

    /**
     * Обновляет индивидуальные настройки оплаты труда сотрудника.
     */
    public function update(UpdateEmployeePayrollSettingsRequest $request, User $employee): JsonResponse
    {
        return EmployeePayrollSettingsResource::make(
            $this->settings->update($request->user(), $employee, $request->validated()),
        )->response();
    }
}
