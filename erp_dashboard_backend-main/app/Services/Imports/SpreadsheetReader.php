<?php

namespace App\Services\Imports;

use App\Models\DataImport;
use Illuminate\Support\Facades\Storage;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Reader\Csv;
use PhpOffice\PhpSpreadsheet\Reader\IReader;
use RuntimeException;

class SpreadsheetReader
{
    /** @return array<int, array<int, mixed>> */
    public function read(DataImport $import): array
    {
        $path = Storage::disk($import->disk)->path($import->path);
        $reader = $this->reader($path, $import->extension);
        $reader->setReadDataOnly(true);

        $spreadsheet = $reader->load($path);

        try {
            return $spreadsheet->getActiveSheet()->toArray(null, false, true, false);
        } finally {
            $spreadsheet->disconnectWorksheets();
        }
    }

    private function reader(string $path, string $extension): IReader
    {
        if ($extension === 'csv') {
            $reader = new Csv;
            $reader->setInputEncoding($this->detectEncoding($path));
            $reader->setDelimiter($this->detectDelimiter($path));
            $reader->setEnclosure('"');

            return $reader;
        }

        if (! in_array($extension, ['xls', 'xlsx'], true)) {
            throw new RuntimeException('Неподдерживаемый формат файла.');
        }

        return IOFactory::createReaderForFile($path);
    }

    private function detectDelimiter(string $path): string
    {
        $handle = fopen($path, 'rb');
        $line = '';
        if ($handle) {
            while (($candidate = fgets($handle)) !== false) {
                if (trim($candidate) !== '') {
                    $line = $candidate;
                    break;
                }
            }
        }
        if (is_resource($handle)) {
            fclose($handle);
        }

        $counts = [];
        foreach ([';', ',', "\t"] as $delimiter) {
            $counts[$delimiter] = count(str_getcsv($line, $delimiter, '"'));
        }
        arsort($counts, SORT_NUMERIC);

        return (string) array_key_first($counts);
    }

    private function detectEncoding(string $path): string
    {
        $sample = (string) file_get_contents($path, false, null, 0, 65536);

        return mb_check_encoding($sample, 'UTF-8') ? 'UTF-8' : 'CP1251';
    }
}
