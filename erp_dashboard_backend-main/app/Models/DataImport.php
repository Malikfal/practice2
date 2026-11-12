<?php

namespace App\Models;

use App\Enums\DataImportStatus;
use App\Enums\DataImportType;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Операция импорта данных из файла.
 *
 * @property string $id
 * @property string $company_id
 * @property string|null $created_by_id
 * @property DataImportType $type
 * @property DataImportStatus $status
 * @property string $disk
 * @property string $path
 * @property string $original_name
 * @property string $extension
 * @property string|null $mime_type
 * @property int $file_size
 * @property string|null $checksum
 * @property int $progress
 * @property int $total_rows
 * @property int $processed_rows
 * @property int $successful_rows
 * @property int $failed_rows
 * @property int $skipped_rows
 * @property array<string, mixed>|null $options
 * @property array<string, mixed>|null $metrics
 * @property string|null $error_message
 * @property Carbon|null $started_at
 * @property Carbon|null $finished_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Company|null $company
 * @property-read User|null $createdBy
 * @property-read Collection<int, DataImportRow> $rows
 * @property-read Collection<int, DataImportLog> $logs
 */
class DataImport extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id', 'company_id', 'created_by_id', 'type', 'status', 'disk', 'path',
        'original_name', 'extension', 'mime_type', 'file_size', 'checksum',
        'progress', 'total_rows', 'processed_rows', 'successful_rows',
        'failed_rows', 'skipped_rows', 'options', 'metrics', 'error_message',
        'started_at', 'finished_at',
    ];

    protected function casts(): array
    {
        return [
            'type' => DataImportType::class,
            'status' => DataImportStatus::class,
            'options' => 'array',
            'metrics' => 'array',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_id')->withBlocked();
    }

    public function rows(): HasMany
    {
        return $this->hasMany(DataImportRow::class);
    }

    public function logs(): HasMany
    {
        return $this->hasMany(DataImportLog::class);
    }
}
