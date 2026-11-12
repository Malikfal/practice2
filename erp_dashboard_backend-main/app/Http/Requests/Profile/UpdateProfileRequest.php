<?php

namespace App\Http\Requests\Profile;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'birthday' => ['present', 'nullable', 'date'],
            'phone' => ['present', 'nullable', 'string', 'max:50'],
            'socials' => ['present', 'array'],
            'socials.*' => ['string', 'nullable', 'max:255'],
            'skills' => ['present', 'nullable', 'string'],
            'payload' => ['nullable', 'array'],
            'payload.*' => ['nullable', 'string', 'max:10000'],
        ];
    }
}
