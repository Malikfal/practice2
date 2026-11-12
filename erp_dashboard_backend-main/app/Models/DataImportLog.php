<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Запись журнала выполнения импорта данных.
 *
 * @property int $id
 * @property string $data_import_id
 * @property string $level
 * @property string $message
 * @property array<string, mixed>|null $context
 * @property Carbon $created_at
 * @property-read DataImport|null $import
 */
class DataImportLog extends Model
{
    public $timestamps = false;

    protected $fillable = ['data_import_id', 'level', 'message', 'context', 'created_at'];

    protected function casts(): array
    {
        return ['context' => 'array', 'created_at' => 'datetime'];
    }

    public function import(): BelongsTo
    {
        return $this->belongsTo(DataImport::class, 'data_import_id');
    }
}
