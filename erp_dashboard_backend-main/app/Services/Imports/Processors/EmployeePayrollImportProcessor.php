<?php

namespace App\Services\Imports\Processors;

use App\Enums\EmployeeRateType;
use App\Enums\PayrollHoursScope;
use App\Enums\PayrollRangeCalculationMethod;
use App\Enums\UserPermission;
use App\Models\Company;
use App\Models\DataImport;
use App\Models\EmployeeRate;
use App\Models\FinanceArticle;
use App\Models\User;
use App\Repositories\Workspace\PayrollRepositories\PayrollPayoutRepository;
use App\Services\Imports\SpreadsheetReader;
use App\Services\Payroll\Finance\PayrollFinanceArticleService;
use App\Services\Workspace\EmployeePayrollSettingsService;
use App\Services\Workspace\EmployeeRateService;
use App\Services\Workspace\PayrollPayoutService;
use App\Support\PermissionAccess;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Импорт оплаты труда сотрудников: текущие ставки с датой начала действия,
 * финансовая статья ФОТ и остаток к выплате на начало учета выплат.
 *
 * Ставка сохраняется через EmployeeRateService, как при ручном изменении в карточке:
 * история срезов и все проверки остаются прежними.
 */
class EmployeePayrollImportProcessor extends AbstractImportProcessor
{
    /** Колонки ставок и тип ставки, к которому относится каждая. */
    private const RATE_COLUMNS = [
        'salary' => EmployeeRateType::WEEKLY_SALARY,
        'hourly_rate' => EmployeeRateType::HOURLY,
        'supervised_hourly_rate' => EmployeeRateType::SUPERVISED_HOURLY,
        'company_hourly_rate' => EmployeeRateType::COMPANY_HOURLY,
    ];

    private const RATE_LABELS = [
        'WEEKLY_SALARY' => 'Оклад (неделя)',
        'HOURLY' => 'Ставка за час',
        'SUPERVISED_HOURLY' => 'Ставка за часы под контролем',
        'COMPANY_HOURLY' => 'Ставка за часы всей компании',
    ];

    private ?string $loadedImportId = null;

    private ?User $actor = null;

    private ?Company $company = null;

    /** @var Collection<int, User> */
    private Collection $employees;

    /** @var array<string, string>|null Путь статьи => id для выбираемых статей ФОТ. */
    private ?array $articlePaths = null;

    public function __construct(
        SpreadsheetReader $reader,
        private readonly EmployeeRateService $rates,
        private readonly EmployeePayrollSettingsService $payrollSettings,
        private readonly PayrollFinanceArticleService $financeArticles,
        private readonly PayrollPayoutService $payouts,
        private readonly PayrollPayoutRepository $payoutRepository,
    ) {
        parent::__construct($reader);
    }

    protected function requiredHeaders(): array
    {
        return ['effective_from'];
    }

    protected function headerAliases(): array
    {
        return [
            'email' => ['Email', 'Почта', 'e-mail'],
            'full_name' => ['ФИО', 'Сотрудник', 'full name'],
            'effective_from' => ['Дата начала действия', 'Дата начала', 'Действует с', 'effective from'],
            'salary' => ['Оклад (неделя)', 'Оклад', 'salary'],
            'salary_distribution_scope' => ['Распределять оклад по часам', 'Распределение оклада'],
            'hourly_rate' => ['Ставка за час', 'Ставка за собственные часы', 'hourly rate'],
            'supervised_hourly_rate' => ['Ставка за часы под контролем', 'supervised hourly rate'],
            'company_hourly_rate' => ['Ставка за часы всей компании', 'company hourly rate'],
            'exclude_from_supervised_hours' => ['Не учитывать часы как подконтрольные', 'exclude from supervised hours'],
            'advanced' => ['Продвинутая ставка', 'Расширенная формула', 'advanced rate'],
            'finance_article' => ['Финансовая статья', 'Статья ФОТ', 'finance article'],
            'opening_balance' => ['Остаток к выплате на начало учета', 'Остаток к выплате', 'opening balance'],
        ];
    }

    protected function importRow(DataImport $import, array $row): array
    {
        $this->loadContext($import);
        $warnings = [];
        $employee = $this->resolveEmployee($this->text($row['email'] ?? null), $this->text($row['full_name'] ?? null));
        $normalized = ['employee_id' => (string) $employee->id];

        $rate = null;
        $ratePayload = $this->ratePayload($employee, $row, $warnings);
        if ($ratePayload !== null) {
            $rate = $this->saveRate($employee, $ratePayload);
            $normalized['rate'] = $ratePayload;
        }

        $articleName = $this->text($row['finance_article'] ?? null);
        if ($articleName !== null) {
            $articleId = $this->resolveArticleId($articleName);
            // Тот же путь, что и выбор статьи во вкладке «Оплата труда».
            $this->payrollSettings->update($this->actor, $employee, ['salary_finance_article_id' => $articleId]);
            $normalized['salary_finance_article_id'] = $articleId;
        }

        $opening = $this->signedKopecks($row['opening_balance'] ?? null, 'opening_balance');
        if ($opening !== null) {
            $this->saveOpening($employee, $opening, $warnings);
            $normalized['opening_balance'] = $opening;
        }

        if ($ratePayload === null && $articleName === null && $opening === null) {
            throw ValidationException::withMessages(['row' => ['Нет данных для импорта: заполните ставки с датой начала действия, финансовую статью или остаток к выплате.']]);
        }

        return [
            'model' => $rate ?? $employee,
            'normalized' => $normalized,
            'warnings' => $warnings ?: null,
        ];
    }

    /**
     * Ищет сотрудника компании по email, а если email не указан или не найден, по ФИО.
     */
    private function resolveEmployee(?string $email, ?string $fullName): User
    {
        if ($email === null && $fullName === null) {
            throw ValidationException::withMessages(['email' => ['Укажите email или ФИО сотрудника.']]);
        }

        if ($email !== null) {
            $employee = $this->employees->first(
                fn (User $user): bool => mb_strtolower(trim((string) $user->email)) === mb_strtolower($email),
            );
            if ($employee) {
                return $employee;
            }
            if ($fullName === null) {
                throw ValidationException::withMessages(['email' => ["Сотрудник с email \"{$email}\" не найден."]]);
            }
        }

        $needle = $this->normalizeLookup($fullName);
        $matches = $this->employees->filter(function (User $user) use ($needle): bool {
            $first = $this->normalizeLookup($user->name);
            $last = $this->normalizeLookup($user->last_name);

            return in_array($needle, [trim("{$last} {$first}"), trim("{$first} {$last}")], true);
        });

        if ($matches->count() > 1) {
            throw ValidationException::withMessages(['full_name' => ["Найдено несколько сотрудников \"{$fullName}\". Укажите email."]]);
        }

        return $matches->first()
            ?? throw ValidationException::withMessages(['full_name' => ["Сотрудник \"{$fullName}\" не найден."]]);
    }

    /**
     * Собирает данные среза ставки в формате StoreEmployeeRateRequest или null, если ставок в строке нет.
     *
     * @return array<string, mixed>|null
     */
    private function ratePayload(User $employee, array $row, array &$warnings): ?array
    {
        $values = [];
        foreach (array_keys(self::RATE_COLUMNS) as $column) {
            $values[$column] = $this->nonNegativeKopecks($row[$column] ?? null, $column);
        }
        $advanced = $this->advancedSettings($this->text($row['advanced'] ?? null));
        $date = $this->date($row['effective_from'] ?? null, 'effective_from');

        $hasRates = collect($values)->contains(static fn (?int $value): bool => $value !== null) || $advanced !== [];
        if (! $hasRates) {
            if ($date !== null) {
                throw ValidationException::withMessages(['salary' => ['Укажите хотя бы одну ставку для даты начала действия.']]);
            }

            return null;
        }
        if ($date === null) {
            throw ValidationException::withMessages(['effective_from' => ['Укажите дату начала действия ставки.']]);
        }

        $latest = $this->latestRate($employee);
        $settings = [];
        foreach ($advanced as $type => $setting) {
            $default = $values[EmployeeRateType::from($type)->baseColumn()];
            if ($default === null) {
                throw ValidationException::withMessages(['advanced' => [sprintf(
                    'Для продвинутой ставки «%s» заполните колонку «%s» стандартной ставкой.',
                    self::RATE_LABELS[$type],
                    self::RATE_LABELS[$type],
                )]]);
            }
            $settings[$type] = [...$setting, 'default_rate' => $default];
        }

        // Отдельные ставки по проектам в файле не описываются: переносим их из прежней ставки,
        // чтобы импорт не стёр настройку, сделанную в карточке.
        foreach ($latest?->rate_settings ?? [] as $type => $setting) {
            $rateType = EmployeeRateType::tryFrom((string) $type);
            $projectRates = $setting['project_rates'] ?? [];
            if (! $rateType?->isHourly() || $projectRates === [] || $values[$rateType->baseColumn()] === null) {
                continue;
            }

            $settings[$rateType->value] = [
                'rate_type' => $rateType->value,
                'is_advanced' => false,
                ...($settings[$rateType->value] ?? []),
                'project_rates' => $projectRates,
            ];
            $warnings[] = sprintf('Отдельные ставки по проектам для «%s» перенесены из предыдущей ставки.', self::RATE_LABELS[$rateType->value]);
        }

        return [
            ...$values,
            'salary_distribution_scope' => $this->hoursScope($row['salary_distribution_scope'] ?? null)
                ?? $latest?->salary_distribution_scope?->value
                ?? PayrollHoursScope::COMPANY->value,
            'exclude_from_supervised_hours' => $this->boolean($row['exclude_from_supervised_hours'] ?? null, 'exclude_from_supervised_hours')
                ?? (bool) $latest?->exclude_from_supervised_hours,
            'effective_from' => $date,
            'rate_settings' => array_values($settings),
        ];
    }

    /**
     * Создает новый срез ставки. Если последняя ставка уже начинается этой датой, она обновляется:
     * так повторная загрузка исправленного файла не упирается в запрет двух ставок на одно число.
     *
     * @param  array<string, mixed>  $payload
     */
    private function saveRate(User $employee, array $payload): EmployeeRate
    {
        $latest = $this->latestRate($employee);
        if ($latest && $latest->effective_from->toDateString() === $payload['effective_from']) {
            return $this->rates->update($this->actor, $latest, $payload);
        }

        return $this->rates->store($this->actor, $employee, $payload);
    }

    private function latestRate(User $employee): ?EmployeeRate
    {
        return EmployeeRate::query()
            ->where('employee_id', $employee->id)
            ->orderByDesc('effective_from')
            ->orderByDesc('created_at')
            ->first();
    }

    /**
     * Разбирает продвинутую ставку. Блоки разделяются переводом строки или «|»:
     * «Ставка за час: 0-40 = 500; 40+ = 700 | Оклад (прогрессивно): 0-160 = 50000; 160+ = 60000».
     * Часы указываются за неделю, ставки в рублях.
     *
     * @return array<string, array<string, mixed>>
     */
    private function advancedSettings(?string $value): array
    {
        if ($value === null) {
            return [];
        }

        $settings = [];
        foreach (preg_split('/[\r\n|]+/u', $value) ?: [] as $block) {
            $block = trim($block);
            if ($block === '') {
                continue;
            }

            $parts = explode(':', $block, 2);
            if (count($parts) !== 2) {
                throw $this->advancedError("Не указан тип ставки в блоке «{$block}».");
            }

            $label = $this->normalizeLookup($parts[0]);
            $type = $this->advancedRateType($label)
                ?? throw $this->advancedError("Не распознан тип ставки «{$parts[0]}».");
            if (isset($settings[$type->value])) {
                throw $this->advancedError(sprintf('Тип ставки «%s» указан дважды.', self::RATE_LABELS[$type->value]));
            }

            $settings[$type->value] = [
                'rate_type' => $type->value,
                'is_advanced' => true,
                'range_calculation_method' => str_contains($label, 'прогрессив')
                    ? PayrollRangeCalculationMethod::PROGRESSIVE->value
                    : PayrollRangeCalculationMethod::THRESHOLD->value,
                'ranges' => $this->advancedRanges($parts[1]),
            ];
        }

        return $settings;
    }

    private function advancedRateType(string $label): ?EmployeeRateType
    {
        return match (true) {
            str_contains($label, 'оклад'), str_contains($label, 'weekly_salary') => EmployeeRateType::WEEKLY_SALARY,
            str_contains($label, 'контрол'), str_contains($label, 'supervised') => EmployeeRateType::SUPERVISED_HOURLY,
            str_contains($label, 'компани'), str_contains($label, 'company') => EmployeeRateType::COMPANY_HOURLY,
            str_contains($label, 'час'), str_contains($label, 'hourly') => EmployeeRateType::HOURLY,
            default => null,
        };
    }

    /** @return array<int, array<string, mixed>> */
    private function advancedRanges(string $value): array
    {
        $ranges = [];
        foreach (explode(';', $value) as $part) {
            $part = trim($part);
            if ($part === '') {
                continue;
            }

            // «0-40 = 500» или открытый диапазон «40+ = 700».
            $hours = '(\d+(?:[.,]\d+)?)';
            if (! preg_match('/^'.$hours.'\s*(?:[-–—]\s*'.$hours.'|\+)\s*=\s*(.+)$/u', $part, $matches)) {
                throw $this->advancedError("Некорректный диапазон «{$part}». Пример: 0-40 = 500; 40+ = 700.");
            }

            $rate = $this->nonNegativeKopecks($matches[3], 'advanced');
            if ($rate === null) {
                throw $this->advancedError("Не указана ставка в диапазоне «{$part}».");
            }

            $ranges[] = [
                'from_hours' => (float) str_replace(',', '.', $matches[1]),
                'to_hours' => $matches[2] !== '' ? (float) str_replace(',', '.', $matches[2]) : null,
                'rate' => $rate,
            ];
        }

        if ($ranges === []) {
            throw $this->advancedError('Не указаны диапазоны продвинутой ставки.');
        }

        return $ranges;
    }

    private function advancedError(string $message): ValidationException
    {
        return ValidationException::withMessages(['advanced' => [$message]]);
    }

    /**
     * Находит статью ФОТ по названию или полному пути «Фонд оплаты труда / ФОТ Менеджмент».
     * Выбирать можно только общую зарплатную статью компании и ее дочерние статьи.
     */
    private function resolveArticleId(string $value): string
    {
        $paths = $this->articlePaths();
        $needle = $this->normalizeArticlePath($value);
        if (isset($paths[$needle])) {
            return $paths[$needle];
        }

        $byName = collect($paths)->filter(
            fn (string $id, string $path): bool => str_ends_with(' / '.$path, ' / '.$needle),
        );
        if ($byName->count() > 1) {
            throw ValidationException::withMessages(['finance_article' => ["Найдено несколько статей \"{$value}\". Укажите полный путь через «/»."]]);
        }

        return $byName->first() ?? throw ValidationException::withMessages(['finance_article' => [
            "Статья \"{$value}\" не найдена среди статей фонда оплаты труда.",
        ]]);
    }

    /** @return array<string, string> */
    private function articlePaths(): array
    {
        if ($this->articlePaths !== null) {
            return $this->articlePaths;
        }

        $selectable = $this->financeArticles->selectableIds($this->company)->flip();
        $articles = FinanceArticle::query()
            ->where('company_id', $this->company->id)
            ->get(['id', 'name', 'parent_id'])
            ->keyBy(static fn (FinanceArticle $article): string => (string) $article->id);

        $paths = [];
        foreach ($articles as $id => $article) {
            if (! $selectable->has($id)) {
                continue;
            }

            $names = [];
            $visited = [];
            for ($current = $article; $current && ! isset($visited[$current->id]); $current = $articles->get((string) $current->parent_id)) {
                $visited[$current->id] = true;
                array_unshift($names, $current->name);
            }
            $paths[$this->normalizeArticlePath(implode('/', $names))] = (string) $id;
        }

        return $this->articlePaths = $paths;
    }

    private function normalizeArticlePath(string $value): string
    {
        $parts = array_filter(array_map(fn (string $part): string => $this->normalizeLookup($part), explode('/', $value)));

        return implode(' / ', $parts);
    }

    /**
     * Сохраняет остаток к выплате тем же методом, что и правка остатка в задолженности ФОТ.
     */
    private function saveOpening(User $employee, int $amount, array &$warnings): void
    {
        if (! PermissionAccess::canAll($this->actor, [
            UserPermission::EMPLOYEES_TABS_SALARY_VIEW->value,
            UserPermission::FINANCE_MANAGE->value,
        ])) {
            throw ValidationException::withMessages(['opening_balance' => ['Недостаточно прав для изменения остатка к выплате: нужно управление финансами.']]);
        }

        if ($this->payoutRepository->setting((string) $this->company->id)?->start_month === null) {
            $warnings[] = 'Месяц начала учёта выплат не настроен: остаток сохранён и будет учтён после настройки.';
        }

        $this->payouts->updateOpening($this->company, (string) $employee->id, $amount);
    }

    private function hoursScope(mixed $value): ?string
    {
        $text = $this->text($value);
        if ($text === null) {
            return null;
        }

        $normalized = $this->normalizeLookup($text);

        return match (true) {
            str_contains($normalized, 'контрол'), $normalized === 'supervised' => PayrollHoursScope::SUPERVISED->value,
            str_contains($normalized, 'компани'), $normalized === 'company' => PayrollHoursScope::COMPANY->value,
            str_contains($normalized, 'сво'), $normalized === 'own' => PayrollHoursScope::OWN->value,
            default => throw ValidationException::withMessages(['salary_distribution_scope' => [
                "Не распознано распределение оклада \"{$text}\". Допустимо: Свои часы, Часы под контролем, Часы всей компании.",
            ]]),
        };
    }

    private function boolean(mixed $value, string $field): ?bool
    {
        $text = $this->text($value);
        if ($text === null) {
            return null;
        }

        return match ($this->normalizeLookup($text)) {
            'да', 'yes', 'true', '1', '+' => true,
            'нет', 'no', 'false', '0' => false,
            default => throw ValidationException::withMessages([$field => ["Ожидается «Да» или «Нет», получено \"{$text}\"."]]),
        };
    }

    /**
     * Ставка в рублях в копейки. Ноль допустим, как и в форме ставки.
     */
    private function nonNegativeKopecks(mixed $value, string $field): ?int
    {
        $amount = $this->signedKopecks($value, $field);
        if ($amount !== null && $amount < 0) {
            throw ValidationException::withMessages([$field => ['Ставка не может быть отрицательной.']]);
        }

        return $amount;
    }

    /**
     * Сумма в рублях со знаком в копейки: минус в остатке означает переплату сотруднику.
     */
    private function signedKopecks(mixed $value, string $field): ?int
    {
        if (is_int($value) || is_float($value)) {
            return (int) round($value * 100);
        }

        $text = $this->text($value);
        if ($text === null) {
            return null;
        }

        $normalized = preg_replace('/руб(?:\.|лей|ля|ль)?/iu', '', $text) ?? '';
        $normalized = preg_replace('/[\s\x{00A0}\x{202F}₽]/u', '', $normalized) ?? '';
        $negative = (bool) preg_match('/^[\-−–—]/u', $normalized);
        $normalized = preg_replace('/^[+\-−–—]+/u', '', $normalized) ?? '';

        if (! preg_match('/^(\d+)(?:[,.](\d{1,2}))?$/', $normalized, $matches)) {
            throw ValidationException::withMessages([$field => ["Некорректная сумма \"{$text}\"."]]);
        }

        $amount = (int) $matches[1] * 100 + (isset($matches[2]) ? (int) str_pad($matches[2], 2, '0') : 0);

        return $negative ? -$amount : $amount;
    }

    private function normalizeLookup(mixed $value): string
    {
        return str_replace('ё', 'е', mb_strtolower(trim(preg_replace('/\s+/u', ' ', (string) $value) ?? '')));
    }

    /**
     * Инициатор импорта выступает автором ставки, как при ручном изменении.
     */
    protected function actor(DataImport $import): User
    {
        return User::withBlocked()->findOrFail($import->created_by_id);
    }

    private function loadContext(DataImport $import): void
    {
        if ($this->loadedImportId === (string) $import->id) {
            return;
        }

        $this->actor = $this->actor($import);
        $this->company = Company::query()->findOrFail($import->company_id);
        // Клиентские аккаунты не сотрудники, у архивных ставку меняет архивация.
        $this->employees = User::query()
            ->where('company_id', $import->company_id)
            ->whereNull('client_id')
            ->get();
        $this->articlePaths = null;
        $this->loadedImportId = (string) $import->id;
    }
}
