<?php

namespace App\Services\Workspace;

use App\Enums\PayrollPayoutKind;
use App\Models\Company;
use App\Models\PayrollPayout;
use App\Models\PayrollPayoutArticle;
use App\Models\PayrollPayoutClosing;
use App\Models\PayrollPayoutOpening;
use App\Models\PayrollPayoutPlan;
use App\Models\PayrollPayoutSetting;
use App\Models\User;
use App\Repositories\Workspace\PayrollRepositories\PayrollPayoutRepository;
use App\Services\Payroll\Payouts\Data\PayrollPayoutMonth;
use App\Services\Payroll\Payouts\PayrollAccrualByMonth;
use App\Services\Payroll\Payouts\PayrollPayoutCalculator;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Ведомость выплат ФОТ и задолженность перед сотрудниками.
 *
 * Начисление берется из финансов и здесь не меняется. Выплаты хранятся отдельно и в ОФР
 * и аналитику не попадают: это исполнение уже учтенного расхода.
 */
class PayrollPayoutService
{
    public function __construct(
        private readonly PayrollPayoutRepository $repository,
        private readonly PayrollPayoutCalculator $calculator,
        private readonly PayrollPayoutArticleService $articles,
    ) {}

    /**
     * @return array{start_month:?string, current_month:string, first_accrual_month:?string}
     */
    public function settings(Company $company): array
    {
        return [
            'start_month' => $this->repository->setting((string) $company->id)?->start_month,
            'current_month' => $this->currentMonth($company),
            'first_accrual_month' => $this->repository->firstAccrualMonth((string) $company->id),
        ];
    }

    /**
     * @return array{start_month:?string, current_month:string, first_accrual_month:?string}
     */
    public function updateSettings(Company $company, string $startMonth): array
    {
        if ($startMonth > $this->currentMonth($company)) {
            throw ValidationException::withMessages([
                'start_month' => 'Месяц начала учета не может быть позже текущего.',
            ]);
        }

        DB::transaction(function () use ($company, $startMonth): void {
            $setting = $this->repository->setting((string) $company->id)
                ?? new PayrollPayoutSetting(['id' => (string) Str::uuid(), 'company_id' => $company->id]);
            $setting->start_month = $startMonth;
            $setting->save();

            $this->articles->ensureDefaults((string) $company->id);
        });

        return $this->settings($company);
    }

    /**
     * Ведомость за месяц: начислено, аванс, расчет и выплаты по каждому сотруднику.
     *
     * @return array<string, mixed>
     */
    public function sheet(Company $company, ?string $month): array
    {
        $start = $this->repository->setting((string) $company->id)?->start_month;
        $current = $this->currentMonth($company);
        $result = [
            'start_month' => $start,
            'current_month' => $current,
            'today' => $company->today(),
            'month' => $month ?? $current,
            'closing' => null,
            'rows' => [],
        ];

        if ($start === null) {
            return $result;
        }

        $month = max($start, min($month ?? $current, $current));
        $data = $this->load($company, $start, $month);
        $chains = $this->chains($data);
        $rows = [];

        foreach ($chains as $employeeId => $chain) {
            if (! $this->isEmptyRow($chain[$month])) {
                $rows[$employeeId] = $chain[$month];
            }
        }

        $payouts = $data['payouts']->where('period_month', $month)->groupBy('employee_id');
        $parts = PayrollAccrualByMonth::parts($data['accrual_rows']);
        $result['month'] = $month;
        $result['closing'] = $this->closingPayload($data['closings'][$month] ?? null);
        $result['rows'] = $this->repository->employees((string) $company->id, array_map('strval', array_keys($rows)))
            ->map(fn (User $employee): array => [
                'employee' => $this->employeePayload($employee),
                'carry_in' => $rows[$employee->id]->carryIn,
                'accrued' => $rows[$employee->id]->accrued,
                'accrued_first_half' => $rows[$employee->id]->firstHalf,
                'accrual_parts' => $parts[$employee->id][$month] ?? [],
                'advance' => $rows[$employee->id]->advance->toArray(),
                'settlement' => $rows[$employee->id]->settlement->toArray(),
                'total_due' => $rows[$employee->id]->totalDue,
                'paid' => $rows[$employee->id]->paid(),
                'unpaid' => $rows[$employee->id]->unpaid(),
                'carry_out' => $rows[$employee->id]->carryOut,
                'payouts' => $this->payoutsPayload($payouts->get($employee->id)),
            ])
            ->values()
            ->all();

        return $result;
    }

    /**
     * Задолженность перед сотрудниками с начала учета: начислено, выплачено и остаток
     * с разбивкой по месяцам и историей выплат.
     *
     * @return array<string, mixed>
     */
    public function debts(Company $company): array
    {
        $start = $this->repository->setting((string) $company->id)?->start_month;
        $current = $this->currentMonth($company);
        $result = [
            'start_month' => $start,
            'current_month' => $current,
            'today' => $company->today(),
            'rows' => [],
        ];

        if ($start === null) {
            return $result;
        }

        $data = $this->load($company, $start, $current);
        $chains = $this->chains($data);
        $payouts = $data['payouts']->groupBy('employee_id');
        $summaries = [];

        foreach ($chains as $employeeId => $chain) {
            $accrued = 0;
            $paid = 0;
            foreach ($chain as $row) {
                $accrued += $row->accrued;
                $paid += $row->paid();
            }

            $opening = $data['openings'][$employeeId] ?? 0;
            if ($accrued === 0 && $paid === 0 && $opening === 0) {
                continue;
            }

            $summaries[$employeeId] = [
                'opening' => $opening,
                'accrued' => $accrued,
                'paid' => $paid,
                'debt' => $opening + $accrued - $paid,
                'months' => array_map(static fn (PayrollPayoutMonth $row): array => [
                    'month' => $row->month,
                    'debt_in' => $row->debtIn,
                    'accrued' => $row->accrued,
                    'paid' => $row->paid(),
                    'debt_out' => $row->debtOut,
                ], array_reverse(array_values($chain))),
            ];
        }

        $result['rows'] = $this->repository->employees((string) $company->id, array_map('strval', array_keys($summaries)))
            ->map(fn (User $employee): array => [
                'employee' => $this->employeePayload($employee),
                ...$summaries[$employee->id],
                'payouts' => $this->payoutsPayload($payouts->get($employee->id)),
            ])
            ->values()
            ->all();

        return $result;
    }

    /**
     * Отчет по выплатам за период по дате выплаты: список выплат и итоги по статьям
     * и сотрудникам. Без дат берется текущий месяц компании.
     *
     * @return array<string, mixed>
     */
    public function report(
        Company $company,
        ?string $from,
        ?string $to,
        ?string $employeeId = null,
        ?string $articleId = null,
    ): array {
        $companyId = (string) $company->id;
        $start = $this->repository->setting($companyId)?->start_month;
        $today = $company->today();
        $from ??= substr($today, 0, 7).'-01';
        $to ??= $today;
        $result = [
            'start_month' => $start,
            'today' => $today,
            'from' => $from,
            'to' => $to,
            'rows' => [],
            'by_article' => [],
            'by_employee' => [],
            'total' => ['amount' => 0, 'count' => 0],
            'filters' => ['employees' => [], 'articles' => []],
        ];

        if ($start === null) {
            return $result;
        }

        $payouts = $this->repository->paidBetween($companyId, $start, $from, $to, $employeeId, $articleId);
        $filterIds = $this->repository->payoutFilterIds($companyId, $start);
        $employees = $this->repository->employees($companyId, $filterIds['employee_ids'])->keyBy('id');
        $articles = PayrollPayoutArticle::query()
            ->where('company_id', $companyId)
            ->whereIn('id', $filterIds['article_ids'])
            ->orderBy('name')
            ->get();
        $articlePayload = static fn (?PayrollPayoutArticle $article, string $id): array => [
            'id' => $id,
            'name' => $article?->name,
            'is_archived' => $article?->archived_at !== null,
        ];
        $rowsPayload = $this->payoutsPayload($payouts);

        foreach ($rowsPayload as $index => $row) {
            $employee = $employees->get($row['employee_id']);
            $rowsPayload[$index]['employee'] = $employee ? $this->employeePayload($employee) : null;
        }

        $result['rows'] = $rowsPayload;
        $result['total'] = ['amount' => (int) $payouts->sum('amount'), 'count' => $payouts->count()];
        $result['by_article'] = $payouts
            ->groupBy('payroll_payout_article_id')
            ->map(static fn (Collection $items, string $id): array => [
                'article' => $articlePayload($items->first()->article, $id),
                'amount' => (int) $items->sum('amount'),
                'count' => $items->count(),
            ])
            ->sortByDesc('amount')
            ->values()
            ->all();
        $byEmployee = $payouts->groupBy('employee_id');
        $result['by_employee'] = $employees
            ->filter(static fn (User $employee): bool => $byEmployee->has($employee->id))
            ->map(fn (User $employee): array => [
                'employee' => $this->employeePayload($employee),
                'amount' => (int) $byEmployee[$employee->id]->sum('amount'),
                'count' => $byEmployee[$employee->id]->count(),
            ])
            ->values()
            ->all();
        $result['filters'] = [
            'employees' => $employees->map(fn (User $employee): array => $this->employeePayload($employee))->values()->all(),
            'articles' => $articles->map(static fn (PayrollPayoutArticle $article): array => $articlePayload($article, (string) $article->id))->all(),
        ];

        return $result;
    }

    /**
     * Проводит выплаты одного вида за месяц: одну или сразу нескольким сотрудникам.
     *
     * @param  array{month:string, kind:string, article_id:string, paid_at:string, comment?:?string, items:list<array{employee_id:string, amount:int}>}  $data
     * @return list<array<string, mixed>>
     */
    public function createPayouts(Company $company, User $actor, array $data): array
    {
        $month = $data['month'];
        $this->assertMonthInAccounting($company, $month);

        $article = PayrollPayoutArticle::query()
            ->where('company_id', $company->id)
            ->whereNull('archived_at')
            ->find($data['article_id']);
        if (! $article) {
            throw ValidationException::withMessages([
                'article_id' => 'Выберите действующую статью выплаты ФОТ.',
            ]);
        }

        $kind = PayrollPayoutKind::from($data['kind']);
        $comment = trim((string) ($data['comment'] ?? ''));

        $created = DB::transaction(function () use ($company, $actor, $data, $month, $kind, $article, $comment): array {
            $created = [];

            foreach ($data['items'] as $item) {
                $created[] = PayrollPayout::query()->create([
                    'id' => (string) Str::uuid(),
                    'company_id' => $company->id,
                    'employee_id' => $item['employee_id'],
                    'period_month' => $month,
                    'kind' => $kind,
                    'amount' => (int) $item['amount'],
                    'paid_at' => $data['paid_at'],
                    'payroll_payout_article_id' => $article->id,
                    'comment' => $comment !== '' ? $comment : null,
                    'created_by' => $actor->id,
                ]);

                $this->fixPaidAmounts($company, (string) $item['employee_id'], $month);
            }

            return $created;
        });

        return $this->payoutsPayload(
            (new EloquentCollection($created))->load(['article', 'creator']),
        );
    }

    public function deletePayout(Company $company, User $actor, PayrollPayout $payout): void
    {
        if ((string) $payout->company_id !== (string) $company->id) {
            throw new NotFoundHttpException;
        }

        // Зафиксированные суммы не снимаются: удаление часто означает исправление даты или статьи.
        $payout->deleted_by = $actor->id;
        $payout->save();
        $payout->delete();
    }

    /**
     * Задает сумму аванса или расчета вручную либо возвращает расчетную (amount = null).
     */
    public function updatePlan(Company $company, string $employeeId, string $month, PayrollPayoutKind $kind, ?int $amount): void
    {
        $this->assertMonthInAccounting($company, $month);
        if ($this->repository->closings((string) $company->id, $month, $month)->isNotEmpty()) {
            throw ValidationException::withMessages([
                'month' => 'Месяц зафиксирован. Снимите фиксацию, чтобы изменить сумму.',
            ]);
        }

        $column = $kind === PayrollPayoutKind::ADVANCE ? 'advance' : 'settlement';

        DB::transaction(function () use ($company, $employeeId, $month, $column, $amount): void {
            $plan = $this->plan($company, $employeeId, $month);
            $plan->{$column.'_amount'} = $amount;
            $plan->{$column.'_is_manual'} = $amount !== null;
            $this->savePlan($plan);

            if ($amount === null) {
                // Полностью выплаченная сумма после сброса закрепляется заново по текущему расчету.
                $this->fixPaidAmounts($company, $employeeId, $month);
            }
        });
    }

    /**
     * Фиксирует месяц: закрепляет суммы аванса и расчета всех сотрудников и запрещает их менять.
     * Перерасчет начислений после этого уходит переносом на следующий месяц.
     */
    public function closeMonth(Company $company, User $actor, string $month): void
    {
        $this->assertMonthInAccounting($company, $month);
        if ($month >= $this->currentMonth($company)) {
            throw ValidationException::withMessages([
                'month' => 'Зафиксировать можно только завершившийся месяц.',
            ]);
        }

        DB::transaction(function () use ($company, $actor, $month): void {
            $companyId = (string) $company->id;
            if ($this->repository->closings($companyId, $month, $month)->isNotEmpty()) {
                return;
            }

            $start = $this->repository->setting($companyId)->start_month;

            foreach ($this->chains($this->load($company, $start, $month)) as $employeeId => $chain) {
                $row = $chain[$month];
                if ($this->isEmptyRow($row)) {
                    continue;
                }

                $plan = $this->plan($company, $employeeId, $month);
                $plan->advance_amount ??= $row->advance->due;
                $plan->settlement_amount ??= $row->settlement->due;
                $this->savePlan($plan);
            }

            PayrollPayoutClosing::query()->create([
                'id' => (string) Str::uuid(),
                'company_id' => $companyId,
                'period_month' => $month,
                'closed_by' => $actor->id,
            ]);
        });
    }

    /**
     * Снимает фиксацию месяца: суммы без ручной правки снова считаются по начислениям.
     * Выплаты и суммы, введенные вручную, остаются.
     */
    public function reopenMonth(Company $company, string $month): void
    {
        $this->assertMonthInAccounting($company, $month);

        DB::transaction(function () use ($company, $month): void {
            $companyId = (string) $company->id;
            $closings = $this->repository->closings($companyId, $month, $month);
            if ($closings->isEmpty()) {
                return;
            }

            $closings->each->delete();

            foreach ($this->repository->plans($companyId, $month, $month) as $plan) {
                if (! $plan->advance_is_manual) {
                    $plan->advance_amount = null;
                }
                if (! $plan->settlement_is_manual) {
                    $plan->settlement_amount = null;
                }
                $this->savePlan($plan);
            }

            // Полностью выплаченные суммы закрепляются заново, уже по текущим начислениям.
            $paidEmployeeIds = $this->repository->payouts($companyId, $month, $month)->pluck('employee_id')->unique();
            foreach ($paidEmployeeIds as $employeeId) {
                $this->fixPaidAmounts($company, (string) $employeeId, $month);
            }
        });
    }

    public function updateOpening(Company $company, string $employeeId, int $amount): void
    {
        $opening = PayrollPayoutOpening::query()->where('employee_id', $employeeId)->first()
            ?? new PayrollPayoutOpening(['id' => (string) Str::uuid(), 'employee_id' => $employeeId]);
        $opening->company_id = $company->id;
        $opening->amount = $amount;
        $opening->save();
    }

    /**
     * Закрепляет суммы, которые уже выплачены полностью, чтобы поздний перерасчет месяца
     * не менял закрытую ведомость, а уходил переносом на следующий месяц.
     *
     * Аванс закрепляется после 15-го числа, расчет - после конца месяца: до этого начисление
     * еще растет, и ранняя выплата не должна обрезать сумму.
     */
    private function fixPaidAmounts(Company $company, string $employeeId, string $month): void
    {
        $start = $this->repository->setting((string) $company->id)?->start_month;
        if ($start === null || $month < $start) {
            return;
        }

        $row = $this->chains($this->load($company, $start, $month, [$employeeId]))[$employeeId][$month] ?? null;
        if (! $row) {
            return;
        }

        $today = $company->today();
        $monthEnded = $today > $this->lastDay($month);
        $advancePeriodEnded = $today > $month.'-15';
        $plan = $this->plan($company, $employeeId, $month);

        if ($monthEnded && $row->isFullyPaid()) {
            $plan->advance_amount ??= $row->advance->due;
            $plan->settlement_amount ??= $row->settlement->due;
        } elseif ($advancePeriodEnded && $row->advance->paid > 0 && $row->advance->paid >= $row->advance->due) {
            $plan->advance_amount ??= $row->advance->due;
        }

        $this->savePlan($plan);
    }

    private function plan(Company $company, string $employeeId, string $month): PayrollPayoutPlan
    {
        return PayrollPayoutPlan::query()
            ->where('employee_id', $employeeId)
            ->where('period_month', $month)
            ->first()
            ?? new PayrollPayoutPlan([
                'id' => (string) Str::uuid(),
                'company_id' => $company->id,
                'employee_id' => $employeeId,
                'period_month' => $month,
                'advance_is_manual' => false,
                'settlement_is_manual' => false,
            ]);
    }

    private function savePlan(PayrollPayoutPlan $plan): void
    {
        if ($plan->advance_amount === null && $plan->settlement_amount === null) {
            if ($plan->exists) {
                $plan->delete();
            }

            return;
        }

        $plan->save();
    }

    /**
     * Загружает начисления, выплаты, зафиксированные суммы и входящие остатки за период учета.
     *
     * @param  list<string>|null  $employeeIds
     * @return array{months:list<string>, accruals:array, accrual_rows:Collection<int, object>, paid:array, plans:array, openings:array<string, int>, closings:array<string, PayrollPayoutClosing>, payouts:EloquentCollection<int, PayrollPayout>}
     */
    private function load(Company $company, string $start, string $to, ?array $employeeIds = null): array
    {
        $companyId = (string) $company->id;
        $payouts = $this->repository->payouts($companyId, $start, $to, $employeeIds);
        $paid = [];
        foreach ($payouts as $payout) {
            $kind = $payout->kind === PayrollPayoutKind::ADVANCE ? 'advance' : 'settlement';
            $paid[(string) $payout->employee_id][$payout->period_month] ??= ['advance' => 0, 'settlement' => 0];
            $paid[(string) $payout->employee_id][$payout->period_month][$kind] += (int) $payout->amount;
        }

        $plans = [];
        foreach ($this->repository->plans($companyId, $start, $to, $employeeIds) as $plan) {
            $plans[(string) $plan->employee_id][$plan->period_month] = [
                'advance' => $plan->advance_amount,
                'advance_manual' => (bool) $plan->advance_is_manual,
                'settlement' => $plan->settlement_amount,
                'settlement_manual' => (bool) $plan->settlement_is_manual,
            ];
        }

        $accrualRows = $this->repository->accrualRows($companyId, $start.'-01', $this->lastDay($to), $employeeIds);

        return [
            'months' => $this->months($start, $to),
            'accruals' => PayrollAccrualByMonth::fromRows($accrualRows),
            'accrual_rows' => $accrualRows,
            'paid' => $paid,
            'plans' => $plans,
            'openings' => $this->repository->openings($companyId, $employeeIds),
            'closings' => $this->repository->closings($companyId, $start, $to)->keyBy('period_month')->all(),
            'payouts' => $payouts,
        ];
    }

    /**
     * @param  array{months:list<string>, accruals:array, paid:array, plans:array, openings:array<string, int>, closings:array<string, PayrollPayoutClosing>}  $data
     * @return array<string, array<string, PayrollPayoutMonth>> сотрудник => месяц => строка ведомости
     */
    private function chains(array $data): array
    {
        $employeeIds = array_keys($data['accruals'] + $data['paid'] + $data['plans'] + $data['openings']);
        $chains = [];

        foreach ($employeeIds as $employeeId) {
            $employeeId = (string) $employeeId;
            $plans = $data['plans'][$employeeId] ?? [];
            // У кого на момент фиксации месяца строки не было, тот зафиксирован с нулевыми суммами:
            // начисление, появившееся позже, целиком уходит переносом.
            foreach (array_keys($data['closings']) as $closedMonth) {
                $plans[$closedMonth] ??= ['advance' => 0, 'advance_manual' => false, 'settlement' => 0, 'settlement_manual' => false];
            }

            $chains[$employeeId] = $this->calculator->chain(
                opening: $data['openings'][$employeeId] ?? 0,
                months: $data['months'],
                accruals: $data['accruals'][$employeeId] ?? [],
                plans: $plans,
                paid: $data['paid'][$employeeId] ?? [],
            );
        }

        return $chains;
    }

    /** Строка без начислений, переноса, выплат и сумм к выплате в ведомость не выводится. */
    private function isEmptyRow(PayrollPayoutMonth $row): bool
    {
        return $row->accrued === 0 && $row->carryIn === 0 && $row->paid() === 0
            && $row->advance->due === 0 && $row->settlement->due === 0;
    }

    /**
     * @return array{closed_at:?string, closed_by:?array{id:string, name:string}}|null
     */
    private function closingPayload(?PayrollPayoutClosing $closing): ?array
    {
        if (! $closing) {
            return null;
        }

        $closer = $closing->closer;

        return [
            'closed_at' => $closing->created_at?->toIso8601String(),
            'closed_by' => $closer ? [
                'id' => (string) $closer->id,
                'name' => trim($closer->first_name.' '.$closer->last_name),
            ] : null,
        ];
    }

    private function assertMonthInAccounting(Company $company, string $month): void
    {
        $start = $this->repository->setting((string) $company->id)?->start_month;

        if ($start === null) {
            throw ValidationException::withMessages([
                'month' => 'Сначала укажите месяц начала учета выплат.',
            ]);
        }

        if ($month < $start || $month > $this->currentMonth($company)) {
            throw ValidationException::withMessages([
                'month' => 'Месяц должен быть между началом учета выплат и текущим месяцем.',
            ]);
        }
    }

    /** Текущий месяц в часовом поясе компании в формате ГГГГ-ММ. */
    private function currentMonth(Company $company): string
    {
        return substr($company->today(), 0, 7);
    }

    /**
     * @return list<string>
     */
    private function months(string $from, string $to): array
    {
        $months = [];
        $cursor = Carbon::createFromFormat('!Y-m-d', $from.'-01', 'UTC');

        while ($cursor->format('Y-m') <= $to) {
            $months[] = $cursor->format('Y-m');
            $cursor->addMonthNoOverflow();
        }

        return $months;
    }

    private function lastDay(string $month): string
    {
        return Carbon::createFromFormat('!Y-m-d', $month.'-01', 'UTC')->endOfMonth()->toDateString();
    }

    /**
     * @return array<string, mixed>
     */
    private function employeePayload(User $employee): array
    {
        return [
            'id' => (string) $employee->id,
            'name' => $employee->name,
            'first_name' => $employee->first_name,
            'last_name' => $employee->last_name,
            'position' => $employee->position,
            'is_archived' => $employee->archived_at !== null,
        ];
    }

    /**
     * @param  iterable<PayrollPayout>|null  $payouts
     * @return list<array<string, mixed>>
     */
    private function payoutsPayload(?iterable $payouts): array
    {
        $result = [];

        foreach ($payouts ?? [] as $payout) {
            $creator = $payout->creator;
            $result[] = [
                'id' => (string) $payout->id,
                'employee_id' => (string) $payout->employee_id,
                'month' => $payout->period_month,
                'kind' => $payout->kind->value,
                'amount' => (int) $payout->amount,
                'paid_at' => $payout->paid_at->toDateString(),
                'article' => [
                    'id' => (string) $payout->payroll_payout_article_id,
                    'name' => $payout->article?->name,
                ],
                'comment' => $payout->comment,
                'created_by' => $creator ? [
                    'id' => (string) $creator->id,
                    // Аксессоры делят имя на части сами: поле name может уже содержать фамилию.
                    'name' => trim($creator->first_name.' '.$creator->last_name),
                ] : null,
            ];
        }

        return $result;
    }
}
