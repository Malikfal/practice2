<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Http\Requests\Workspace\CancelInvoiceRequest;
use App\Http\Requests\Workspace\ChangeTariffRequest;
use App\Http\Requests\Workspace\ViewBillingRequest;
use App\Http\Responses\Workspace\InvoiceIndexResponse;
use App\Http\Responses\Workspace\InvoiceResponse;
use App\Http\Responses\Workspace\SubscriptionResponse;
use App\Http\Responses\Workspace\TariffIndexResponse;
use App\Http\Responses\Workspace\CalculateChangeResponse;
use App\Http\Requests\Workspace\RequestIndividualTariffRequest;
use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Tariff;
use App\Services\Workspace\BillingService;
use App\Support\TelegramNotifier;
use Illuminate\Http\Response;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;

class BillingController extends Controller 
{
    public function __construct(
        private readonly BillingService $billingService,
        private readonly TelegramNotifier $telegram,
    ) {}

    public function tariffs(ViewBillingRequest $request) : JsonResponse
    {
        return new TariffIndexResponse($this->billingService->getAvailableTariffs($request->user()));
    }

    public function requisites(ViewBillingRequest $request) : JsonResponse
    {
        $path = 'req/requisites.json';
        $requisites = [];

        if (Storage::exists($path)) {
            $json = Storage::get($path);
            $requisites = json_decode($json, true) ?? [];
        }

        return response()->json(['data' => $requisites]);
    }

    public function currentSubscription(ViewBillingRequest $request) : JsonResponse {
        $data = $this->billingService->getCurrentSubscription($request->user());
        return new SubscriptionResponse($data);
    }

    public function invoices(ViewBillingRequest $request) : JsonResponse {
        $perPage = (int) $request->query('per_page', 10);
        return new InvoiceIndexResponse(
            $this->billingService->getInvoices($request->user(), $perPage)
        );
    }

    public function cancelInvoice(CancelInvoiceRequest $request, Invoice $invoice): JsonResponse {
        $this->billingService->cancelInvoice($invoice);
        return new InvoiceResponse($invoice, 'Счет успешно отменен.');
    }

    public function changeTariff(ChangeTariffRequest $request) : JsonResponse {
        $tariff = Tariff::findOrFail($request->validated('tariff_id'));
        if ($tariff->isFree()) {
            $this->billingService->activateFreeTariff($request->user()->company, $tariff);

            return response()->json([
                'message' => "Компания переведена на тариф {$tariff->name}.",
                'data' => ['switched_to_free' => true],
            ]);
        }

        $invoice = $this->billingService->requestTariffChange($request->user()->company, $request->validated());

        return new InvoiceResponse($invoice->load('tariff'), 'Счет успешно сформирован. Пожалуйста, оплатите его для завершения смены тарифа.');
    }

    public function calculateChange(ChangeTariffRequest $request) : JsonResponse {
        $calculation = $this->billingService->calculateTariffChange($request->user()->company, [
            'period_months' => 1,
            ...array_filter($request->validated(), static fn ($value): bool => $value !== null),
        ]);
        return new CalculateChangeResponse($calculation);
    }

    public function requestIndividualTariff(RequestIndividualTariffRequest $request) : JsonResponse {
        $user = $request->user();
        $company = $user->company;
        $socials = $user->socials ?? [];
        $employeesCount = $request->integer('desired_employees_count');
        $periodMonths = $request->integer('desired_period_months');

        $text = "<b>Запрос на индивидуальный тариф</b>\n\n"
            ."<b>Компания:</b> ".e($company->name)."\n"
            ."<b>Контактное лицо:</b> ".e(trim($user->name . ' ' . $user->last_name))."\n"
            ."<b>Связь:</b>\n"
            ."<b>  Email:</b> ".e($user->email)."\n"
            ."<b>  Telegram:</b> ".e($socials["telegram_url"] ?? 'не указан')."\n"
            ."<b>  VK:</b> ".e($socials["vk_url"] ?? 'не указан')."\n"
            ."<b>  MAX:</b> ".e($socials["max_url"] ?? 'не указан')."\n"
            ."<b>Желаемый лимит:</b> " . ($employeesCount > 0 ? "{$employeesCount} сотрудников" : "безлимит")."\n"
            ."<b>Желаемый период:</b> " . ($periodMonths > 0 ? "{$periodMonths} мес." : "не указан");

        $this->telegram->send($text);

        return response()->json([
            'message' => 'Ваша заявка на индивидуальный тариф отправлена. Менеджер свяжется с вами в ближайшее время.',
        ]);
    }

    public function downloadInvoiceUpd(ViewBillingRequest $request, Invoice $invoice) : Response {
        $endDate = $invoice->created_at->copy()->addDays($invoice->period_days);
        if (now()->isBefore($endDate)) {
            abort(403, 'УПД можно скачать только по окончании периода лицензии.');
        }
        
        $pdf = $this->billingService->generateUpdPdf($invoice);
        return $pdf->download("УПД_{$invoice->number}.pdf");
    }

    public function downloadInvoice(ViewBillingRequest $request, Invoice $invoice) : Response {
        $pdf = $this->billingService->generateInvoicePdf($invoice);
        return $pdf->download("Счет_на_оплату_{$invoice->number}.pdf");
    }
}