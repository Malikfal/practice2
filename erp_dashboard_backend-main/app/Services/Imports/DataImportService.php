<?php

namespace App\Services\Imports;

use App\Enums\DataImportStatus;
use App\Enums\DataImportType;
use App\Jobs\Imports\ProcessDataImportJob;
use App\Models\DataImport;
use App\Models\DataImportLog;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class DataImportService
{
    public function create(User $actor, DataImportType $type, UploadedFile $file): DataImport
    {
        $id = (string) Str::uuid();
        $disk = (string) config('imports.disk', 'local');
        $extension = strtolower((string) $file->getClientOriginalExtension());
        $this->validateFileSignature($file, $extension);
        $checksum = hash_file('sha256', $file->getRealPath()) ?: null;
        $path = $file->storeAs(
            "companies/{$actor->company_id}/imports/{$id}",
            "source.{$extension}",
            $disk,
        );

        if (! is_string($path)) {
            throw ValidationException::withMessages(['file' => ['Не удалось сохранить файл импорта.']]);
        }

        try {
            $import = DataImport::query()->create([
                'id' => $id,
                'company_id' => $actor->company_id,
                'created_by_id' => $actor->id,
                'type' => $type,
                'status' => DataImportStatus::QUEUED,
                'disk' => $disk,
                'path' => $path,
                'original_name' => $file->getClientOriginalName(),
                'extension' => $extension,
                'mime_type' => $file->getMimeType(),
                'file_size' => $file->getSize(),
                'checksum' => $checksum,
            ]);
        } catch (\Throwable $exception) {
            Storage::disk($disk)->delete($path);
            throw $exception;
        }

        ProcessDataImportJob::dispatch($id)
            ->onConnection((string) config('imports.queue_connection', 'database_import'))
            ->onQueue((string) config('imports.queue', 'import'));
        $this->log($import, 'INFO', 'Файл принят и поставлен в очередь.');

        return $import;
    }

    public function retry(DataImport $import): DataImport
    {
        if (! in_array($import->status, [DataImportStatus::FAILED, DataImportStatus::COMPLETED_WITH_ERRORS], true)) {
            throw ValidationException::withMessages(['import' => ['Повторить можно только завершившийся с ошибками импорт.']]);
        }

        $import->update([
            'status' => DataImportStatus::QUEUED,
            'progress' => 0,
            'error_message' => null,
            'started_at' => null,
            'finished_at' => null,
        ]);

        ProcessDataImportJob::dispatch($import->id)
            ->onConnection((string) config('imports.queue_connection', 'database_import'))
            ->onQueue((string) config('imports.queue', 'import'));
        $this->log($import, 'INFO', 'Повторная обработка импорта поставлена в очередь.');

        return $import->fresh();
    }

    public function cancel(DataImport $import): DataImport
    {
        if (! in_array($import->status, [DataImportStatus::QUEUED, DataImportStatus::PARSING, DataImportStatus::IMPORTING], true)) {
            throw ValidationException::withMessages(['import' => ['Этот импорт уже нельзя отменить.']]);
        }

        $import->update(['status' => DataImportStatus::CANCELLED, 'finished_at' => now()]);
        $this->log($import, 'WARNING', 'Импорт отменён пользователем.');

        return $import->fresh();
    }

    public function download(DataImport $import): mixed
    {
        abort_unless(Storage::disk($import->disk)->exists($import->path), 404);

        return Storage::disk($import->disk)->download($import->path, $import->original_name);
    }

    private function log(DataImport $import, string $level, string $message): void
    {
        DataImportLog::query()->create([
            'data_import_id' => $import->id,
            'level' => $level,
            'message' => $message,
            'created_at' => now(),
        ]);
    }

    private function validateFileSignature(UploadedFile $file, string $extension): void
    {
        $handle = fopen($file->getRealPath(), 'rb');
        $signature = $handle ? (string) fread($handle, 8) : '';
        if (is_resource($handle)) {
            fclose($handle);
        }

        $valid = match ($extension) {
            'xlsx' => str_starts_with($signature, 'PK'),
            'xls' => $signature === hex2bin('D0CF11E0A1B11AE1'),
            'csv' => ! str_contains($signature, "\0"),
            default => false,
        };

        if (! $valid) {
            throw ValidationException::withMessages([
                'file' => ['Содержимое файла не соответствует его расширению.'],
            ]);
        }
    }
}
