<?php

namespace App\Services\Imports\Processors;

use App\Models\DataImport;
use App\Models\User;
use App\Services\Admin\EmployeeService;
use App\Services\Imports\SpreadsheetReader;
use App\Support\RoleCatalog;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class EmployeeImportProcessor extends AbstractImportProcessor
{
    private const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';

    public function __construct(SpreadsheetReader $reader, private readonly EmployeeService $employees)
    {
        parent::__construct($reader);
    }

    protected function requiredHeaders(): array
    {
        return ['last_name', 'first_name', 'email', 'role'];
    }

    protected function headerAliases(): array
    {
        return [
            'last_name' => ['Фамилия', 'last name', 'lastname'],
            'first_name' => ['Имя', 'first name', 'firstname'],
            'phone' => ['Телефон', 'phone'],
            'email' => ['Email', 'Почта', 'e-mail'],
            'password' => ['Пароль', 'password'],
            'birthday' => ['Дата рождения', 'birthday', 'birth date'],
            'role' => ['Роль', 'role', 'role id'],
            'position' => ['Должность', 'position'],
            'skills' => ['Компетенции', 'skills'],
            'additional_email' => ['Доп. Почта', 'Дополнительная почта', 'additional email'],
            'additional_phone' => ['Доп. Телефон', 'Дополнительный телефон', 'additional phone'],
            'telegram_url' => ['Телеграм', 'Telegram', 'telegram url'],
            'vk_url' => ['Вконтакте', 'VK', 'vk url'],
            'max_url' => ['Max', 'max url'],
        ];
    }

    protected function importRow(DataImport $import, array $row): array
    {
        $actor = User::withBlocked()->findOrFail($import->created_by_id);
        $warnings = [];
        [$role, $roleId] = $this->role($import->company_id, $this->requiredText($row['role'] ?? null, 'role', 'Отсутствует роль.'));
        $password = trim((string) ($row['password'] ?? ''));
        if ($password === '') {
            $password = $this->generatePassword();
            $warnings[] = 'Пароль был сгенерирован автоматически. Способ его передачи сотруднику должен быть определён отдельно.';
        }

        $birthday = null;
        try {
            $birthday = $this->date($row['birthday'] ?? null, 'birthday');
        } catch (ValidationException) {
            $warnings[] = 'Дата рождения не распознана и была пропущена.';
        }

        $payload = [
            'email' => mb_strtolower($this->requiredText($row['email'] ?? null, 'email', 'Отсутствует email.')),
            'first_name' => $this->requiredText($row['first_name'] ?? null, 'first_name', 'Отсутствует имя.'),
            'last_name' => $this->requiredText($row['last_name'] ?? null, 'last_name', 'Отсутствует фамилия.'),
            'password' => $password,
            'role' => $role,
            'role_id' => $roleId,
            'position' => $this->text($row['position'] ?? null),
            'birthday' => $birthday,
            'phone' => $this->phone($row['phone'] ?? null),
            'socials' => array_filter([
                'additional_email' => $this->text($row['additional_email'] ?? null),
                'additional_phone' => $this->phone($row['additional_phone'] ?? null),
                'telegram_url' => $this->text($row['telegram_url'] ?? null),
                'vk_url' => $this->text($row['vk_url'] ?? null),
                'max_url' => $this->text($row['max_url'] ?? null),
            ], fn ($value) => $value !== null),
            'skills' => $this->text($row['skills'] ?? null),
        ];

        Validator::make($payload, [
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')],
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string', 'min:8'],
            'role' => ['required', Rule::in(RoleCatalog::assignableValuesForCompany($import->company_id))],
            'role_id' => ['nullable', 'integer'],
            'position' => ['nullable', 'string', 'max:255'],
            'birthday' => ['nullable', 'date'],
            'phone' => ['nullable', 'string', 'max:50'],
            'socials' => ['array'],
        ])->validate();

        $user = $this->employees->create($actor, $payload);
        $normalized = $payload;
        $normalized['password'] = '[REDACTED]';

        return ['model' => $user, 'normalized' => $normalized, 'warnings' => $warnings ?: null];
    }

    protected function sanitizeRawData(array $row): array
    {
        if (array_key_exists('password', $row)) {
            $row['password'] = '[REDACTED]';
        }

        return $row;
    }

    /** @return array{0: string, 1: ?int} */
    private function role(string $companyId, string $value): array
    {
        $normalized = mb_strtolower(trim($value));
        foreach (RoleCatalog::assignableOptionsForCompany($companyId) as $option) {
            $candidates = array_filter([
                isset($option['id']) ? (string) $option['id'] : null,
                $option['role_id'] ?? null,
                $option['value'] ?? null,
                $option['role_value'] ?? null,
                $option['label'] ?? null,
            ]);
            if (collect($candidates)->contains(fn ($candidate): bool => mb_strtolower(trim((string) $candidate)) === $normalized)) {
                $role = (string) ($option['value'] ?? $option['role_value']);
                $roleId = isset($option['id']) ? (int) $option['id'] : RoleCatalog::resolveRoleIdByValueForCompany($companyId, $role);

                return [$role, $roleId];
            }
        }

        throw ValidationException::withMessages(['role' => ["Роль \"{$value}\" не найдена."]]);
    }

    private function requiredText(mixed $value, string $field, string $message): string
    {
        return $this->text($value) ?? throw ValidationException::withMessages([$field => [$message]]);
    }

    private function phone(mixed $value): ?string
    {
        $text = $this->text($value);
        if ($text === null) {
            return null;
        }
        if (is_numeric($text) && str_contains(mb_strtolower($text), 'e')) {
            $text = sprintf('%.0f', (float) $text);
        }

        $digits = preg_replace('/\D+/', '', $text) ?? '';
        if ($digits === '') {
            return null;
        }
        if (str_starts_with($digits, '8')) {
            $digits = '7'.substr($digits, 1);
        } elseif (strlen($digits) === 10) {
            $digits = '7'.$digits;
        }
        $digits = substr($digits, 0, 11);

        return $digits === '' ? null : '+'.$digits;
    }

    private function generatePassword(): string
    {
        $password = '';
        $lastIndex = strlen(self::PASSWORD_ALPHABET) - 1;
        for ($index = 0; $index < 12; $index++) {
            $password .= self::PASSWORD_ALPHABET[random_int(0, $lastIndex)];
        }

        return $password;
    }
}
