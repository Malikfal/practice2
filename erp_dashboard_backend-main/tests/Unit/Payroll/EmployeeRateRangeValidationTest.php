<?php

namespace Tests\Unit\Payroll;

use App\Enums\EmployeeRateType;
use App\Enums\PayrollHoursScope;
use App\Enums\PayrollProjectHoursType;
use App\Models\User;
use App\Services\Workspace\EmployeeRateService;
use Illuminate\Validation\ValidationException;
use ReflectionMethod;
use Tests\TestCase;

class EmployeeRateRangeValidationTest extends TestCase
{
    public function test_valid_ranges_cover_all_hours_without_gaps(): void
    {
        $this->assertValidRanges([
            ['from_hours' => 0, 'to_hours' => 300, 'rate' => 2000],
            ['from_hours' => 300, 'to_hours' => 350, 'rate' => 2500],
            ['from_hours' => 350, 'to_hours' => null, 'rate' => 3000],
        ]);

        $this->addToAssertionCount(1);
    }

    public function test_ranges_must_start_from_zero_hours(): void
    {
        $this->assertInvalidRanges('rate_settings.0.ranges.0.from_hours', [
            ['from_hours' => 10, 'to_hours' => null, 'rate' => 2000],
        ]);
    }

    public function test_ranges_must_not_have_gaps(): void
    {
        $this->assertInvalidRanges('rate_settings.0.ranges.1.from_hours', [
            ['from_hours' => 0, 'to_hours' => 300, 'rate' => 2000],
            ['from_hours' => 301, 'to_hours' => null, 'rate' => 2500],
        ]);
    }

    public function test_last_range_must_be_open_ended(): void
    {
        $this->assertInvalidRanges('rate_settings.0.ranges.1.to_hours', [
            ['from_hours' => 0, 'to_hours' => 300, 'rate' => 2000],
            ['from_hours' => 300, 'to_hours' => 350, 'rate' => 2500],
        ]);
    }

    public function test_ranges_are_validated_per_project_hours_type(): void
    {
        $this->assertValidRanges([
            ['project_hours_type' => PayrollProjectHoursType::COMMERCIAL->value, 'from_hours' => 0, 'to_hours' => 100, 'rate' => 2000],
            ['project_hours_type' => PayrollProjectHoursType::INTERNAL->value, 'from_hours' => 0, 'to_hours' => 50, 'rate' => 2000],
            ['project_hours_type' => PayrollProjectHoursType::COMMERCIAL->value, 'from_hours' => 100, 'to_hours' => null, 'rate' => 2500],
            ['project_hours_type' => PayrollProjectHoursType::INTERNAL->value, 'from_hours' => 50, 'to_hours' => null, 'rate' => 2500],
        ]);

        $this->addToAssertionCount(1);
    }

    public function test_hourly_rate_rejects_non_own_hours_scope(): void
    {
        $this->expectException(ValidationException::class);

        $method = new ReflectionMethod(EmployeeRateService::class, 'assertValidRateSettings');
        $method->setAccessible(true);
        $method->invoke(new EmployeeRateService, [
            'rate_settings' => [[
                'rate_type' => EmployeeRateType::HOURLY->value,
                'hours_scope' => PayrollHoursScope::COMPANY->value,
            ]],
        ], $this->employee());
    }

    public function test_salary_rate_accepts_any_available_hours_scope(): void
    {
        $method = new ReflectionMethod(EmployeeRateService::class, 'assertValidRateSettings');
        $method->setAccessible(true);
        $method->invoke(new EmployeeRateService, [
            'rate_settings' => [[
                'rate_type' => EmployeeRateType::WEEKLY_SALARY->value,
                'hours_scope' => PayrollHoursScope::OWN->value,
            ]],
        ], $this->employee());

        $this->addToAssertionCount(1);
    }

    public function test_project_rates_are_not_available_for_salary(): void
    {
        $this->assertInvalidRateSettings('rate_settings.0.project_rates', [[
            'rate_type' => EmployeeRateType::WEEKLY_SALARY->value,
            'project_rates' => [
                ['project_id' => '4d72d717-90c4-453b-89a4-6640309c744c', 'rate' => 100000],
            ],
        ]]);
    }

    public function test_project_rates_must_not_repeat_project(): void
    {
        $this->assertInvalidRateSettings('rate_settings.0.project_rates.1.project_id', [[
            'rate_type' => EmployeeRateType::HOURLY->value,
            'project_rates' => [
                ['project_id' => '4d72d717-90c4-453b-89a4-6640309c744c', 'rate' => 100000],
                ['project_id' => '4d72d717-90c4-453b-89a4-6640309c744c', 'rate' => 120000],
            ],
        ]]);
    }

    /**
     * @param  list<array<string, mixed>>  $settings
     */
    private function assertInvalidRateSettings(string $key, array $settings): void
    {
        $method = new ReflectionMethod(EmployeeRateService::class, 'assertValidRateSettings');
        $method->setAccessible(true);

        try {
            $method->invoke(new EmployeeRateService, ['rate_settings' => $settings], $this->employee());
            $this->fail("Expected validation error for [$key].");
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey($key, $exception->errors());
        }
    }

    private function employee(): User
    {
        return new User(['company_id' => 'company']);
    }

    /**
     * @param  list<array<string, mixed>>  $ranges
     */
    private function assertValidRanges(array $ranges): void
    {
        $method = new ReflectionMethod(EmployeeRateService::class, 'assertValidRanges');
        $method->setAccessible(true);
        $method->invoke(new EmployeeRateService, $ranges, 1000, 'rate_settings.0.ranges');
    }

    /**
     * @param  list<array<string, mixed>>  $ranges
     */
    private function assertInvalidRanges(string $key, array $ranges): void
    {
        try {
            $this->assertValidRanges($ranges);
            $this->fail("Expected validation error for [$key].");
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey($key, $exception->errors());
        }
    }
}
