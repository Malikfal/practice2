<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Доступ пользователя к заметке проекта.
 *
 * @property string $id
 * @property string $company_id
 * @property string $project_note_id
 * @property string|null $user_id
 * @property string|null $role
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read ProjectNote|null $note
 */
class ProjectNoteAccess extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'project_note_id',
        'user_id',
        'role',
    ];

    public function note(): BelongsTo
    {
        return $this->belongsTo(ProjectNote::class, 'project_note_id');
    }
}
