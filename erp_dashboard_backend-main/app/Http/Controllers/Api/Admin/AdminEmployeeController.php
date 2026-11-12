<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\BlockEmployeeRequest;
use App\Http\Requests\Admin\ChangeEmployeePasswordRequest;
use App\Http\Requests\Admin\DeleteEmployeeRequest;
use App\Http\Requests\Admin\StoreEmployeeRequest;
use App\Http\Requests\Admin\SyncEmployeePermissionsRequest;
use App\Http\Requests\Admin\UpdateEmployeeProfileRequest;
use App\Http\Requests\Admin\UpdateEmployeeRoleRequest;
use App\Http\Responses\Common\MessageResponse;
use App\Http\Responses\Workspace\EmployeeResponse;

use App\Models\User;
use App\Models\Company;
use App\Services\Admin\EmployeeService;
use Illuminate\Http\JsonResponse;

class AdminEmployeeController extends Controller
{
    public function __construct(
        private readonly EmployeeService $employees,
    ) {}

    public function store(StoreEmployeeRequest $request): JsonResponse
    {
        // Добавил проверки на случай, если кто то попытается добавить сотрудника с превышеным лимитом по тарифу
        $companyId = $request->user()->company_id;
        $company = Company::with('tariff')->find($companyId);

        if (!$company) {
            return response()->json(['message' => 'Компания не найдена'], 404);
        }

        $maxEmployees = $company->tariff?->max_employees;
        $totalActiveEmployees = $company->employees()->where('status', 'ACTIVE')->count();

        if ($maxEmployees !== null && $totalActiveEmployees >= $maxEmployees) {
            return response()->json([
                'message' => 'Превышен лимит сотрудников для вашего тарифного плана'
            ], 403);
        }        

        return new EmployeeResponse(
            $this->employees->create($request->user(), $request->validated()),
            201,
        );
    }

    public function block(BlockEmployeeRequest $request, User $employee): JsonResponse
    {
        return new EmployeeResponse(
            $this->employees->updateBlockedStatus(
                $request->user(),
                $employee,
                (bool) $request->validated('blocked'),
            )
        );
    }

    public function updateRole(UpdateEmployeeRoleRequest $request, User $employee): JsonResponse
    {
        return new EmployeeResponse(
            $this->employees->updateRole(
                $request->user(),
                $employee,
                (string) $request->validated('role'),
                $request->filled('role_id') ? (int) $request->validated('role_id') : null,
            )
        );
    }

    public function updateProfile(UpdateEmployeeProfileRequest $request, User $employee): JsonResponse
    {
        return new EmployeeResponse(
            $this->employees->updateProfile(
                $request->user(),
                $employee,
                $request->validated(),
            )
        );
    }

    public function changePassword(
        ChangeEmployeePasswordRequest $request,
        User $employee,
    ): JsonResponse {
        $this->employees->changePassword(
            $request->user(),
            $employee,
            (string) $request->validated('password'),
        );

        return new MessageResponse('Пароль сотрудника успешно обновлен.');
    }

    public function syncPermissions(
        SyncEmployeePermissionsRequest $request,
        User $employee,
    ): JsonResponse {
        return new EmployeeResponse(
            $this->employees->syncPermissions(
                $request->user(),
                $employee,
                (array) $request->validated('permissions', []),
                (array) $request->validated('denied_permissions', []),
            )
        );
    }

    public function destroy(DeleteEmployeeRequest $request, User $employee): JsonResponse
    {
        $this->employees->delete($request->user(), $employee);

        return new MessageResponse('Сотрудник удален.');
    }
}
