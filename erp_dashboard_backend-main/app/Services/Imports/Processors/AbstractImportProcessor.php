<?php

namespace App\Services\Imports\Processors;

use App\Enums\DataImportRowStatus;
use App\Enums\DataImportStatus;
use App\Models\DataImport;
use App\Models\DataImportLog;
use App\Models\DataImportRow;
use App\Services\Imports\SpreadsheetReader;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;
use RuntimeException;
use Throwable;

abstract class AbstractImportProcessor
{
    public function __construct(protected readonly SpreadsheetReader $reader) {}

    /** @return array<int, string> */
    abstract protected function requiredHeaders(): array;

    /** @return array<string, array<int, string>> */
    abstract protected function headerAliases(): array;

    /** @return array{model: Model, normalized: array, warnings?: array} */
    abstract protected function importRow(DataImport $import, array $row): array;

    public function process(DataImport $import): void
    {
        $rows = $this->reader->read($import);
        if ($rows === []) {
            throw new RuntimeException('Файл импорта пуст.');
        }

        $headerIndex = $this->firstNonBlankRowIndex($rows);
        if ($headerIndex === null) {
            throw new RuntimeException('Файл импорта пуст.');
        }

        $headerMap = $this->headerMap($rows[$headerIndex]);
        $this->assertHeaders($headerMap);
        $rows = array_filter(
            array_slice($rows, $headerIndex + 1, null, true),
            fn (array $row): bool => ! $this->isBlankRow($row),
        );

        $import->update([
            'status' => DataImportStatus::IMPORTING,
            'total_rows' => count($rows),
            'processed_rows' => 0,
            'successful_rows' => 0,
            'failed_rows' => 0,
            'skipped_rows' => 0,
        ]);
        $this->log($import, 'INFO', 'Файл прочитан, начат импорт.', ['rows' => count($rows)]);

        $processed = 0;
        foreach ($rows as $sourceIndex => $values) {
            $import->refresh();
            if ($import->status === DataImportStatus::CANCELLED) {
                $this->log($import, 'WARNING', 'Импорт отменен пользователем.');
                $this->refreshCounters($import, $processed);

                return;
            }

            $rowNumber = $sourceIndex + 1;
            $existing = $import->rows()->where('row_number', $rowNumber)->first();
            if (in_array($existing?->status, [DataImportRowStatus::CREATED, DataImportRowStatus::SKIPPED], true)) {
                $processed++;
                $this->updateProgress($import, $processed, count($rows));

                continue;
            }

            $row = $this->associate($headerMap, $values);
            $raw = $this->sanitizeRawData($row);

            try {
                $this->assertNoFormula($row);
                $result = DB::transaction(fn (): array => $this->importRow($import, $row));
                $model = $result['model'];

                DataImportRow::query()->updateOrCreate(
                    ['data_import_id' => $import->id, 'row_number' => $rowNumber],
                    [
                        'status' => DataImportRowStatus::CREATED,
                        'raw_data' => $raw,
                        'normalized_data' => $result['normalized'],
                        'errors' => null,
                        'warnings' => $result['warnings'] ?? null,
                        'entity_type' => $model->getMorphClass(),
                        'entity_id' => (string) $model->getKey(),
                    ],
                );
            } catch (ValidationException $exception) {
                $this->storeFailure($import, $rowNumber, $raw, $exception->errors());
                $this->afterRowFailure($import);
            } catch (Throwable $exception) {
                report($exception);
                $this->storeFailure($import, $rowNumber, $raw, ['row' => ['Не удалось сохранить строку: '.$exception->getMessage()]]);
                $this->afterRowFailure($import);
            }

            $processed++;
            $this->updateProgress($import, $processed, count($rows));
        }

        $this->refreshCounters($import, $processed);
    }

    protected function text(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $value = trim(preg_replace('/\s+/u', ' ', (string) $value) ?? '');

        return in_array($value, ['', '-', '—'], true) ? null : $value;
    }

    protected function date(mixed $value, string $field): ?string
    {
        if ($this->text($value) === null) {
            return null;
        }

        if (is_numeric($value) && (float) $value > 1000) {
            return CarbonImmutable::instance(ExcelDate::excelToDateTimeObject((float) $value))->toDateString();
        }

        $text = trim((string) $value);
        foreach (['d.m.Y', 'Y-m-d', 'd/m/Y'] as $format) {
            try {
                $date = CarbonImmutable::createFromFormat('!'.$format, $text);
                if ($date !== false) {
                    return $date->toDateString();
                }
            } catch (Throwable) {
            }
        }

        throw ValidationException::withMessages([$field => ["Некорректная дата: {$text}"]]);
    }

    /**
     * Convert a user-facing ruble amount from a spreadsheet to integer kopecks.
     *
     * Examples: "100" => 10000, "100,50 ₽" => 10050, "1 234.56" => 123456.
     */
    protected function rublesToKopecks(mixed $value, string $field, bool $nullable = false): ?int
    {
        $text = $this->text($value);
        if ($text === null && $nullable) {
            return null;
        }

        if ($text === null) {
            throw ValidationException::withMessages([$field => ['Некорректная или отсутствует сумма.']]);
        }

        $normalized = preg_replace('/руб(?:\.|лей|ля)?/iu', '', $text) ?? '';
        $normalized = preg_replace('/[\s\x{00A0}\x{202F}₽]/u', '', $normalized) ?? '';
        $normalized = preg_replace('/^[+\-−–—]+/u', '', $normalized) ?? '';

        if (! preg_match('/^(\d+)(?:[,.](\d{1,2}))?$/', $normalized, $matches)) {
            throw ValidationException::withMessages([$field => ['Некорректная или отсутствует сумма.']]);
        }

        $rubles = (int) $matches[1];
        $kopecks = isset($matches[2])
            ? (int) str_pad($matches[2], 2, '0')
            : 0;

        if ($rubles > intdiv(PHP_INT_MAX - $kopecks, 100)) {
            throw ValidationException::withMessages([$field => ['Сумма слишком велика.']]);
        }

        $amount = $rubles * 100 + $kopecks;
        if ($amount <= 0) {
            throw ValidationException::withMessages([$field => ['Некорректная или отсутствует сумма.']]);
        }

        return $amount;
    }

    protected function assertNoFormula(array $row): void
    {
        foreach ($row as $header => $value) {
            if (is_string($value) && str_starts_with(ltrim($value), '=')) {
                throw ValidationException::withMessages([$header => ['Формулы в импортируемых данных запрещены.']]);
            }
        }
    }

    protected function sanitizeRawData(array $row): array
    {
        return $row;
    }

    protected function afterRowFailure(DataImport $import): void {}

    private function headerMap(array $headers): array
    {
        $map = [];
        $aliases = $this->normalizedAliases();
        foreach ($headers as $index => $header) {
            $normalized = $this->normalizeHeader($header);
            if ($normalized === '') {
                continue;
            }

            foreach ($aliases as $canonical => $variants) {
                if (in_array($normalized, $variants, true)) {
                    $map[$index] = $canonical;

                    continue 2;
                }
            }

            $matches = [];
            foreach ($aliases as $canonical => $variants) {
                foreach ($variants as $variant) {
                    if (mb_strlen($variant) >= 4 && str_contains($normalized, $variant)) {
                        $matches[$canonical] = max($matches[$canonical] ?? 0, mb_strlen($variant));
                    }
                }
            }
            if ($matches !== []) {
                arsort($matches, SORT_NUMERIC);
                $map[$index] = (string) array_key_first($matches);
            }
        }

        return $map;
    }

    private function assertHeaders(array $headerMap): void
    {
        $actual = array_values($headerMap);
        $missing = array_values(array_diff($this->requiredHeaders(), $actual));
        if ($missing !== []) {
            throw ValidationException::withMessages(['headers' => ['В файле отсутствуют колонки: '.implode(', ', $missing)]]);
        }
    }

    private function normalizeHeader(mixed $header): string
    {
        $header = preg_replace('/^\xEF\xBB\xBF/', '', trim((string) $header)) ?? '';
        $header = preg_replace('/\s+/u', ' ', $header) ?? '';

        return str_replace('ё', 'е', mb_strtolower($header));
    }

    private function associate(array $headerMap, array $values): array
    {
        $result = [];
        foreach ($headerMap as $index => $header) {
            $result[$header] = $values[$index] ?? null;
        }

        return $result;
    }

    private function isBlankRow(array $row): bool
    {
        return collect($row)->every(fn ($value): bool => $this->text($value) === null);
    }

    private function firstNonBlankRowIndex(array $rows): ?int
    {
        foreach ($rows as $index => $row) {
            if (! $this->isBlankRow($row)) {
                return $index;
            }
        }

        return null;
    }

    /** @return array<string, array<int, string>> */
    private function normalizedAliases(): array
    {
        $result = [];
        foreach ($this->headerAliases() as $canonical => $aliases) {
            $result[$canonical] = array_values(array_unique(array_map(
                fn (string $alias): string => $this->normalizeHeader($alias),
                array_merge([$canonical], $aliases),
            )));
        }

        return $result;
    }

    private function storeFailure(DataImport $import, int $rowNumber, array $raw, array $errors): void
    {
        DataImportRow::query()->updateOrCreate(
            ['data_import_id' => $import->id, 'row_number' => $rowNumber],
            ['status' => DataImportRowStatus::FAILED, 'raw_data' => $raw, 'normalized_data' => null, 'errors' => $errors, 'warnings' => null, 'entity_type' => null, 'entity_id' => null],
        );
    }

    private function updateProgress(DataImport $import, int $processed, int $total): void
    {
        $every = max((int) config('imports.progress_update_every', 25), 1);
        if ($processed % $every === 0 || $processed === $total) {
            $counts = $import->rows()->selectRaw('status, COUNT(*) AS aggregate')->groupBy('status')->pluck('aggregate', 'status');
            $import->update([
                'processed_rows' => $processed,
                'successful_rows' => (int) ($counts[DataImportRowStatus::CREATED->value] ?? 0),
                'failed_rows' => (int) ($counts[DataImportRowStatus::FAILED->value] ?? 0),
                'skipped_rows' => (int) ($counts[DataImportRowStatus::SKIPPED->value] ?? 0),
                'progress' => $total === 0 ? 100 : (int) floor($processed * 100 / $total),
            ]);
        }
    }

    private function refreshCounters(DataImport $import, int $processed): void
    {
        $counts = $import->rows()->selectRaw('status, COUNT(*) AS aggregate')->groupBy('status')->pluck('aggregate', 'status');
        $import->update([
            'processed_rows' => $processed,
            'successful_rows' => (int) ($counts[DataImportRowStatus::CREATED->value] ?? 0),
            'failed_rows' => (int) ($counts[DataImportRowStatus::FAILED->value] ?? 0),
            'skipped_rows' => (int) ($counts[DataImportRowStatus::SKIPPED->value] ?? 0),
            'progress' => $import->total_rows === 0
                ? 100
                : (int) floor($processed * 100 / $import->total_rows),
        ]);
    }

    protected function log(DataImport $import, string $level, string $message, ?array $context = null): void
    {
        DataImportLog::query()->create(['data_import_id' => $import->id, 'level' => $level, 'message' => $message, 'context' => $context, 'created_at' => now()]);
    }
}
