<?php

namespace App\Http\Controllers\Web\Superadmin;

use App\Enums\CompanyStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Web\Superadmin\StoreCompanyRequest;
use App\Models\Company;
use App\Models\Tariff;
use App\Models\User;
use App\Models\Invoice;
use App\Models\Subscription;
use App\Support\AuthCookieService;
use App\Support\AuthTokenService;
use App\Services\Workspace\BillingService; 
use App\Support\RoleDefaults;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\View\View;

class CompanyController extends Controller
{
    public function __construct(
        private readonly AuthCookieService $authCookies,
        private readonly AuthTokenService $tokens,
        private readonly BillingService $billingService
    ) {
    }

    public function index(): View
    {
        $companies = Company::query()
            ->with('owner', 'tariff')
            ->withCount('employees')
            ->orderByDesc('created_at')
            ->paginate(30);

        return view('admin.companies.index', [
            'companies' => $companies,
            ...$this->companySwitcherData(),
        ]);
    }

    public function show(Company $company): View
    {
        $tariffs = Tariff::where('is_active', true)->get();

        $company->load('owner', 'tariff');

        $employees = $company->employees()
            ->orderBy('last_name')
            ->orderBy('name')
            ->paginate(30);

        return view('admin.companies.show', [
            'company' => $company,
            'employees' => $employees,
            'tariffs' => $tariffs,
            ...$this->companySwitcherData($company),
        ]);
    }

    public function create(): View
    {
        $tariffs = Tariff::where('is_active', true)->get();

        return view('admin.companies.create', [
            'tariffs' => $tariffs,
            ...$this->companySwitcherData(),
        ]);
    }

    public function store(StoreCompanyRequest $request): RedirectResponse
    {
        $company = DB::transaction(function () use ($request): Company {
            $company = Company::create([
                'id' => (string) Str::uuid(),
                'name' => $request->string('company_name')->toString(),
                'status' => CompanyStatus::ACTIVE->value,
                'owner_user_id' => null,
                'blocked_at' => null,
                'tariff_id' => $request->string('tariff_id')->toString(),
            ]);

            RoleDefaults::syncForCompany((string) $company->id);

            $owner = User::create([
                'id' => (string) Str::uuid(),
                'company_id' => $company->id,
                'name' => $request->string('owner_first_name')->toString(),
                'last_name' => $request->string('owner_last_name')->toString(),
                'email' => $request->string('owner_email')->toString(),
                'password_hash' => Hash::make($request->string('owner_password')->toString()),
                'role' => UserRole::ADMIN->value,
                'status' => 'ACTIVE',
            ]);

            $owner->syncSpatieRoleFromLegacyRole();

            $company->update([
                'owner_user_id' => $owner->id,
            ]);

            $tariff = Tariff::findOrFail($company->tariff_id);
            if ($tariff->isFree()) {
                $this->billingService->activateFreeTariff($company, $tariff);
            } else {
                $this->billingService->requestTariffChange($company, [
                    'tariff_id' => $company->tariff_id,
                    'period_months' => $request->integer('period_months'),
                ]);
            }

            return $company->fresh();
        });

        return redirect()
            ->route('admin.companies.show', $company)
            ->with('status', 'Компания и владелец созданы.');
    }

    public function block(Company $company): RedirectResponse
    {
        $company->update([
            'status' => CompanyStatus::BLOCKED->value,
            'blocked_at' => now(),
        ]);

        return back()->with('status', 'Компания заблокирована.');
    }

    public function unblock(Company $company): RedirectResponse
    {
        $company->update([
            'status' => CompanyStatus::ACTIVE->value,
            'blocked_at' => null,
        ]);

        return back()->with('status', 'Компания разблокирована.');
    }

    public function updateTariff(Request $request, Company $company): RedirectResponse {
        $request->validate([
            'tariff_id' => 'required|uuid|exists:tariffs,id',
            'period_months' => 'nullable|integer|in:1,3,6,12',
        ]);
        
        $newTariffId = $request->string('tariff_id')->toString();
        $newTariff = Tariff::findOrFail($newTariffId);

        if ($newTariff->isFree()) {
            $this->billingService->activateFreeTariff($company, $newTariff, enforceLimit: true);

            return back()->with('status', 'Компания переведена на тариф '.$newTariff->name.'.');
        }

        if ($request->filled('period_months')) {
            $this->billingService->requestTariffChange($company, [
                'tariff_id' => $newTariff->id,
                'period_months' => $request->integer('period_months'),
            ]);
            return back()->with('status', 'Счет на смену тарифа успешно сформирован (ожидает оплаты).');
        }
        
        // Перерасчет подписки при ручной смене тарифа
        
        DB::transaction(function() use ($company, $newTariff) {
            $company->update(['tariff_id' => $newTariff->id]);
            
            $subscription = $company->subscription;
            $now = now();
            if ($subscription && $subscription->ends_at && $subscription->ends_at->isFuture()) {
                $oldTariff = $subscription->tariff;
                
                if ($oldTariff && $oldTariff->id !== $newTariff->id && $newTariff->price > 0) {
                    $remainingDays = $now->diffInDays($subscription->ends_at);
                    
                    $newDays = $remainingDays * ($oldTariff->price / $newTariff->price);
                    
                    $subscription->update([
                        'tariff_id' => $newTariff->id,
                        'ends_at' => $now->copy()->addDays(round($newDays))
                    ]);
                } else {
                    $subscription->update(['tariff_id' => $newTariff->id]);
                }
            }
            
            $company->load('tariff');
            $this->billingService->enforceTariffLimits($company);
        });

        return back()->with('status', 'Тариф компании успешно изменен.');
    }

    public function billing(Company $company): View
    {
        $tariffs = Tariff::where('is_active', true)->get();
        $company->load('owner', 'tariff', 'subscription');

        $invoices = Invoice::with('tariff')
            ->where('company_id', $company->id)
            ->orderByDesc('created_at')
            ->paginate(15);

        return view('admin.companies.billing', [
            'company' => $company,
            'tariffs' => $tariffs,
            'invoices' => $invoices,
            ...$this->companySwitcherData($company),
        ]);
    }

    public function approveInvoice(Company $company, Invoice $invoice): RedirectResponse
    {
        if ($invoice->company_id !== $company->id) {
            abort(403);
        }

        if ($invoice->isPaid()) {
            return back()->with('error', 'Счет уже оплачен!');
        }

        DB::transaction(function () use ($company, $invoice) {
            $this->billingService->approveInvoice($invoice);
            $this->billingService->enforceTariffLimits($company);
        });

        return back()->with('status', 'Счет подтвержден, подписка оформлена!');
    }

    public function cancelInvoice(Company $company, Invoice $invoice): RedirectResponse
    {
        if ($invoice->company_id !== $company->id) {
            abort(403);
        }

        try {
            $this->billingService->cancelInvoice($invoice);
        } catch (\Exception $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('status', 'Счет успешно отменен.');
    }

    public function downloadInvoice(Company $company, Invoice $invoice)
    {
        if ($invoice->company_id !== $company->id) {
            abort(403);
        }

        $pdf = $this->billingService->generateInvoicePdf($invoice);
        return $pdf->download("Счет_на_оплату_{$invoice->number}.pdf");
    }

    public function downloadInvoiceUpd(Company $company, Invoice $invoice)
    {
        if ($invoice->company_id !== $company->id) {
            abort(403);
        }

        $pdf = $this->billingService->generateUpdPdf($invoice);
        return $pdf->download("УПД_{$invoice->number}.pdf");
    }

    public function updateSubscriptionEndDate(Request $request, Company $company): RedirectResponse {
        $request->validate([
            'ends_at' => 'required|date|after_or_equal:today',
        ]);

        $endsAt = Carbon::parse($request->input('ends_at'))->endOfDay();

        DB::transaction(function() use ($company, $endsAt) {
            $company->subscription->update(['ends_at' => $endsAt]);
        });

        return back()->with('status', "Дата окончания подписки успешно изменена на " . $endsAt->format('d.m.Y'));
    }

    public function createIndividualTariff(Request $request, Company $company): RedirectResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'max_employees' => 'nullable|integer|min:1',
            'price' => 'required|integer|min:0',
            'period_months' => 'required|integer|in:1,3,6,12',
        ]);

        $result = DB::transaction(function () use ($request, $company) {
            $tariff = Tariff::create([
                'id' => (string) Str::uuid(),
                'name' => $request->string('name')->toString(),
                'slug' => Str::slug($request->string('name')->toString() . '-' . uniqid()),
                'max_employees' => $request->input('max_employees'),
                'price' => $request->integer('price'),
                'is_public' => false,
                'is_active' => true,
            ]);

            $invoice = $this->billingService->requestTariffChange($company, [
                'tariff_id' => $tariff->id,
                'period_months' => $request->integer('period_months'),
            ]);

            return ['tariff' => $tariff, 'invoice' => $invoice];
        });

        return back()->with('status', "Индивидуальный тариф «{$result['tariff']->name}» создан. Сформирован счет №{$result['invoice']->number} на сумму " . number_format($result['invoice']->amount, 0, '.', ' ') . " ₽.");
    }



    public function loginAsOwner(Company $company): RedirectResponse
    {
        $owner = $company->owner;

        if (! $owner) {
            return back()->withErrors(['owner' => 'У компании не назначен владелец.']);
        }

        $tokens = $this->tokens->issueAuthTokens($owner, impersonatedBySuperadmin: true);
        $frontendUrl = rtrim((string) config('app.frontend_url'), '/');
        return $this->authCookies->withAuthCookies(
            redirect()->away($frontendUrl.'/auth/accept'),
            $tokens,
            $this->tokens->accessTokenTtlSeconds(),
            $this->tokens->refreshTokenTtlSeconds(),
        );
    }

    private function companySwitcherData(?Company $currentCompany = null): array
    {
        return [
            'companySwitcherCompanies' => Company::query()
                ->select(['id', 'name'])
                ->orderBy('name')
                ->limit(100)
                ->get(),
            'currentCompanyId' => $currentCompany?->id,
        ];
    }
}
