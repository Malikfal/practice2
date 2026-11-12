<?php

namespace App\Services\Imports;

use App\Enums\DataImportType;
use App\Services\Imports\Processors\AbstractImportProcessor;
use App\Services\Imports\Processors\EmployeeImportProcessor;
use App\Services\Imports\Processors\EmployeePayrollImportProcessor;
use App\Services\Imports\Processors\FinanceImportProcessor;
use App\Services\Imports\Processors\ProjectImportProcessor;

class ImportProcessorFactory
{
    public function __construct(
        private readonly FinanceImportProcessor $finances,
        private readonly ProjectImportProcessor $projects,
        private readonly EmployeeImportProcessor $employees,
        private readonly EmployeePayrollImportProcessor $employeePayroll,
    ) {}

    public function make(DataImportType $type): AbstractImportProcessor
    {
        return match ($type) {
            DataImportType::FINANCES => $this->finances,
            DataImportType::PROJECTS => $this->projects,
            DataImportType::EMPLOYEES => $this->employees,
            DataImportType::EMPLOYEE_PAYROLL => $this->employeePayroll,
        };
    }
}
