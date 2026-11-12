<?php

namespace App\Models;

use App\Enums\CompanyStatus;
use App\Enums\TariffFeature;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * Компания-арендатор и настройки её рабочего пространства.
 *
 * @property string $id
 * @property string $name
 * @property CompanyStatus $status
 * @property string|null $owner_user_id
 * @property Carbon|null $blocked_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property string|null $tracker_default_task_status_name
 * @property string|null $client_task_status_name
 * @property string|null $default_salary_finance_article_id
 * @property string|null $tariff_id
 * @property array<string, mixed>|null $requisites
 * @property string|null $default_fixed_absence_finance_article_id
 * @property bool $calculate_daily_payroll
 * @property string $timezone
 * @property int $unestimated_task_limit_seconds
 * @property Carbon|null $self_registered_at
 * @property-read User|null $owner
 * @property-read FinanceArticle|null $defaultSalaryFinanceArticle
 * @property-read FinanceArticle|null $defaultFixedAbsenceFinanceArticle
 * @property-read Collection<int, User> $employees
 * @property-read Tariff|null $tariff
 * @property-read Subscription|null $subscription
 * @property-read Collection<int, Invoice> $invoices
 */
class Company extends Model
{
    public const DEFAULT_UNESTIMATED_TASK_LIMIT_SECONDS = 3 * 3600;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'name',
        'status',
        'owner_user_id',
        'blocked_at',
        'tracker_default_task_status_name',
        'client_task_status_name',
        'default_salary_finance_article_id',
        'default_fixed_absence_finance_article_id',
        'calculate_daily_payroll',
        'timezone',
        'unestimated_task_limit_seconds',
        'tariff_id',
        'requisites',
        'self_registered_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => CompanyStatus::class,
            'blocked_at' => 'datetime',
            'requisites' => 'array',
            'calculate_daily_payroll' => 'boolean',
            'unestimated_task_limit_seconds' => 'integer',
            'self_registered_at' => 'datetime',
        ];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_user_id')->withBlocked();
    }

    public function defaultSalaryFinanceArticle(): BelongsTo
    {
        return $this->belongsTo(FinanceArticle::class, 'default_salary_finance_article_id');
    }

    public function defaultFixedAbsenceFinanceArticle(): BelongsTo
    {
        return $this->belongsTo(FinanceArticle::class, 'default_fixed_absence_finance_article_id');
    }

    public function employees(): HasMany
    {
        return $this->hasMany(User::class, 'company_id')->withBlocked()
            ->whereDoesntHave('roleModel', static fn ($query) => $query->where('name', 'CLIENT'));
    }

    public function tariff(): BelongsTo
    {
        return $this->belongsTo(Tariff::class);
    }

    public function subscription(): HasOne
    {
        return $this->hasOne(Subscription::class)->orderByDesc('ends_at');
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class)->orderByDesc('created_at');
    }

    public function isBlocked(): bool
    {
        return $this->status === CompanyStatus::BLOCKED;
    }

    public function isOnFreeTariff(): bool
    {
        return (bool) $this->tariff?->isFree();
    }

    /**
     * Возможности ПРО, закрытые текущим тарифом. Без тарифа доступно всё, как и раньше.
     *
     * @return array<int, TariffFeature>
     */
    public function lockedTariffFeatures(): array
    {
        return $this->isOnFreeTariff() ? TariffFeature::cases() : [];
    }

    public function hasTariffFeature(TariffFeature $feature): bool
    {
        return ! in_array($feature, $this->lockedTariffFeatures(), true);
    }

    public function payrollTimezone(): string
    {
        return (string) ($this->getAttribute('timezone') ?: (config('payroll.timezone') ?: 'Europe/Moscow'));
    }

    /**
     * Сколько можно затратить на задачу без оценки, прежде чем она попадет в отчет по перерасходу.
     */
    public function unestimatedTaskLimitSeconds(): int
    {
        $value = $this->getAttribute('unestimated_task_limit_seconds');

        return $value === null ? self::DEFAULT_UNESTIMATED_TASK_LIMIT_SECONDS : (int) $value;
    }

    /**
     * Сегодняшняя дата в часовом поясе компании: с ней сравниваются календарные даты вроде начала ставки.
     */
    public function today(): string
    {
        return now($this->payrollTimezone())->toDateString();
    }

    public static function todayFor(string $companyId): string
    {
        return self::query()->find($companyId)?->today()
            ?? now((string) (config('payroll.timezone') ?: 'Europe/Moscow'))->toDateString();
    }
}
