<?php

namespace App\Models;

use App\Enums\TariffFeature;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Concerns\HasCompanyProjectAccess;
use App\Models\Concerns\HasTaskProjectVisibility;
use App\Support\ClientRolePermissions;
use BackedEnum;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Traits\HasRoles;

/**
 * Авторизованный сотрудник или администратор системы.
 *
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property string $email
 * @property string $name
 * @property string $password_hash
 * @property UserStatus $status
 * @property Carbon|null $archived_at
 * @property string $id
 * @property string $last_name
 * @property string|null $company_id
 * @property string|null $position
 * @property Carbon|null $birthday
 * @property string|null $phone
 * @property array<string, mixed>|null $socials
 * @property string|null $skills
 * @property int|null $role_id
 * @property array<string, mixed>|null $payload
 * @property string|null $salary_finance_article_id
 * @property int|null $weekly_plan_seconds
 * @property string|null $avatar_url
 * @property string|null $role
 * @property-read string $first_name
 * @property-read Company|null $company
 * @property-read FinanceArticle|null $salaryFinanceArticle
 * @property-read Role|null $roleModel
 * @property-read \Illuminate\Database\Eloquent\Collection<int, Project> $projects
 * @property-read \Illuminate\Database\Eloquent\Collection<int, ProjectMember> $projectMembers
 * @property-read \Illuminate\Database\Eloquent\Collection<int, ProjectPayrollExcludedEmployee> $projectPayrollExclusions
 * @property-read \Illuminate\Database\Eloquent\Collection<int, WorkSession> $workSessions
 * @property-read \Illuminate\Database\Eloquent\Collection<int, WorkSegment> $workSegments
 * @property-read \Illuminate\Database\Eloquent\Collection<int, RefreshSession> $refreshSessions
 * @property-read \Illuminate\Database\Eloquent\Collection<int, Task> $assignedTasks
 * @property-read \Illuminate\Database\Eloquent\Collection<int, Task> $createdTasks
 * @property-read \Illuminate\Database\Eloquent\Collection<int, Skill> $competencies
 * @property-read \Illuminate\Database\Eloquent\Collection<int, Permission> $deniedPermissions
 * @property-read \Illuminate\Database\Eloquent\Collection<int, Project> $pinnedProjects
 * @property-read \Illuminate\Database\Eloquent\Collection<int, Template> $pinnedTemplates
 * @property-read \Illuminate\Database\Eloquent\Collection<int, Role> $roles
 * @property-read \Illuminate\Database\Eloquent\Collection<int, Permission> $permissions
 * @property-read \Illuminate\Database\Eloquent\Collection<int, DatabaseNotification> $notifications
 */
class User extends Authenticatable
{
    use HasCompanyProjectAccess;
    use HasFactory, HasRoles, Notifiable {
        HasRoles::hasPermissionTo as private hasPermissionToFromTrait;
    }
    use HasTaskProjectVisibility;

    private const WITHOUT_BLOCKED_SCOPE = 'without_blocked';

    private const PERMISSION_CACHE_PREFIX = 'users.permission-cache';

    private static ?bool $usersHasRoleIdColumn = null;

    private static ?bool $usersHasRoleColumn = null;

    private ?Collection $cachedDeniedPermissionNames = null;

    private ?Collection $cachedTariffLockedPermissionNames = null;

    /**
     * @var array<string, bool>
     */
    private array $permissionCheckCache = [];

    protected string $guard_name = 'web';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'salary_finance_article_id',
        'name',
        'last_name',
        'email',
        'password_hash',
        'role',
        'role_id',
        'status',
        'archived_at',
        'avatar_url',
        'position',
        'birthday',
        'phone',
        'socials',
        'skills',
        'payload',
        'weekly_plan_seconds',
        'client_id',
        'client_all_projects',
        'last_login_at',
        'password_set_at',
        'email_verified_at',
    ];

    protected $hidden = [
        'password_hash',
    ];

    protected $appends = [
        'first_name',
        'last_name',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
            'birthday' => 'date',
            'socials' => 'array',
            'payload' => 'array',
            'role_id' => 'integer',
            'weekly_plan_seconds' => 'integer',
            'status' => UserStatus::class,
            'archived_at' => 'date',
            'client_all_projects' => 'boolean',
            'last_login_at' => 'datetime',
            'password_set_at' => 'datetime',
            'email_verified_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::addGlobalScope(self::WITHOUT_BLOCKED_SCOPE, function (Builder $builder): void {
            $builder->where('status', '!=', UserStatus::BLOCKED);
        });

        static::saved(function (self $user): void {
            if ($user->wasChanged(['role_id', 'role', 'company_id'])) {
                $user->flushPermissionCache();
            }
        });

        static::deleted(function (self $user): void {
            $user->flushPermissionCache();
        });
    }

    public function setPasswordAttribute(string $value): void
    {
        $this->attributes['password_hash'] = Hash::make($value);
    }

    public function getRoleAttribute(?string $value): ?string
    {
        if ($value !== null && $value !== '') {
            return $value;
        }

        if ($this->relationLoaded('roleModel')) {
            return (string) $this->roleModel?->name ?: null;
        }

        if (! self::usersHasRoleIdColumn() || $this->role_id === null) {
            return null;
        }

        $roleName = Role::query()
            ->whereKey($this->role_id)
            ->value('name');

        return is_string($roleName) && $roleName !== '' ? $roleName : null;
    }

    public function setRoleAttribute(?string $value): void
    {
        $this->forgetPermissionCache();
        $roleValue = trim((string) $value);

        if (! self::usersHasRoleIdColumn()) {
            if (self::usersHasRoleColumn()) {
                $this->attributes['role'] = $roleValue === '' ? null : $roleValue;
            }

            return;
        }

        if ($roleValue === '') {
            $this->attributes['role_id'] = null;

            return;
        }

        $role = self::findOrCreateScopedRole($roleValue, (string) $this->company_id);
        $this->attributes['role_id'] = $role->id;

        if (self::usersHasRoleColumn()) {
            $this->attributes['role'] = $roleValue;
        }

        $this->setRelation('roleModel', $role);
    }

    public function getFirstNameAttribute(): string
    {
        return explode(' ', trim((string) $this->name), 2)[0] ?? '';
    }

    public function getLastNameAttribute(): string
    {
        $storedLastName = trim((string) ($this->attributes['last_name'] ?? ''));
        if ($storedLastName !== '') {
            return $storedLastName;
        }

        $parts = explode(' ', trim((string) $this->name), 2);

        return $parts[1] ?? '';
    }

    public function getAuthPassword(): string
    {
        return (string) $this->password_hash;
    }

    public function isBlocked(): bool
    {
        return $this->status === UserStatus::BLOCKED;
    }

    public function isSuperAdmin(): bool
    {
        return (string) $this->role === UserRole::SUPERADMIN->value;
    }

    /**
     * @return BelongsTo<Company, User>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    /**
     * Возвращает индивидуальную финансовую статью оплаты труда.
     */
    public function salaryFinanceArticle(): BelongsTo
    {
        return $this->belongsTo(FinanceArticle::class, 'salary_finance_article_id');
    }

    public function roleModel(): BelongsTo
    {
        return $this->belongsTo(Role::class, 'role_id');
    }

    public function syncSpatieRoleFromLegacyRole(): void
    {
        $this->forgetPermissionCache();
        $roleValue = $this->resolvedRoleValue();

        if ($roleValue === '') {
            return;
        }

        $role = self::findOrCreateScopedRole($roleValue, (string) $this->company_id);
        $this->syncRoles([$role]);
    }

    public static function scopedSpatieRoleName(string $roleValue, string $companyId = ''): string
    {
        return $roleValue;
    }

    public static function findOrCreateScopedRole(string $roleValue, string $companyId = ''): Role
    {
        $roleName = self::scopedSpatieRoleName($roleValue, $companyId);
        $normalizedCompanyId = $companyId !== '' ? $companyId : null;

        $role = Role::query()
            ->where('name', $roleName)
            ->where('guard_name', 'web')
            ->when(
                $roleValue === UserRole::SUPERADMIN->value || $normalizedCompanyId === null,
                static fn ($query) => $query->whereNull('company_id'),
                static fn ($query) => $query->where('company_id', $normalizedCompanyId),
            )
            ->first();

        if ($role) {
            return $role;
        }

        $attributes = [
            'name' => $roleName,
            'guard_name' => 'web',
            'company_id' => ($roleValue === UserRole::SUPERADMIN->value) ? null : $normalizedCompanyId,
        ];

        if (Schema::hasColumn('roles', 'display_name')) {
            $attributes['display_name'] = UserRole::labelByValue($roleValue) ?? $roleName;
        }

        $role = Role::query()->create($attributes);

        if ($roleValue === UserRole::CLIENT->value) {
            foreach (ClientRolePermissions::defaults() as $permission) {
                Permission::findOrCreate($permission, 'web');
            }
            $role->syncPermissions(ClientRolePermissions::defaults());
        }

        return $role;
    }

    public function scopeWithBlocked(Builder $query): Builder
    {
        return $query->withoutGlobalScope(self::WITHOUT_BLOCKED_SCOPE);
    }

    public function resolveRouteBinding($value, $field = null): ?self
    {
        $resolvedUser = $this->withBlocked()
            ->where($field ?? $this->getRouteKeyName(), $value)
            ->firstOrFail();

        $actor = auth()->user();

        if ($actor && ! $actor->isSuperAdmin() && (string) $actor->company_id !== (string) $resolvedUser->company_id) {
            abort(404);
        }

        return $resolvedUser;
    }

    public function projects(): HasMany
    {
        return $this->hasMany(Project::class, 'created_by_id');
    }

    public function projectMembers(): HasMany
    {
        return $this->hasMany(ProjectMember::class);
    }

    public function projectAssignmentHistories(): HasMany
    {
        return $this->hasMany(ProjectAssignmentHistory::class);
    }

    public function projectPayrollExclusions(): HasMany
    {
        return $this->hasMany(ProjectPayrollExcludedEmployee::class);
    }

    public function workSessions(): HasMany
    {
        return $this->hasMany(WorkSession::class);
    }

    public function workSegments(): HasMany
    {
        return $this->hasMany(WorkSegment::class);
    }

    public function refreshSessions(): HasMany
    {
        return $this->hasMany(RefreshSession::class);
    }

    public function assignedTasks(): BelongsToMany
    {
        return $this->belongsToMany(Task::class, 'task_users');
    }

    public function createdTasks(): HasMany
    {
        return $this->hasMany(Task::class, 'created_by_id');
    }

    public function competencies(): BelongsToMany
    {
        return $this->belongsToMany(Skill::class, 'employee_skills', 'employee_id', 'skill_id')
            ->withTimestamps();
    }

    public function deniedPermissions(): BelongsToMany
    {
        return $this->belongsToMany(
            Permission::class,
            'user_permission_denials',
            'user_id',
            'permission_id',
        )->withTimestamps();
    }

    public function deniedPermissionNames(): Collection
    {
        if ($this->cachedDeniedPermissionNames !== null) {
            return $this->cachedDeniedPermissionNames;
        }

        if ($this->relationLoaded('deniedPermissions')) {
            return $this->cachedDeniedPermissionNames = $this->deniedPermissions
                ->pluck('name')
                ->filter(static fn ($name): bool => is_string($name) && $name !== '')
                ->values();
        }

        $cacheKey = $this->deniedPermissionNamesCacheKey();
        $this->registerPermissionCacheKey($cacheKey);

        $names = Cache::rememberForever($cacheKey, function (): array {
            return $this->deniedPermissions()
                ->pluck('name')
                ->filter(static fn (string $name): bool => $name !== '')
                ->values()
                ->all();
        });

        return $this->cachedDeniedPermissionNames = collect($names);
    }

    public function rolePermissionNames(): Collection
    {
        $roleValue = $this->resolvedRoleValue();

        if ($roleValue === '') {
            return $this->getPermissionsViaRoles()->pluck('name')->values();
        }

        return self::findOrCreateScopedRole($roleValue, (string) $this->company_id)
            ->permissions
            ->pluck('name')
            ->values();
    }

    public function hasDeniedPermission(string $permission): bool
    {
        return $this->deniedPermissionNames()->contains($permission)
            || $this->tariffLockedPermissionNames()->contains($permission);
    }

    /**
     * Права, снятые тарифом компании (на ФРИ закрыты возможности ПРО).
     */
    public function tariffLockedPermissionNames(): Collection
    {
        if ($this->cachedTariffLockedPermissionNames !== null) {
            return $this->cachedTariffLockedPermissionNames;
        }

        $features = $this->company_id ? ($this->company?->lockedTariffFeatures() ?? []) : [];

        return $this->cachedTariffLockedPermissionNames = collect($features)
            ->flatMap(static fn (TariffFeature $feature): array => $feature->permissions())
            ->unique()
            ->values();
    }

    public function hasPermissionTo($permission, $guardName = null): bool
    {
        $permissionName = match (true) {
            $permission instanceof Permission => (string) $permission->name,
            $permission instanceof BackedEnum => (string) $permission->value,
            is_string($permission) => $permission,
            default => '',
        };

        if ($permissionName !== '' && $this->hasDeniedPermission($permissionName)) {
            return false;
        }

        if ($permissionName === '') {
            return $this->hasPermissionToFromTrait($permission, $guardName);
        }

        $cacheKey = ($guardName ?? $this->getDefaultGuardName()).':'.$permissionName;

        if (array_key_exists($cacheKey, $this->permissionCheckCache)) {
            return $this->permissionCheckCache[$cacheKey];
        }

        $persistentCacheKey = $this->permissionResultCacheKey($permissionName, $guardName);
        $this->registerPermissionCacheKey($persistentCacheKey);

        return $this->permissionCheckCache[$cacheKey] = Cache::rememberForever(
            $persistentCacheKey,
            fn (): bool => $this->hasPermissionToFromTrait($permission, $guardName),
        );
    }

    public function effectivePermissionNames(): Collection
    {
        $deniedPermissions = $this->deniedPermissionNames()->merge($this->tariffLockedPermissionNames());

        return $this->grantedPermissionNames()
            ->reject(static fn (string $permission): bool => $deniedPermissions->contains($permission))
            ->values();
    }

    /**
     * Права роли, которые пользователь получил бы на ПРО, но которые закрыты тарифом.
     */
    public function tariffBlockedPermissionNames(): Collection
    {
        $locked = $this->tariffLockedPermissionNames();
        if ($locked->isEmpty()) {
            return collect();
        }

        $denied = $this->deniedPermissionNames();

        return $this->grantedPermissionNames()
            ->filter(static fn (string $permission): bool => $locked->contains($permission) && ! $denied->contains($permission))
            ->values();
    }

    private function grantedPermissionNames(): Collection
    {
        return $this->rolePermissionNames()
            ->merge($this->getDirectPermissions()->pluck('name'))
            ->unique();
    }

    public function resolvedRoleValue(): string
    {
        if (self::usersHasRoleIdColumn()) {
            return (string) ($this->roleModel?->name ?? $this->getAttribute('role') ?? '');
        }

        return (string) ($this->getAttribute('role') ?? '');
    }

    public function pinnedProjects(): BelongsToMany
    {
        return $this->belongsToMany(Project::class, 'user_pinned_projects')->withTimestamps();
    }

    /**
     * Проекты, выбранные клиентскому аккаунту, когда у него нет доступа ко всем проектам клиента.
     */
    public function clientProjects(): BelongsToMany
    {
        return $this->belongsToMany(Project::class, 'client_account_projects')->withTimestamps();
    }

    public function pinnedTemplates(): BelongsToMany
    {
        return $this->belongsToMany(Template::class, 'user_pinned_templates')->withTimestamps();
    }

    private static function usersHasRoleIdColumn(): bool
    {
        if (self::$usersHasRoleIdColumn === null) {
            self::$usersHasRoleIdColumn = Schema::hasColumn('users', 'role_id');
        }

        return self::$usersHasRoleIdColumn;
    }

    private static function usersHasRoleColumn(): bool
    {
        if (self::$usersHasRoleColumn === null) {
            self::$usersHasRoleColumn = Schema::hasColumn('users', 'role');
        }

        return self::$usersHasRoleColumn;
    }

    public function flushPermissionCache(): void
    {
        $this->cachedDeniedPermissionNames = null;
        $this->permissionCheckCache = [];
        self::forgetPermissionCacheKeysForUser((string) $this->getKey());
    }

    public static function flushPermissionCacheForUser(string $userId): void
    {
        self::forgetPermissionCacheKeysForUser($userId);
    }

    /**
     * @param  iterable<int, string>  $userIds
     */
    public static function flushPermissionCacheForUsers(iterable $userIds): void
    {
        foreach ($userIds as $userId) {
            if ($userId === '') {
                continue;
            }

            self::flushPermissionCacheForUser((string) $userId);
        }
    }

    public static function flushRolePermissionCache(int|string|null $roleId): void
    {
        if ($roleId === null || $roleId === '') {
            return;
        }

        self::withBlocked()
            ->where('role_id', (int) $roleId)
            ->get(['id'])
            ->each(static function (self $user): void {
                $user->flushPermissionCache();
            });
    }

    private function forgetPermissionCache(): void
    {
        $this->cachedDeniedPermissionNames = null;
        $this->permissionCheckCache = [];
    }

    private function deniedPermissionNamesCacheKey(): string
    {
        return sprintf(
            '%s:user:%s:denied',
            self::PERMISSION_CACHE_PREFIX,
            (string) $this->getKey(),
        );
    }

    private function permissionResultCacheKey(string $permissionName, ?string $guardName): string
    {
        return sprintf(
            '%s:user:%s:guard:%s:permission:%s',
            self::PERMISSION_CACHE_PREFIX,
            (string) $this->getKey(),
            $guardName ?? $this->getDefaultGuardName(),
            sha1($permissionName),
        );
    }

    private function registerPermissionCacheKey(string $cacheKey): void
    {
        $registryKey = self::permissionCacheRegistryKey((string) $this->getKey());
        $keys = Cache::get($registryKey, []);

        if (! is_array($keys) || in_array($cacheKey, $keys, true)) {
            return;
        }

        $keys[] = $cacheKey;
        Cache::forever($registryKey, $keys);
    }

    private static function forgetPermissionCacheKeysForUser(string $userId): void
    {
        if ($userId === '') {
            return;
        }

        $registryKey = self::permissionCacheRegistryKey($userId);
        $keys = Cache::get($registryKey, []);

        if (is_array($keys)) {
            foreach ($keys as $cacheKey) {
                if (is_string($cacheKey) && $cacheKey !== '') {
                    Cache::forget($cacheKey);
                }
            }
        }

        Cache::forget($registryKey);
    }

    private static function permissionCacheRegistryKey(string $userId): string
    {
        return sprintf('%s:user:%s:keys', self::PERMISSION_CACHE_PREFIX, $userId);
    }
}
