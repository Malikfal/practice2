<?php

namespace Tests\Unit\Imports;

use App\Models\DataImport;
use App\Services\Imports\Processors\AbstractImportProcessor;
use App\Services\Imports\SpreadsheetReader;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\ValidationException;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;
use Tests\TestCase;

class ImportValueNormalizerTest extends TestCase
{
    public function test_normalizes_rubles_to_kopecks_without_using_sign_as_type(): void
    {
        $processor = $this->processor();

        $this->assertSame(10000, $processor->money('100'));
        $this->assertSame(10050, $processor->money('100,50'));
        $this->assertSame(120000, $processor->money('1 200,00 ₽'));
        $this->assertSame(50000, $processor->money('-500 руб.'));
    }

    public function test_rejects_zero_amount(): void
    {
        $this->expectException(ValidationException::class);

        $this->processor()->money('0');
    }

    public function test_normalizes_excel_date_without_timezone_shift(): void
    {
        $serial = ExcelDate::PHPToExcel(new \DateTimeImmutable('2026-06-22 00:00:00'));

        $this->assertSame('2026-06-22', $this->processor()->spreadsheetDate($serial));
    }

    private function processor(): object
    {
        return new class(app(SpreadsheetReader::class)) extends AbstractImportProcessor
        {
            protected function requiredHeaders(): array
            {
                return [];
            }

            protected function headerAliases(): array
            {
                return [];
            }

            protected function importRow(DataImport $import, array $row): array
            {
                return ['model' => new class extends Model {}, 'normalized' => []];
            }

            public function money(mixed $value): int
            {
                return $this->rublesToKopecks($value, 'amount');
            }

            public function spreadsheetDate(mixed $value): ?string
            {
                return $this->date($value, 'date');
            }
        };
    }
}
