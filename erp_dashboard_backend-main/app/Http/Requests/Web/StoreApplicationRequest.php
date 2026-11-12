<?php

namespace App\Http\Requests\Web;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\Validator;

class StoreApplicationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:64', 'regex:/^(\+?\d{10,15}|@[A-Za-z0-9_]{5,32})$/'],
            'tariff' => ['nullable', 'string', 'max:64'],
            'personal_data_consent' => ['accepted'],
            'marketing_consent' => ['nullable', 'boolean'],
            'smartcaptcha_token' => ['required', 'string'],
        ];
    }

    public function messages(): array
    {
        return [
            'phone.regex' => 'Укажите телефон (10–15 цифр) или Telegram, начиная с @.',
            'personal_data_consent.accepted' => 'Необходимо согласие на обработку персональных данных.',
            'smartcaptcha_token.required' => 'Подтвердите, что вы не робот.',
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {

            if ($validator->errors()->has('smartcaptcha_token')) {
                return;
            }

            $token = (string) $this->input('smartcaptcha_token', '');

            if ($token === '') {
                return;
            }

            $response = Http::asForm()->post(
                'https://smartcaptcha.yandexcloud.net/validate',
                [
                    'secret' => config('services.smartcaptcha.secret'),
                    'token' => $token,
                    'ip' => $this->ip(),
                ]
            );

            $result = $response->json();

            $status = $result['status'] ?? null;
            $message = $result['message'] ?? '';

            if ($status !== 'ok') {
                $validator->errors()->add(
                    'smartcaptcha_token',
                    $message !== ''
                        ? $message
                        : 'Проверка SmartCaptcha не пройдена.'
                );
            }
        });
    }
}
