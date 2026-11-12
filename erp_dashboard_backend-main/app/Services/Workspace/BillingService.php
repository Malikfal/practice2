<?php

namespace App\Services\Workspace;

use App\Enums\InvoiceStatus;
use App\Enums\UserStatus;
use App\Models\Company;
use App\Models\Invoice;
use App\Models\Subscription;
use App\Models\Tariff;
use App\Models\User;
use App\Repositories\Workspace\ProjectAssignmentHistoryRepository;
use App\Services\Payroll\EmployeeArchiveRateService;
use Barryvdh\DomPDF\Facade\Pdf;
use Barryvdh\DomPDF\PDF as PDFResponse;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class BillingService
{
    public function __construct(
        private readonly EmployeeArchiveRateService $archiveRates,
        private readonly ProjectAssignmentHistoryRepository $projectAssignments,
    ) {}

    public function getAvailableTariffs(User $user): Collection
    {
        $currentTariffId = $user->company?->tariff_id;

        return Tariff::where('is_active', true)
            ->where(function ($query) use ($currentTariffId) {
                $query->where('is_public', true);
                if ($currentTariffId) {
                    $query->orWhere('id', $currentTariffId);
                }
            })
            ->orderByRaw('CASE WHEN plan = ? THEN 0 ELSE 1 END', [Tariff::PLAN_FREE])
            ->orderBy('price')
            ->get();
    }

    /**
     * Переводит компанию на ФРИ сразу, без счёта: подписка бессрочная.
     * Оплаченные дни ПРО не сохраняются. Если сотрудников больше лимита, переход запрещён,
     * чтобы не архивировать людей молча; суперадмин может передать $enforceLimit = true.
     */
    public function activateFreeTariff(Company $company, Tariff $tariff, bool $enforceLimit = false): void
    {
        if (! $tariff->isFree()) {
            throw new \InvalidArgumentException('Тариф не бесплатный.');
        }

        if (! $enforceLimit && $tariff->max_employees !== null) {
            $activeCount = $company->employees()->where('status', UserStatus::ACTIVE)->count();
            if ($activeCount > $tariff->max_employees) {
                throw ValidationException::withMessages([
                    'tariff_id' => ["На тарифе {$tariff->name} можно до ".($tariff->max_employees - 1)." + 1 активных пользователей, сейчас {$activeCount}. Отправьте в архив сотрудников: ".($activeCount - $tariff->max_employees).', и повторите.'],
                ]);
            }
        }

        DB::transaction(function () use ($company, $tariff, $enforceLimit): void {
            Subscription::updateOrCreate(
                ['company_id' => $company->id],
                [
                    'tariff_id' => $tariff->id,
                    'starts_at' => now(),
                    'ends_at' => null,
                ]
            );

            $company->update(['tariff_id' => $tariff->id]);

            if ($enforceLimit) {
                $this->enforceTariffLimits($company);
            }
        });
    }

    public function getCurrentSubscription(User $user): ?array
    {
        $company = $user->company;
        $subscription = $company->subscription()->with('tariff')->first();

        $pendingInvoice = Invoice::where('company_id', $company->id)
            ->where('status', InvoiceStatus::AWAITING_PAYMENT)
            ->with('tariff')
            ->orderByDesc('created_at')
            ->first();

        return [
            'subscription' => $subscription,
            'active_employees_count' => $company->employees()->where('status', UserStatus::ACTIVE)->count(),
            'pending_invoice' => $pendingInvoice,
        ];
    }

    public function getInvoices(User $user, int $perPage = 10): LengthAwarePaginator
    {

        return Invoice::with('tariff')
            ->where('company_id', $user->company_id)
            ->orderByDesc('created_at')
            ->paginate($perPage);
    }

    public function calculateTariffChange(Company $company, array $data): array
    {
        $newTariff = Tariff::findOrFail($data['tariff_id']);
        $periodMonths = $data['period_months'];
        $subscription = $company->subscription;

        if ($newTariff->isFree()) {
            return ['base_amount' => 0, 'discount' => 0, 'amount_to_pay' => 0, 'bonus_days' => 0];
        }

        $baseAmount = $newTariff->price * $periodMonths;
        $discount = 0;

        if ($subscription && $subscription->tariff_id !== $newTariff->id
            && $subscription->ends_at && $subscription->ends_at->isFuture()) {
            $daysLeft = (int) now()->startOfDay()->diffInDays($subscription->ends_at->copy()->startOfDay());
            $currentTariff = $subscription->tariff;

            if ($currentTariff && $currentTariff->price > 0 && $daysLeft > 0) {
                $discount = (int) round(($currentTariff->price * $daysLeft) / 30);
            }
        }

        $finalAmount = $baseAmount - $discount;
        $bonusDays = 0;

        if ($finalAmount < 0) {
            $leftoverMoney = abs($finalAmount);
            $finalAmount = 0;

            if ($newTariff->price > 0) {
                $bonusDays = (int) round(($leftoverMoney * 30) / $newTariff->price);
            }
        }

        return [
            'base_amount' => $baseAmount,
            'discount' => $discount,
            'amount_to_pay' => $finalAmount,
            'bonus_days' => $bonusDays,
        ];
    }

    public function requestTariffChange(Company $company, array $data): Invoice
    {
        $newTariff = Tariff::findOrFail($data['tariff_id']);
        $periodMonths = $data['period_months'];

        $calculation = $this->calculateTariffChange($company, $data);

        $periodDays = ($periodMonths * 30) + $calculation['bonus_days'];

        $status = InvoiceStatus::AWAITING_PAYMENT;
        $paidAt = null;
        $comment = null;

        if ($calculation['amount_to_pay'] === 0) {
            $status = InvoiceStatus::PAID;
            $paidAt = now();
            $comment = 'Автоматическое продление: остаток средств по текущей подписке покрыл стоимость нового тарифа.';
        }

        if ($calculation['bonus_days'] > 0) {
            $bonusComment = 'Остаток средств по текущей подписке после вычета стоимости нового тарифа, позволяет добавить '.$calculation['bonus_days'].' бонусных дней. '
                .'Формула: (('.$calculation['discount'].' - '.$calculation['base_amount'].') / '.$newTariff->price.') * 30 дн';

            $comment = $comment ? $comment.' '.$bonusComment : $bonusComment;
        }

        // Атомарно получаем следующий номер счета из последовательности PostgreSQL
        // Для того что бы избежать ситуации гонки и присвоить каждому счёту уникальный номер
        $nextId = DB::scalar("SELECT nextval('invoice_number_seq')");

        $invoice = Invoice::create([
            'company_id' => $company->id,
            'tariff_id' => $newTariff->id,
            'number' => (string) $nextId,
            'amount' => $calculation['amount_to_pay'],
            'period_days' => $periodDays,
            'status' => $status,
            'paid_at' => $paidAt,
            'comment' => $comment,
        ]);

        if ($invoice->isPaid()) {
            $this->approveInvoice($invoice);
        }

        return $invoice;
    }

    public function approveInvoice(Invoice $invoice): void
    {
        $company = $invoice->company;
        $subscription = $company->subscription;
        $now = now();
        $startsAt = $now;
        $endsAt = $now->copy()->addDays($invoice->period_days);

        if ($subscription && $subscription->tariff_id === $invoice->tariff_id && $subscription->ends_at && $subscription->ends_at->isFuture()) {
            $startsAt = $subscription->starts_at;
            $endsAt = $subscription->ends_at->addDays($invoice->period_days);
        }

        $invoice->update([
            'status' => InvoiceStatus::PAID,
            'paid_at' => $invoice->paid_at ?? $now,
            'ends_at' => $endsAt,
        ]);

        Subscription::updateOrCreate(
            ['company_id' => $company->id],
            [
                'tariff_id' => $invoice->tariff_id,
                'starts_at' => $startsAt,
                'ends_at' => $endsAt,
            ]
        );

        $company->update(['tariff_id' => $invoice->tariff_id]);

        $this->enforceTariffLimits($company);
    }

    public function cancelInvoice(Invoice $invoice): void
    {
        if ($invoice->status !== InvoiceStatus::AWAITING_PAYMENT) {
            abort(400, 'Можно отменить только ожидающий оплаты счет');
        }
        $invoice->update(['status' => InvoiceStatus::CANCELLED]);
    }

    // Метод для архивации части сотрудников, если их количество превышает лимит нового тарифа
    public function enforceTariffLimits(Company $company): void
    {
        $company->load('tariff');
        $maxEmployees = $company->tariff?->max_employees;

        if ($maxEmployees !== null) {
            $activeEmployeesQuery = $company->employees()
                ->where('status', 'ACTIVE')
                ->where('id', '!=', $company->owner_user_id);

            $activeCount = $activeEmployeesQuery->count();
            if ($activeCount > $maxEmployees) {
                $toArchiveCount = $activeCount - $maxEmployees;
                $employeesToArchive = $activeEmployeesQuery
                    ->orderByDesc('created_at')
                    ->limit($toArchiveCount)
                    ->get();

                foreach ($employeesToArchive as $employee) {
                    DB::transaction(function () use ($company, $employee): void {
                        $archivedOn = today($company->payrollTimezone());
                        $employee->update([
                            'status' => UserStatus::BLOCKED,
                            'archived_at' => $archivedOn,
                        ]);
                        $this->projectAssignments->closeAllForUser($employee, $archivedOn);
                        $this->archiveRates->archive($employee);
                    });
                }
            }
        }
    }

    public function generateInvoicePdf(Invoice $invoice): PDFResponse
    {
        $requisites = [];
        if (Storage::disk('local')->exists('req/requisites.json')) {
            $requisites = json_decode(Storage::disk('local')->get('req/requisites.json'), true) ?? [];
        }

        $pdf = Pdf::loadView('pdf.invoice', [
            'invoice' => $invoice,
            'requisites' => $requisites,
            'company_requisites' => $invoice->company->requisites,
        ]);

        return $pdf->setPaper('A4', 'portrait');
    }

    public function generateUpdPdf(Invoice $invoice): PDFResponse
    {
        $requisites = [];
        if (Storage::disk('local')->exists('req/requisites.json')) {
            $requisites = json_decode(Storage::disk('local')->get('req/requisites.json'), true) ?? [];
        }

        $pdf = Pdf::loadView('pdf.upd', [
            'invoice' => $invoice,
            'requisites' => $requisites,
            'company_requisites' => $invoice->company->requisites,
        ]);

        return $pdf->setPaper('A4', 'landscape');
    }
}
