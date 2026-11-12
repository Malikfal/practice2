<?php

namespace Tests\Unit\Imports;

use App\Models\DataImport;
use App\Services\Imports\SpreadsheetReader;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class SpreadsheetReaderTest extends TestCase
{
    public function test_reads_utf8_bom_semicolon_csv_with_quoted_delimiter(): void
    {
        Storage::fake('local');
        Storage::disk('local')->put(
            'imports/finance.csv',
            "\xEF\xBB\xBFДата;Тип;Комментарий\r\n22.06.2026;Поступление;\"Оплата; этап 1\"",
        );

        $rows = app(SpreadsheetReader::class)->read($this->import('imports/finance.csv'));

        $this->assertSame('Дата', $rows[0][0]);
        $this->assertSame('Оплата; этап 1', $rows[1][2]);
    }

    public function test_reads_windows_1251_comma_csv_with_quoted_comma(): void
    {
        Storage::fake('local');
        $utf8 = "Дата,Тип,Комментарий\n22.06.2026,Расход,\"Оплата, этап 2\"";
        Storage::disk('local')->put('imports/finance.csv', iconv('UTF-8', 'Windows-1251', $utf8));

        $rows = app(SpreadsheetReader::class)->read($this->import('imports/finance.csv'));

        $this->assertSame('Расход', $rows[1][1]);
        $this->assertSame('Оплата, этап 2', $rows[1][2]);
    }

    private function import(string $path): DataImport
    {
        return new DataImport(['disk' => 'local', 'path' => $path, 'extension' => 'csv']);
    }
}
