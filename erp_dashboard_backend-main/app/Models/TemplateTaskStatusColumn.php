<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Колонка рабочего процесса задач в шаблоне проекта.
 *
 * @property string $id
 * @property string $template_id
 * @property string $name
 * @property string $slug
 * @property string|null $color
 * @property int $position
 * @property bool $is_default
 * @property bool $is_final
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Template|null $template
 */
class TemplateTaskStatusColumn extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'template_id',
        'name',
        'slug',
        'color',
        'position',
        'is_default',
        'is_final',
    ];

    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'is_default' => 'boolean',
            'is_final' => 'boolean',
        ];
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(Template::class, 'template_id');
    }
}
