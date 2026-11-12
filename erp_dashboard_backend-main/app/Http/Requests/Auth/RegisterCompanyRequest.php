<?php

namespace App\Http\Requests\Auth;

use App\Models\User;
use App\Support\SmartCaptcha;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class RegisterCompanyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $phone = trim((string) $this->input('phone', ''));

        $this->merge([
            'first_name' => trim((string) $this->input('first_name', '')),
            'last_name' => trim((string) $this->input('last_name', '')),
            'company_name' => trim((string) $this->input('company_name', '')),
            'email' => mb_strtolower(trim((string) $this->input('email', ''))),
            // Пробелы, дефисы и скобки из маски телефона не храним.
            'phone' => (str_starts_with($phone, '+') ? '+' : '').preg_replace('/\D+/', '', $phone),
        ]);
    }

    public function rules(): array
    {
        return [
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'string', 'email', 'max:255'],
            'phone' => ['required', 'string', 'regex:/^\+?\d{10,15}$/'],
            'company_name' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string', 'min:8', 'max:255', 'confirmed'],
            'personal_data_consent' => ['accepted'],
            'marketing_consent' => ['nullable', 'boolean'],
            'smartcaptcha_token' => [SmartCaptcha::isEnabled() ? 'required' : 'nullable', 'string'],
        ];
    }

    public function attributes(): array
    {
        return [
            'first_name' => 'имя',
            'last_name' => 'фамилия',
            'email' => 'почта',
            'phone' => 'телефон',
            'company_name' => 'название компании',
            'password' => 'пароль',
        ];
    }

    public function messages(): array
    {
        return [
            'phone.regex' => 'Укажите телефон: 10–15 цифр, можно с + в начале.',
            'password.min' => 'Пароль должен быть не короче 8 символов.',
            'password.confirmed' => 'Пароли не совпадают.',
            'personal_data_consent.accepted' => 'Необходимо согласие на обработку персональных данных.',
            'smartcaptcha_token.required' => 'Подтвердите, что вы не робот.',
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if (! $validator->errors()->has('email')) {
                $exists = User::withBlocked()->whereRaw('lower(email) = ?', [$this->input('email')])->exists();
                if ($exists) {
                    $validator->errors()->add('email', 'Эта почта уже зарегистрирована. Войдите или восстановите пароль.');
                }
            }

            if ($validator->errors()->isNotEmpty() || ! SmartCaptcha::isEnabled()) {
                return;
            }

            $error = SmartCaptcha::verify((string) $this->input('smartcaptcha_token', ''), $this->ip());
            if ($error !== null) {
                $validator->errors()->add('smartcaptcha_token', $error);
            }
        });
    }
}
