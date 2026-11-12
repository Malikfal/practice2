<?php

namespace Tests\Unit\Imports;

use App\Enums\FinanceType;
use App\Enums\ProjectStatus;
use App\Services\Imports\Processors\EmployeeImportProcessor;
use App\Services\Imports\Processors\FinanceImportProcessor;
use App\Services\Imports\Processors\ProjectImportProcessor;
use Illuminate\Validation\ValidationException;
use ReflectionClass;
use Tests\TestCase;

class ImportProcessorNormalizationTest extends TestCase
{
    public function test_finance_type_supports_frontend_aliases(): void
    {
        $processor = $this->withoutConstructor(FinanceImportProcessor::class);

        foreach (['Поступление', 'приход', 'entrance', 'income'] as $value) {
            $this->assertSame(FinanceType::ENTRANCE, $this->invoke($processor, 'financeType', [$value]));
        }
        foreach (['Расход', 'expenditure', 'expense'] as $value) {
            $this->assertSame(FinanceType::EXPENDITURE, $this->invoke($processor, 'financeType', [$value]));
        }
    }

    public function test_unknown_finance_type_is_rejected(): void
    {
        $this->expectException(ValidationException::class);

        $this->invoke($this->withoutConstructor(FinanceImportProcessor::class), 'financeType', ['перевод']);
    }

    public function test_employee_phone_matches_frontend_normalization(): void
    {
        $processor = $this->withoutConstructor(EmployeeImportProcessor::class);

        $this->assertSame('+79991112233', $this->invoke($processor, 'phone', ['8 (999) 111-22-33']));
        $this->assertSame('+79991112233', $this->invoke($processor, 'phone', ['9991112233']));
        $this->assertNull($this->invoke($processor, 'phone', ['—']));
    }

    public function test_project_status_defaults_to_active_for_unknown_status(): void
    {
        $processor = $this->withoutConstructor(ProjectImportProcessor::class);
        $warnings = [];
        $arguments = ['неизвестный', &$warnings];

        $this->assertSame(ProjectStatus::ACTIVE, $this->invoke($processor, 'status', $arguments));
        $this->assertNotEmpty($warnings);

    }

    private function withoutConstructor(string $class): object
    {
        return (new ReflectionClass($class))->newInstanceWithoutConstructor();
    }

    private function invoke(object $object, string $method, array $arguments): mixed
    {
        $reflection = new ReflectionClass($object);

        return $reflection->getMethod($method)->invokeArgs($object, $arguments);
    }
}
