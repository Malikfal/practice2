<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Документ, доступный в приложении.
 *
 * @property string $id
 * @property string $title
 * @property string $original_name
 * @property string $file_path
 * @property bool $is_public
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Document extends Model
{
    use HasUuids;

    protected $fillable = [
        'id',
        'title',
        'original_name',
        'file_path',
        'is_public',
    ];
}
