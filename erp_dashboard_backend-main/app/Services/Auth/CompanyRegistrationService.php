<?php

namespace App\Services\Auth;

use App\Enums\CompanyStatus;
use App\Enums\UserRole;
use App\Mail\AuthLinkMail;
use App\Models\Application;
use App\Models\Company;
use App\Models\Tariff;
use App\Models\User;
use App\Services\Workspace\BillingService;
use App\Support\RoleDefaults;
use App\Support\TelegramNotifier;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

/**
 * Самостоятельная регистрация: компания на ФРИ, владелец-администратор, письмо для подтверждения почты.
 */
class CompanyRegistrationService
{
    public function __construct(
        private readonly BillingService $billing,
        private readonly UserActionTokenService $tokens,
        private readonly TelegramNotifier $telegram,
    ) {}

    /**
     * @param  array<string, mixed>  $data  проверенные поля RegisterCompanyRequest
     */
    public function register(array $data, ?string $ip): User
    {
        $tariff = Tariff::free();
        if (! $tariff) {
            throw new RuntimeException('Тариф ФРИ не найден: проверьте миграции.');
        }

        $owner = DB::transaction(function () use ($data, $tariff, $ip): User {
            $company = Company::create([
                'id' => (string) Str::uuid(),
                'name' => $data['company_name'],
                'status' => CompanyStatus::ACTIVE->value,
                'tariff_id' => $tariff->id,
                'self_registered_at' => now(),
            ]);

            RoleDefaults::syncForCompany((string) $company->id);

            $owner = User::create([
                'id' => (string) Str::uuid(),
                'company_id' => $company->id,
                'name' => $data['first_name'],
                'last_name' => $data['last_name'],
                'email' => $data['email'],
                'phone' => $data['phone'],
                'password_hash' => Hash::make($data['password']),
                'password_set_at' => now(),
                'email_verified_at' => null,
                'role' => UserRole::ADMIN->value,
                'status' => 'ACTIVE',
            ]);

            $owner->syncSpatieRoleFromLegacyRole();
            $company->update(['owner_user_id' => $owner->id]);
            $this->billing->activateFreeTariff($company, $tariff);

            // Заявка хранит согласия, как и у формы на лендинге.
            Application::create([
                'id' => (string) Str::uuid(),
                'name' => trim($data['first_name'].' '.$data['last_name']),
                'phone' => $data['phone'],
                'tariff' => $tariff->name.', самостоятельная регистрация',
                'personal_data_consent' => true,
                'marketing_consent' => (bool) ($data['marketing_consent'] ?? false),
                'status' => 'registered',
                'ip' => $ip,
            ]);

            return $owner;
        });

        $this->sendVerification($owner);
        $this->notifyTeam($owner, (bool) ($data['marketing_consent'] ?? false));

        return $owner;
    }

    public function sendVerification(User $user): void
    {
        // Ссылки из прошлых писем продолжают работать: человек может открыть любое письмо.
        $plain = $this->tokens->issue($user, UserActionTokenService::EMAIL_VERIFICATION, now()->addHours(48), replacePrevious: false);
        $url = UserActionTokenService::frontendUrl('/verify-email', $plain);

        try {
            Mail::to($user->email)->send(AuthLinkMail::verifyEmail($user->name, (string) $user->company?->name, $url));
        } catch (Throwable $e) {
            // Компания уже создана: письмо можно отправить повторно со страницы входа.
            Log::error('Не удалось отправить письмо подтверждения почты', ['user_id' => $user->id, 'message' => $e->getMessage()]);
        }
    }

    private function notifyTeam(User $owner, bool $marketingConsent): void
    {
        $text = "<b>🆕 Новая компания в ФЛОУ (самостоятельная регистрация)</b>\n\n"
            .'🏢 Компания: '.e((string) $owner->company?->name)."\n"
            .'👤 Владелец: '.e(trim($owner->name.' '.$owner->last_name))."\n"
            .'✉️ Почта: '.e($owner->email)."\n"
            .'📞 Телефон: '.e((string) $owner->phone)."\n"
            ."💳 Тариф: ФРИ\n"
            .'📣 Согласие на рекламные сообщения: '.($marketingConsent ? 'да' : 'нет');

        $this->telegram->send($text);
    }
}
