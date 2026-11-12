<?php

namespace App\Models;

use App\Enums\DataImportRowStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Отдельная строка, обработанная при импорте данных.
 *
 * @property int $id
 * @property string $data_import_id
 * @property int $row_number
 * @property DataImportRowStatus $status
 * @property array<string, mixed>|null $raw_data
 * @property array<string, mixed>|null $normalized_data
 * @property array<string, mixed>|null $errors
 * @property array<string, mixed>|null $warnings
 * @property string|null $entity_type
 * @property string|null $entity_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read DataImport|null $import
 */
class DataImportRow extends Model
{
    protected $fillable = [
        'data_import_id', 'row_number', 'status', 'raw_data', 'normalized_data',
        'errors', 'warnings', 'entity_type', 'entity_id',
    ];

    protected function casts(): array
    {
        return [
            'status' => DataImportRowStatus::class,
            'raw_data' => 'array',
            'normalized_data' => 'array',
            'errors' => 'array',
            'warnings' => 'array',
        ];
    }

    public function import(): BelongsTo
    {
        return $this->belongsTo(DataImport::class, 'data_import_id');
    }
}
