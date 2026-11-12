<?php

namespace Tests\Unit\Admin;

use App\Models\Company;
use App\Models\EmployeeRate;
use App\Models\User;
use App\Repositories\Workspace\EmployeeRepository;
use App\Repositories\Workspace\ProjectAssignmentHistoryRepository;
use App\Services\Admin\EmployeeService;
use App\Services\Payroll\EmployeeArchiveRateService;
use App\Services\Workspace\SkillService;
use Carbon\Carbon;
use Illuminate\Validation\ValidationException;
use Mockery;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class EmployeeServiceTest extends TestCase
{
    public function test_archiving_employee_creates_archive_rate_on_archive_date(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-01 19:30:00', 'UTC'));
        $admin = new User(['id' => 'admin-id', 'status' => 'ACTIVE']);
        $employee = new User(['id' => 'employee-id', 'status' => 'ACTIVE']);
        $employee->setRelation('company', new Company(['timezone' => 'Asia/Yekaterinburg']));
        $updatedEmployee = new User([
            'id' => 'employee-id',
            'status' => 'BLOCKED',
            'archived_at' => '2026-09-02',
        ]);
        $employees = Mockery::mock(EmployeeRepository::class);
        $employees->shouldReceive('update')
            ->once()
            ->with($employee, Mockery::on(static fn (array $attributes): bool => $attributes['status'] === 'BLOCKED'
                && $attributes['archived_at']->isSameDay('2026-09-02')
            ))
            ->andReturn($updatedEmployee);
        $archiveRates = Mockery::mock(EmployeeArchiveRateService::class);
        $archiveRates->shouldReceive('archive')
            ->once()
            ->with($updatedEmployee, $admin)
            ->andReturn(new EmployeeRate);

        $projectAssignments = Mockery::mock(ProjectAssignmentHistoryRepository::class);
        $projectAssignments->shouldReceive('closeAllForUser')
            ->once()
            ->withArgs(static fn (User $user, $date): bool => $user === $updatedEmployee
                && $date->isSameDay('2026-09-02'));

        $this->service($employees, $archiveRates, $projectAssignments)->updateBlockedStatus($admin, $employee, true);
        Carbon::setTestNow();
    }

    public function test_restoring_employee_only_clears_archived_at(): void
    {
        $admin = new User(['id' => 'admin-id', 'status' => 'ACTIVE']);
        $employee = new User([
            'id' => 'employee-id',
            'status' => 'BLOCKED',
            'archived_at' => '2026-09-01',
        ]);
        $company = new Company(['timezone' => 'Europe/Moscow']);
        $company->setRelation('tariff', null);
        $employee->setRelation('company', $company);
        $updatedEmployee = new User(['id' => 'employee-id', 'status' => 'ACTIVE']);
        $employees = Mockery::mock(EmployeeRepository::class);
        $employees->shouldReceive('update')
            ->once()
            ->with($employee, ['status' => 'ACTIVE', 'archived_at' => null])
            ->andReturn($updatedEmployee);
        $archiveRates = Mockery::mock(EmployeeArchiveRateService::class);
        $archiveRates->shouldNotReceive('archive');

        $this->service($employees, $archiveRates)->updateBlockedStatus($admin, $employee, false);
    }

    public function test_employee_cannot_be_archived_twice(): void
    {
        $admin = new User(['id' => 'admin-id', 'status' => 'ACTIVE']);
        $employee = new User(['id' => 'employee-id', 'status' => 'BLOCKED']);
        $employees = Mockery::mock(EmployeeRepository::class);
        $employees->shouldNotReceive('update');
        $archiveRates = Mockery::mock(EmployeeArchiveRateService::class);
        $archiveRates->shouldNotReceive('archive');
        $projectAssignments = Mockery::mock(ProjectAssignmentHistoryRepository::class);
        $projectAssignments->shouldNotReceive('closeAllForUser');

        try {
            $this->service($employees, $archiveRates, $projectAssignments)
                ->updateBlockedStatus($admin, $employee, true);
            $this->fail('Expected validation exception was not thrown.');
        } catch (ValidationException $exception) {
            $this->assertSame(
                ['Сотрудник уже находится в архиве.'],
                $exception->errors()['blocked'],
            );
        }
    }

    public function test_employee_who_created_projects_cannot_be_deleted(): void
    {
        $admin = new User([
            'id' => 'admin-id',
            'status' => 'ACTIVE',
        ]);
        $employee = new User([
            'id' => 'employee-id',
            'status' => 'BLOCKED',
        ]);

        $employees = Mockery::mock(EmployeeRepository::class);
        $employees->shouldReceive('createdProjectNames')
            ->once()
            ->with($employee)
            ->andReturn(['ERP Dashboard', 'Internal Portal']);
        $employees->shouldNotReceive('totalSeconds');
        $employees->shouldNotReceive('delete');

        $service = $this->service($employees, Mockery::mock(EmployeeArchiveRateService::class));

        try {
            $service->delete($admin, $employee);
            $this->fail('Expected validation exception was not thrown.');
        } catch (ValidationException $exception) {
            $this->assertSame([
                'Нельзя удалить сотрудника, так как он является создателем проектов: «ERP Dashboard», «Internal Portal». Сначала измените создателя этих проектов.',
            ], $exception->errors()['employee']);
        }
    }

    public function test_profile_update_without_weekly_plan_key_keeps_the_plan(): void
    {
        $employees = Mockery::mock(EmployeeRepository::class);
        $employees->shouldReceive('update')
            ->once()
            ->with(Mockery::type(User::class), Mockery::on(
                static fn (array $attributes): bool => ! array_key_exists('weekly_plan_seconds', $attributes),
            ))
            ->andReturn($this->updatedEmployee());

        $this->profileService($employees)->updateProfile($this->profileAdmin(), $this->profileEmployee(), $this->profilePayload());
    }

    public function test_profile_update_with_null_weekly_plan_resets_the_plan(): void
    {
        $employees = Mockery::mock(EmployeeRepository::class);
        $employees->shouldReceive('update')
            ->once()
            ->with(Mockery::type(User::class), Mockery::on(
                static fn (array $attributes): bool => array_key_exists('weekly_plan_seconds', $attributes)
                    && $attributes['weekly_plan_seconds'] === null,
            ))
            ->andReturn($this->updatedEmployee());

        $this->profileService($employees)->updateProfile(
            $this->profileAdmin(),
            $this->profileEmployee(),
            $this->profilePayload(['weekly_plan_seconds' => null]),
        );
    }

    private function profileService(EmployeeRepository $employees): EmployeeService
    {
        $skills = Mockery::mock(SkillService::class);
        $skills->shouldReceive('normalizeSkillNamesFromString')->andReturn(collect());
        $skills->shouldReceive('joinSkillNames')->andReturn(null);
        $skills->shouldReceive('syncUserSkills');
        $permissionRegistrar = Mockery::mock(PermissionRegistrar::class);
        $permissionRegistrar->shouldReceive('forgetCachedPermissions');

        return new EmployeeService(
            $employees,
            $permissionRegistrar,
            $skills,
            Mockery::mock(EmployeeArchiveRateService::class),
            Mockery::mock(ProjectAssignmentHistoryRepository::class),
        );
    }

    private function profileAdmin(): User
    {
        return new User(['id' => 'admin-id', 'status' => 'ACTIVE']);
    }

    private function profileEmployee(): User
    {
        $employee = new User(['id' => 'employee-id', 'status' => 'ACTIVE', 'weekly_plan_seconds' => 40 * 3600]);
        $employee->setRelation('company', new Company(['timezone' => 'Europe/Moscow']));

        return $employee;
    }

    private function updatedEmployee(): User
    {
        $updated = Mockery::mock(User::class)->makePartial();
        $updated->shouldReceive('syncSpatieRoleFromLegacyRole')->once();

        return $updated;
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function profilePayload(array $overrides = []): array
    {
        return [
            'first_name' => 'Иван',
            'last_name' => 'Иванов',
            'role' => 'WORKER',
            'position' => null,
            'birthday' => null,
            'phone' => null,
            'socials' => null,
            ...$overrides,
        ];
    }

    private function service(
        EmployeeRepository $employees,
        EmployeeArchiveRateService $archiveRates,
        ?ProjectAssignmentHistoryRepository $projectAssignments = null,
    ): EmployeeService {
        return new EmployeeService(
            $employees,
            Mockery::mock(PermissionRegistrar::class),
            Mockery::mock(SkillService::class),
            $archiveRates,
            $projectAssignments ?? Mockery::mock(ProjectAssignmentHistoryRepository::class),
        );
    }
}
