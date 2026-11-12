<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Папка в базе знаний компании.
 *
 * @property string $id
 * @property string $company_id
 * @property string $name
 * @property bool $is_archive
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Collection<int, KnowledgeBaseArticle> $articles
 * @property-read Collection<int, KnowledgeBaseFolderAccess> $accesses
 */
class KnowledgeBaseFolder extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'name',
        'is_archive',
    ];

    protected function casts(): array
    {
        return [
            'is_archive' => 'boolean',
        ];
    }

    public function articles(): HasMany
    {
        return $this->hasMany(KnowledgeBaseArticle::class, 'folder_id');
    }

    public function accesses(): HasMany
    {
        return $this->hasMany(KnowledgeBaseFolderAccess::class, 'folder_id');
    }
}
