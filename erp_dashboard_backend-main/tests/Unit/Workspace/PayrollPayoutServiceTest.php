<?php

namespace Tests\Unit\Workspace;

use App\Enums\FinanceSource;
use App\Enums\FinanceType;
use App\Enums\PayrollPayoutKind;
use App\Models\Company;
use App\Models\PayrollPayout;
use App\Models\PayrollPayoutArticle;
use App\Models\User;
use App\Services\Workspace\PayrollPayoutArticleService;
use App\Services\Workspace\PayrollPayoutService;
use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

/**
 * Компания в Москве, приложение в UTC. Сегодня 13.10.2026, учет выплат с сентября.
 * Сотрудник e1 за сентябрь: закрытые недели 06.09, 13.09, 20.09, 27.09 и хвост 30.09,
 * плюс ручная премия 10.09. 15.09 - вторник, поэтому неделя 14-20.09 делится 2/7.
 */
class PayrollPayoutServiceTest extends TestCase
{
    private const SEP = '2026-09';

    private const OCT = '2026-10';

    private Company $company;

    private User $admin;

    private string $articleId;

    protected function setUp(): void
    {
        parent::setUp();

        config(['app.timezone' => 'UTC']);
        date_default_timezone_set('UTC');
        Carbon::setTestNow(Carbon::parse('2026-10-13 09:00:00', 'UTC'));

        $this->createSchema();
        DB::table('companies')->insert([
            ['id' => 'c1', 'status' => 'ACTIVE', 'timezone' => 'Europe/Moscow'],
            ['id' => 'c2', 'status' => 'ACTIVE', 'timezone' => 'Europe/Moscow'],
        ]);
        DB::table('users')->insert([
            ['id' => 'admin', 'company_id' => 'c1', 'name' => 'Анна', 'last_name' => 'Смирнова', 'status' => 'ACTIVE', 'archived_at' => null],
            ['id' => 'e1', 'company_id' => 'c1', 'name' => 'Илья', 'last_name' => 'Кузнецов', 'status' => 'ACTIVE', 'archived_at' => null],
            ['id' => 'e2', 'company_id' => 'c1', 'name' => 'Павел', 'last_name' => 'Гусев', 'status' => 'BLOCKED', 'archived_at' => '2026-09-20'],
            ['id' => 'x1', 'company_id' => 'c2', 'name' => 'Чужой', 'last_name' => 'Сотрудник', 'status' => 'ACTIVE', 'archived_at' => null],
        ]);

        $this->accrue('e1', '2026-09-06', 3000000);
        $this->accrue('e1', '2026-09-13', 3000000);
        DB::table('finance_article')->insert(['id' => 'bonus', 'name' => 'Премии']);
        $this->accrue('e1', '2026-09-10', 500000, FinanceSource::MANUAL, articleId: 'bonus');
        $this->accrue('e1', '2026-09-20', 3500000);
        $this->accrue('e1', '2026-09-27', 3000000);
        $this->accrue('e1', '2026-09-30', 1000000);
        $this->accrue('e1', '2026-10-04', 1500000);
        $this->accrue('e1', '2026-10-11', 3000000);
        $this->accrue('e1', '2026-08-30', 9900000);
        $this->accrue('e2', '2026-09-13', 5000000);
        $this->accrue('x1', '2026-09-13', 7700000, FinanceSource::PAYROLL_RECALCULATION, 'c2');
        // Поступление с сотрудником начислением не считается.
        DB::table('finance')->insert([
            'id' => 'income', 'company_id' => 'c1', 'employee_id' => 'e1', 'amount' => 4400000,
            'type' => FinanceType::ENTRANCE->value, 'source' => FinanceSource::MANUAL->value, 'dateOfPayment' => '2026-09-12',
        ]);

        $this->company = Company::query()->findOrFail('c1');
        $this->admin = User::query()->findOrFail('admin');
        $this->service()->updateSettings($this->company, self::SEP);
        $this->articleId = (string) PayrollPayoutArticle::query()->where('company_id', 'c1')->where('name', 'Аванс на карту')->value('id');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        foreach (['payroll_payout_closings', 'payroll_payout_openings', 'payroll_payout_plans', 'payroll_payouts', 'payroll_payout_articles', 'payroll_payout_settings', 'finance', 'finance_article', 'users', 'companies'] as $table) {
            Schema::dropIfExists($table);
        }

        parent::tearDown();
    }

    public function test_sheet_is_empty_until_accounting_start_is_set(): void
    {
        $other = Company::query()->findOrFail('c2');
        $sheet = $this->service()->sheet($other, null);

        $this->assertNull($sheet['start_month']);
        $this->assertSame([], $sheet['rows']);
        $this->assertSame('2026-09', $this->service()->settings($other)['first_accrual_month']);
    }

    public function test_start_month_creates_default_articles_once_and_rejects_future(): void
    {
        $this->assertSame(8, PayrollPayoutArticle::query()->where('company_id', 'c1')->count());

        $this->service()->updateSettings($this->company, '2026-08');
        $this->assertSame(8, PayrollPayoutArticle::query()->where('company_id', 'c1')->count());
        $this->assertSame('2026-08', $this->service()->settings($this->company)['start_month']);

        $this->expectException(ValidationException::class);
        $this->service()->updateSettings($this->company, '2026-11');
    }

    public function test_sheet_shows_accrual_advance_and_settlement(): void
    {
        $sheet = $this->service()->sheet($this->company, self::SEP);
        $row = $this->row($sheet, 'e1');

        $this->assertSame(self::SEP, $sheet['month']);
        $this->assertSame('2026-10-13', $sheet['today']);
        $this->assertSame(['Гусев', 'Кузнецов'], array_column(array_column($sheet['rows'], 'employee'), 'last_name'));
        $this->assertTrue($this->row($sheet, 'e2')['employee']['is_archived']);
        $this->assertSame(14000000, $row['accrued'], 'Август до начала учета и поступление не входят.');
        // 06.09 + 13.09 + премия 10.09 + 2/7 недели 14-20.09.
        $this->assertSame(7500000, $row['accrued_first_half']);
        $this->assertSame(7500000, $row['advance']['amount']);
        $this->assertSame(6500000, $row['settlement']['amount']);
        $this->assertSame('none', $row['advance']['status']);
        $this->assertSame(14000000, $row['unpaid']);
        $this->assertSame(0, $row['carry_in']);
    }

    public function test_sheet_explains_accrual_by_periods_and_operations(): void
    {
        $row = $this->row($this->service()->sheet($this->company, self::SEP), 'e1');
        $parts = $row['accrual_parts'];

        $this->assertSame(
            ['2026-09-01', '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28', null],
            array_map(static fn (array $part): ?string => $part['from'] ?? null, $parts),
            'Недели обрезаются границами месяца, ручная операция идет отдельной строкой после них.',
        );
        $this->assertSame(['2026-09-06', '2026-09-13', '2026-09-20', '2026-09-27', '2026-09-30'], array_column($parts, 'to'));
        $this->assertSame(
            ['type' => 'operation', 'date' => '2026-09-10', 'source' => 'MANUAL', 'article' => 'Премии', 'amount' => 500000, 'first_half' => 500000],
            $parts[5],
        );
        // 15.09 - вторник: из недели 14-20.09 в аванс идут 2 дня из 7.
        $this->assertSame(2, $parts[2]['split_days']);
        $this->assertSame(1000000, $parts[2]['first_half']);
        $this->assertNull($parts[1]['split_days']);
        $this->assertTrue($parts[2]['is_closed']);
        $this->assertSame($row['accrued'], array_sum(array_column($parts, 'amount')));
        $this->assertSame($row['accrued_first_half'], array_sum(array_column($parts, 'first_half')));

        // Открытая неделя начислена по дням и собирается в один период.
        $this->accrue('e1', '2026-10-12', 100000, FinanceSource::PAYROLL_DAILY);
        $this->accrue('e1', '2026-10-13', 100000, FinanceSource::PAYROLL_DAILY);
        $october = $this->row($this->service()->sheet($this->company, self::OCT), 'e1')['accrual_parts'];
        $this->assertSame(['2026-10-01', '2026-10-05', '2026-10-12'], array_column($october, 'from'));
        $this->assertSame(200000, $october[2]['amount']);
        $this->assertSame('2026-10-18', $october[2]['to']);
        $this->assertFalse($october[2]['is_closed']);
    }

    public function test_closed_month_keeps_amounts_and_moves_recalculation_to_next_month(): void
    {
        $this->assertNull($this->service()->sheet($this->company, self::SEP)['closing']);
        $this->pay('e1', 7500000, PayrollPayoutKind::ADVANCE, self::SEP, '2026-09-18');

        $this->service()->closeMonth($this->company, $this->admin, self::SEP);
        $this->service()->closeMonth($this->company, $this->admin, self::SEP);

        $sheet = $this->service()->sheet($this->company, self::SEP);
        $row = $this->row($sheet, 'e1');
        $this->assertSame('Анна Смирнова', $sheet['closing']['closed_by']['name']);
        $this->assertNotNull($sheet['closing']['closed_at']);
        $this->assertNull($this->service()->sheet($this->company, self::OCT)['closing']);
        $this->assertTrue($row['settlement']['is_fixed'], 'Невыплаченный расчет после фиксации месяца закреплен.');
        $this->assertFalse($row['settlement']['is_manual']);
        $this->assertCount(2, $sheet['rows'], 'Сотрудники без начислений в зафиксированном месяце не появляются.');

        // Перерасчет после фиксации: суммы месяца прежние, разница в переносе.
        $this->accrue('e1', '2026-09-27', 200000);
        $this->accrue('admin', '2026-09-27', 300000);
        $sheet = $this->service()->sheet($this->company, self::SEP);
        $row = $this->row($sheet, 'e1');
        $this->assertSame(6500000, $row['settlement']['amount']);
        $this->assertSame(6500000, $row['unpaid']);
        $this->assertSame(200000, $row['carry_out']);
        $late = $this->row($sheet, 'admin');
        $this->assertSame(0, $late['total_due'], 'Начисление, появившееся после фиксации, целиком уходит в перенос.');
        $this->assertSame(300000, $late['carry_out']);
        $this->assertSame(300000, $this->row($this->service()->sheet($this->company, self::OCT), 'admin')['carry_in']);

        // Выплата в зафиксированном месяце проводится, сумму изменить нельзя.
        $this->pay('e1', 6500000, PayrollPayoutKind::SETTLEMENT, self::SEP, '2026-10-09');
        try {
            $this->service()->updatePlan($this->company, 'e1', self::SEP, PayrollPayoutKind::SETTLEMENT, 6000000);
            $this->fail('Сумма в зафиксированном месяце не должна меняться.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('month', $exception->errors());
        }
    }

    public function test_reopened_month_follows_accruals_again_and_keeps_manual_amounts(): void
    {
        $this->service()->updatePlan($this->company, 'e2', self::SEP, PayrollPayoutKind::ADVANCE, 4000000);
        $this->pay('e1', 7500000, PayrollPayoutKind::ADVANCE, self::SEP, '2026-09-18');
        $this->service()->closeMonth($this->company, $this->admin, self::SEP);
        $this->accrue('e1', '2026-09-27', 200000);

        $this->service()->reopenMonth($this->company, self::SEP);
        $this->service()->reopenMonth($this->company, self::SEP);

        $sheet = $this->service()->sheet($this->company, self::SEP);
        $row = $this->row($sheet, 'e1');
        $this->assertNull($sheet['closing']);
        $this->assertSame(6700000, $row['settlement']['amount']);
        $this->assertFalse($row['settlement']['is_fixed']);
        $this->assertSame(0, $row['carry_out']);
        $this->assertTrue($row['advance']['is_fixed'], 'Полностью выплаченный аванс остается закрепленным.');
        $this->assertSame(7500000, $row['advance']['amount']);
        $manual = $this->row($sheet, 'e2');
        $this->assertTrue($manual['advance']['is_manual']);
        $this->assertSame(4000000, $manual['advance']['amount']);
        $this->assertFalse($manual['settlement']['is_fixed']);

        $this->service()->updatePlan($this->company, 'e1', self::SEP, PayrollPayoutKind::SETTLEMENT, 6000000);
        $this->assertSame(6000000, $this->row($this->service()->sheet($this->company, self::SEP), 'e1')['settlement']['amount']);
    }

    public function test_current_month_cannot_be_closed(): void
    {
        $this->expectException(ValidationException::class);
        $this->service()->closeMonth($this->company, $this->admin, self::OCT);
    }

    public function test_month_is_limited_to_accounting_period(): void
    {
        $this->assertSame(self::SEP, $this->service()->sheet($this->company, '2026-07')['month']);
        $this->assertSame(self::OCT, $this->service()->sheet($this->company, '2026-12')['month']);
        $this->assertSame(self::OCT, $this->service()->sheet($this->company, null)['month']);

        $this->expectException(ValidationException::class);
        $this->pay('e1', 1000, PayrollPayoutKind::ADVANCE, '2026-08');
    }

    public function test_paid_advance_is_fixed_and_partial_settlement_stays_calculated(): void
    {
        $this->pay('e1', 4000000, PayrollPayoutKind::ADVANCE, self::SEP, '2026-09-18');
        $this->pay('e1', 3500000, PayrollPayoutKind::ADVANCE, self::SEP, '2026-09-18');
        $this->pay('e1', 4000000, PayrollPayoutKind::SETTLEMENT, self::SEP, '2026-10-09');

        $row = $this->row($this->service()->sheet($this->company, self::SEP), 'e1');

        $this->assertSame('full', $row['advance']['status']);
        $this->assertTrue($row['advance']['is_fixed']);
        $this->assertFalse($row['advance']['is_manual']);
        $this->assertSame('part', $row['settlement']['status']);
        $this->assertSame(2500000, $row['settlement']['rest']);
        $this->assertFalse($row['settlement']['is_fixed'], 'Частично выплаченный расчет пересчитывается вместе с начислением.');
        $this->assertCount(3, $row['payouts']);
        $this->assertSame('2026-10-09', $row['payouts'][0]['paid_at']);
        $this->assertSame('Аванс на карту', $row['payouts'][0]['article']['name']);
        $this->assertSame('Анна Смирнова', $row['payouts'][0]['created_by']['name']);

        // Перерасчет месяца до полной выплаты меняет сумму к выплате.
        $this->accrue('e1', '2026-09-27', 200000);
        $row = $this->row($this->service()->sheet($this->company, self::SEP), 'e1');
        $this->assertSame(6700000, $row['settlement']['amount']);
        $this->assertSame(2700000, $row['unpaid']);
        $this->assertSame(0, $row['carry_out']);
    }

    public function test_recalculation_of_fully_paid_month_moves_to_next_month(): void
    {
        $this->pay('e1', 7500000, PayrollPayoutKind::ADVANCE, self::SEP, '2026-09-18');
        $this->pay('e1', 6500000, PayrollPayoutKind::SETTLEMENT, self::SEP, '2026-10-09');
        $this->accrue('e1', '2026-09-27', 200000);

        $september = $this->row($this->service()->sheet($this->company, self::SEP), 'e1');
        $october = $this->row($this->service()->sheet($this->company, self::OCT), 'e1');

        $this->assertSame(14200000, $september['accrued']);
        $this->assertSame(6500000, $september['settlement']['amount'], 'Выплаченная сумма после перерасчета не меняется.');
        $this->assertSame('full', $september['settlement']['status']);
        $this->assertSame(0, $september['unpaid']);
        $this->assertSame(200000, $september['carry_out']);
        $this->assertSame(200000, $october['carry_in']);
        // В октябре все начисления пока в первой половине, поэтому в расчете только перенос.
        $this->assertSame(4500000, $october['advance']['amount']);
        $this->assertSame(200000, $october['settlement']['amount']);

        // Возврат расчетной суммы открывает месяц: разница становится его остатком.
        $this->service()->updatePlan($this->company, 'e1', self::SEP, PayrollPayoutKind::SETTLEMENT, null);
        $september = $this->row($this->service()->sheet($this->company, self::SEP), 'e1');
        $this->assertSame(6700000, $september['settlement']['amount']);
        $this->assertSame(200000, $september['unpaid']);
        $this->assertSame(0, $september['carry_out']);
    }

    public function test_payout_before_period_end_does_not_fix_amounts(): void
    {
        // Октябрь еще идет: ранняя выплата не должна обрезать аванс и расчет.
        $this->pay('e1', 4500000, PayrollPayoutKind::ADVANCE, self::OCT, '2026-10-13');

        $row = $this->row($this->service()->sheet($this->company, self::OCT), 'e1');
        $this->assertSame('full', $row['advance']['status']);
        $this->assertFalse($row['advance']['is_fixed']);

        $this->accrue('e1', '2026-10-14', 300000, FinanceSource::PAYROLL_DAILY);
        $row = $this->row($this->service()->sheet($this->company, self::OCT), 'e1');
        $this->assertSame(4800000, $row['advance']['amount']);
        $this->assertSame('part', $row['advance']['status']);
    }

    public function test_manual_amounts_and_overpayment(): void
    {
        $this->service()->updatePlan($this->company, 'e1', self::SEP, PayrollPayoutKind::ADVANCE, 7000000);
        $row = $this->row($this->service()->sheet($this->company, self::SEP), 'e1');
        $this->assertTrue($row['advance']['is_manual']);
        $this->assertSame(7500000, $row['advance']['auto_amount']);
        $this->assertSame(7000000, $row['settlement']['amount'], 'Расчет пересчитывается после правки аванса.');

        $this->service()->updatePlan($this->company, 'e1', self::SEP, PayrollPayoutKind::SETTLEMENT, 6900000);
        $this->pay('e1', 7000000, PayrollPayoutKind::ADVANCE, self::SEP, '2026-09-18');
        $this->pay('e1', 7200000, PayrollPayoutKind::SETTLEMENT, self::SEP, '2026-10-09');

        $row = $this->row($this->service()->sheet($this->company, self::SEP), 'e1');
        $this->assertSame('over', $row['settlement']['status']);
        $this->assertSame(300000, $row['settlement']['over']);
        // 140000.00 начислено, выплачено 142000.00.
        $this->assertSame(-200000, $row['carry_out']);

        $this->service()->updatePlan($this->company, 'e1', self::SEP, PayrollPayoutKind::ADVANCE, null);
        $row = $this->row($this->service()->sheet($this->company, self::SEP), 'e1');
        $this->assertFalse($row['advance']['is_manual']);
        $this->assertSame(7500000, $row['advance']['amount']);
    }

    public function test_bulk_payout_and_deleted_payout(): void
    {
        $created = $this->service()->createPayouts($this->company, $this->admin, [
            'month' => self::SEP,
            'kind' => PayrollPayoutKind::ADVANCE->value,
            'article_id' => $this->articleId,
            'paid_at' => '2026-09-18',
            'comment' => ' общая выплата ',
            'items' => [
                ['employee_id' => 'e1', 'amount' => 7500000],
                ['employee_id' => 'e2', 'amount' => 5000000],
            ],
        ]);

        $this->assertCount(2, $created);
        $this->assertSame('общая выплата', $created[0]['comment']);

        $sheet = $this->service()->sheet($this->company, self::SEP);
        $this->assertSame('full', $this->row($sheet, 'e2')['advance']['status']);

        $payout = PayrollPayout::query()->where('employee_id', 'e2')->firstOrFail();
        $this->service()->deletePayout($this->company, $this->admin, $payout);

        $row = $this->row($this->service()->sheet($this->company, self::SEP), 'e2');
        $this->assertSame(0, $row['paid']);
        $this->assertSame([], $row['payouts']);
        $this->assertSame('admin', PayrollPayout::withTrashed()->where('employee_id', 'e2')->value('deleted_by'));
        $this->assertTrue($row['advance']['is_fixed'], 'Удаление выплаты не снимает зафиксированную сумму.');
        $this->assertSame('none', $row['advance']['status']);
    }

    public function test_debts_since_accounting_start(): void
    {
        $this->service()->updateOpening($this->company, 'e1', 1000000);
        $this->service()->updateOpening($this->company, 'e1', 1200000);
        $this->pay('e1', 7500000, PayrollPayoutKind::ADVANCE, self::SEP, '2026-09-18');
        $this->pay('e2', 5100000, PayrollPayoutKind::SETTLEMENT, self::SEP, '2026-09-21');

        $debts = $this->service()->debts($this->company);
        $e1 = $this->row($debts, 'e1');
        $e2 = $this->row($debts, 'e2');

        $this->assertSame(1200000, $e1['opening']);
        $this->assertSame(14000000 + 4500000, $e1['accrued']);
        $this->assertSame(7500000, $e1['paid']);
        $this->assertSame(1200000 + 18500000 - 7500000, $e1['debt']);
        $this->assertSame([self::OCT, self::SEP], array_column($e1['months'], 'month'));
        $this->assertSame(1200000, $e1['months'][1]['debt_in']);
        $this->assertSame(7700000, $e1['months'][1]['debt_out']);
        $this->assertSame(7700000, $e1['months'][0]['debt_in']);
        $this->assertCount(1, $e1['payouts']);
        $this->assertSame(self::SEP, $e1['payouts'][0]['month']);
        $this->assertSame(-100000, $e2['debt'], 'Переплата уволенному остается отрицательным остатком.');
        $this->assertCount(2, $debts['rows'], 'Сотрудники другой компании в отчет не попадают.');

        // Перенос начала учета исключает прошлые месяцы и их выплаты.
        $this->service()->updateSettings($this->company, self::OCT);
        $e1 = $this->row($this->service()->debts($this->company), 'e1');
        $this->assertSame(4500000, $e1['accrued']);
        $this->assertSame(0, $e1['paid']);
        $this->assertSame(1200000 + 4500000, $e1['debt']);
    }

    public function test_payouts_report_by_payment_date_article_and_employee(): void
    {
        $taxArticle = (string) PayrollPayoutArticle::query()->where('company_id', 'c1')->where('name', 'НДФЛ')->value('id');
        $this->pay('e1', 7500000, PayrollPayoutKind::ADVANCE, self::SEP, '2026-09-18');
        $this->pay('e2', 5000000, PayrollPayoutKind::ADVANCE, self::SEP, '2026-09-30');
        // Расчет за сентябрь, выданный в октябре, попадает в октябрь по дате выплаты.
        $this->pay('e1', 6000000, PayrollPayoutKind::SETTLEMENT, self::SEP, '2026-10-05');
        $this->service()->createPayouts($this->company, $this->admin, [
            'month' => self::OCT,
            'kind' => PayrollPayoutKind::ADVANCE->value,
            'article_id' => $taxArticle,
            'paid_at' => '2026-10-12',
            'items' => [['employee_id' => 'e1', 'amount' => 100000]],
        ]);
        $this->pay('e2', 2000000, PayrollPayoutKind::SETTLEMENT, self::SEP, '2026-10-01');
        $this->service()->deletePayout($this->company, $this->admin, PayrollPayout::query()->where('employee_id', 'e2')->where('amount', 2000000)->firstOrFail());

        $october = $this->service()->report($this->company, null, null);
        $this->assertSame('2026-10-01', $october['from']);
        $this->assertSame('2026-10-13', $october['to']);
        $this->assertSame(['amount' => 6100000, 'count' => 2], $october['total'], 'Удаленная выплата в отчет не попадает.');
        $this->assertSame(['2026-10-12', '2026-10-05'], array_column($october['rows'], 'paid_at'));
        $this->assertSame(self::SEP, $october['rows'][1]['month']);
        $this->assertSame('Илья', $october['rows'][1]['employee']['name']);
        $this->assertSame([6000000, 100000], array_column($october['by_article'], 'amount'));
        $this->assertSame('Аванс на карту', $october['by_article'][0]['article']['name']);
        $this->assertSame([['e1', 6100000, 2]], array_map(
            static fn (array $item): array => [$item['employee']['id'], $item['amount'], $item['count']],
            $october['by_employee'],
        ));

        $all = $this->service()->report($this->company, '2026-09-01', '2026-10-31');
        $this->assertSame(18600000, $all['total']['amount']);
        $this->assertSame(['e2', 'e1'], array_column(array_column($all['by_employee'], 'employee'), 'id'));
        $this->assertSame(['e2', 'e1'], array_column($all['filters']['employees'], 'id'));
        $this->assertCount(2, $all['filters']['articles']);

        $filtered = $this->service()->report($this->company, '2026-09-01', '2026-10-31', 'e1', $this->articleId);
        $this->assertSame(13500000, $filtered['total']['amount']);
        $this->assertCount(2, $filtered['filters']['employees'], 'Варианты фильтров не зависят от выбранных фильтров.');
        $this->assertSame(0, $this->service()->report($this->company, '2026-09-01', '2026-10-31', 'x1')['total']['count']);

        // Выплаты за месяцы до начала учета не показываются, как в задолженности.
        $this->service()->updateSettings($this->company, self::OCT);
        $this->assertSame(100000, $this->service()->report($this->company, '2026-09-01', '2026-10-31')['total']['amount']);
    }

    public function test_used_article_is_archived_and_cannot_be_chosen(): void
    {
        $articles = app(PayrollPayoutArticleService::class);
        $this->pay('e1', 1000, PayrollPayoutKind::ADVANCE, self::SEP);

        $used = PayrollPayoutArticle::query()->findOrFail($this->articleId);
        $unused = PayrollPayoutArticle::query()->where('company_id', 'c1')->where('name', 'НДФЛ')->firstOrFail();

        $this->assertNull($articles->delete($unused, 'c1'));
        $this->assertTrue($articles->delete($used, 'c1')['is_archived']);
        $this->assertSame(7, $articles->list('c1')->count());
        $this->assertSame(1, $articles->list('c1')->firstWhere('id', $this->articleId)['payouts_count']);

        try {
            $this->pay('e1', 1000, PayrollPayoutKind::ADVANCE, self::SEP);
            $this->fail('Выплата по архивной статье должна быть отклонена.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('article_id', $exception->errors());
        }

        $this->assertFalse($articles->restore($used, 'c1')['is_archived']);
        $this->pay('e1', 1000, PayrollPayoutKind::ADVANCE, self::SEP);
    }

    private function service(): PayrollPayoutService
    {
        return app(PayrollPayoutService::class);
    }

    /**
     * @return array<string, mixed>
     */
    private function row(array $report, string $employeeId): array
    {
        $row = collect($report['rows'])->firstWhere('employee.id', $employeeId);
        $this->assertNotNull($row, "Нет строки сотрудника {$employeeId}.");

        return $row;
    }

    private function pay(string $employeeId, int $amount, PayrollPayoutKind $kind, string $month, string $date = '2026-10-13'): void
    {
        $this->service()->createPayouts($this->company, $this->admin, [
            'month' => $month,
            'kind' => $kind->value,
            'article_id' => $this->articleId,
            'paid_at' => $date,
            'items' => [['employee_id' => $employeeId, 'amount' => $amount]],
        ]);
    }

    private function accrue(
        string $employeeId,
        string $date,
        int $amount,
        FinanceSource $source = FinanceSource::PAYROLL_RECALCULATION,
        string $companyId = 'c1',
        ?string $articleId = null,
    ): void {
        static $sequence = 0;

        DB::table('finance')->insert([
            'id' => 'f'.(++$sequence),
            'company_id' => $companyId,
            'employee_id' => $employeeId,
            'finance_article_id' => $articleId,
            'amount' => $amount,
            'type' => FinanceType::EXPENDITURE->value,
            'source' => $source->value,
            'dateOfPayment' => $date,
        ]);
    }

    private function createSchema(): void
    {
        Schema::create('companies', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('status');
            $table->string('timezone')->nullable();
        });
        Schema::create('users', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('company_id');
            $table->string('name')->nullable();
            $table->string('last_name')->nullable();
            $table->string('position')->nullable();
            $table->string('status');
            $table->date('archived_at')->nullable();
        });
        Schema::create('finance', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('company_id');
            $table->string('project_id')->nullable();
            $table->string('employee_id')->nullable();
            $table->string('finance_article_id')->nullable();
            $table->unsignedBigInteger('amount');
            $table->string('type');
            $table->string('source');
            $table->date('dateOfPayment');
        });

        Schema::create('finance_article', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('name');
        });

        // Таблицы выплат создаются боевыми миграциями, чтобы тест проверял и их.
        (require database_path('migrations/2026_10_14_120000_create_payroll_payout_tables.php'))->up();
        (require database_path('migrations/2026_10_14_180000_create_payroll_payout_closings_table.php'))->up();
    }
}
