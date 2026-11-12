<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Profile\ChangePasswordRequest;
use App\Http\Requests\Profile\UpdateProfileRequest;
use App\Http\Responses\Common\MessageResponse;
use App\Http\Responses\Profile\ProfileResponse;
use App\Services\Workspace\SkillService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class ProfileController extends Controller
{
    public function __construct(
        private readonly SkillService $skills,
    ) {}

    public function show(Request $request): JsonResponse
    {
        return new ProfileResponse($request->user());
    }

    public function update(UpdateProfileRequest $request): JsonResponse
    {
        $data = $request->validated();
        $skillNames = $this->skills->normalizeSkillNamesFromString($data['skills'] ?? null);
        $legacySkills = $this->skills->joinSkillNames($skillNames);

        $user = $request->user();
        $user->update([
            'name' => trim($data['first_name']),
            'last_name' => $data['last_name'],
            'birthday' => $data['birthday'],
            'phone' => $data['phone'],
            'socials' => $data['socials'],
            'skills' => $legacySkills,
            'payload' => $data['payload'] ?? null,
        ]);
        $this->skills->syncUserSkills($user, $skillNames);

        return new ProfileResponse($user->fresh());
    }

    public function changePassword(ChangePasswordRequest $request): JsonResponse
    {
        $data = $request->validated();

        $user = $request->user();

        if (! password_verify($data['current_password'], $user->password_hash)) {
            throw ValidationException::withMessages([
                'current_password' => ['Текущий пароль указан неверно.'],
            ]);
        }

        $user->update([
            'password_hash' => Hash::make($data['password']),
        ]);

        return new MessageResponse('Пароль успешно обновлен.');
    }
}
