<?php

namespace App\Jobs\Imports;

use App\Enums\DataImportStatus;
use App\Models\DataImport;
use App\Models\DataImportLog;
use App\Models\User;
use App\Services\Imports\ImportProcessorFactory;
use App\Support\DataImportAccess;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class ProcessDataImportJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $timeout = 1800;

    public bool $failOnTimeout = true;

    public function __construct(public readonly string $importId) {}

    public function middleware(): array
    {
        return [(new WithoutOverlapping("data-import:{$this->importId}"))->expireAfter($this->timeout + 60)];
    }

    public function handle(ImportProcessorFactory $factory): void
    {
        $import = DataImport::query()->findOrFail($this->importId);
        if ($import->status !== DataImportStatus::QUEUED) {
            return;
        }

        $actor = User::withBlocked()->find($import->created_by_id);
        if (! $actor || (string) $actor->company_id !== (string) $import->company_id || ! DataImportAccess::can($actor, $import->type)) {
            $import->update([
                'status' => DataImportStatus::FAILED,
                'error_message' => 'Инициатор импорта больше не имеет права выполнять этот импорт.',
                'finished_at' => now(),
            ]);
            DataImportLog::query()->create([
                'data_import_id' => $import->id,
                'level' => 'ERROR',
                'message' => 'Импорт остановлен: отсутствует permission инициатора.',
                'created_at' => now(),
            ]);

            return;
        }

        $import->update([
            'status' => DataImportStatus::PARSING,
            'started_at' => now(),
            'finished_at' => null,
            'error_message' => null,
        ]);
        DataImportLog::query()->create([
            'data_import_id' => $import->id,
            'level' => 'INFO',
            'message' => 'Задача импорта запущена.',
            'context' => ['attempt' => $this->attempts()],
            'created_at' => now(),
        ]);

        try {
            $factory->make($import->type)->process($import);
            $import->refresh();
            if ($import->status === DataImportStatus::CANCELLED) {
                return;
            }

            $import->update([
                'status' => $import->failed_rows > 0 ? DataImportStatus::COMPLETED_WITH_ERRORS : DataImportStatus::COMPLETED,
                'progress' => 100,
                'finished_at' => now(),
                'metrics' => [
                    'duration_seconds' => $import->started_at?->diffInSeconds(now()),
                    'rows_per_second' => $import->started_at && $import->started_at->diffInSeconds(now()) > 0
                        ? round($import->processed_rows / $import->started_at->diffInSeconds(now()), 2)
                        : $import->processed_rows,
                ],
            ]);
            DataImportLog::query()->create([
                'data_import_id' => $import->id,
                'level' => 'INFO',
                'message' => 'Импорт завершён.',
                'context' => [
                    'successful_rows' => $import->successful_rows,
                    'failed_rows' => $import->failed_rows,
                    'skipped_rows' => $import->skipped_rows,
                ],
                'created_at' => now(),
            ]);
        } catch (Throwable $exception) {
            $nonRetryable = $exception instanceof ValidationException;
            $finalAttempt = $nonRetryable || $this->attempts() >= $this->tries;
            $import->update([
                'status' => $finalAttempt ? DataImportStatus::FAILED : DataImportStatus::QUEUED,
                'error_message' => Str::limit($exception->getMessage(), 4000),
                'finished_at' => $finalAttempt ? now() : null,
            ]);
            DataImportLog::query()->create([
                'data_import_id' => $import->id,
                'level' => $finalAttempt ? 'ERROR' : 'WARNING',
                'message' => $finalAttempt ? 'Импорт завершился системной ошибкой.' : 'Системная ошибка, задача будет запущена повторно.',
                'context' => ['exception' => $exception::class, 'message' => Str::limit($exception->getMessage(), 1000)],
                'created_at' => now(),
            ]);

            if ($nonRetryable) {
                return;
            }

            throw $exception;
        }
    }

    public function failed(?Throwable $exception): void
    {
        DataImport::query()->whereKey($this->importId)->update([
            'status' => DataImportStatus::FAILED,
            'error_message' => Str::limit($exception?->getMessage() ?? 'Задача импорта завершилась с ошибкой.', 4000),
            'finished_at' => now(),
        ]);
    }
}
