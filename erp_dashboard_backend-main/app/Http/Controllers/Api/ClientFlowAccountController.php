<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserPermission;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\ClientContact;
use App\Models\Project;
use App\Models\User;
use App\Services\Auth\ClientPasswordSetupService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Управление клиентскими аккаунтами FLOW из карточки клиента.
 */
class ClientFlowAccountController extends Controller
{
    public function __construct(private readonly ClientPasswordSetupService $passwordSetup) {}

    public function index(Request $request, Client $client): JsonResponse
    {
        $this->assertManager($request, $client);

        return response()->json([
            'data' => $this->accountsQuery($client)
                ->with('clientProjects:id,name')
                ->orderBy('name')
                ->get()
                ->map(fn (User $user) => $this->accountData($user)),
        ]);
    }

    public function projects(Request $request, Client $client): JsonResponse
    {
        $this->assertManager($request, $client);

        return response()->json([
            'data' => $this->clientProjectsQuery($client)->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function store(Request $request, Client $client): JsonResponse
    {
        $this->assertManager($request, $client);
        $data = $request->validate([
            'contact_id' => ['nullable', 'uuid'],
            'name' => ['required_without:contact_id', 'nullable', 'string', 'max:255'],
            'email' => ['required_without:contact_id', 'nullable', 'email', 'max:255'],
            'all_projects' => ['sometimes', 'boolean'],
            'project_ids' => ['sometimes', 'array'],
            'project_ids.*' => ['uuid'],
        ]);

        if (! empty($data['contact_id'])) {
            $contact = ClientContact::where('client_id', $client->id)->findOrFail($data['contact_id']);
            if (! $contact->email) {
                throw ValidationException::withMessages(['contact_id' => ['У контакта не указан email.']]);
            }
            $data['name'] = trim($contact->first_name.' '.($contact->last_name ?? ''));
            $data['email'] = $contact->email;
        }

        $this->assertEmailIsFree((string) $data['email']);
        $projectIds = $this->validatedProjectIds($client, $data['project_ids'] ?? []);

        [$user, $inviteUrl] = DB::transaction(function () use ($client, $data, $projectIds): array {
            $user = User::create([
                'id' => (string) Str::uuid(),
                'company_id' => $client->company_id,
                'client_id' => $client->id,
                'name' => $data['name'],
                'email' => $data['email'],
                'password_hash' => Hash::make(Str::random(64)),
                'password_set_at' => null,
                'role' => UserRole::CLIENT->value,
                'status' => 'ACTIVE',
                'client_all_projects' => $data['all_projects'] ?? true,
            ]);
            $user->clientProjects()->sync($projectIds);

            return [$user, $this->passwordSetup->issueUrl($user)];
        });

        return response()->json([
            'data' => $this->accountData($user->load('clientProjects:id,name')),
            'invite_url' => $inviteUrl,
        ], 201);
    }

    public function update(Request $request, Client $client, User $account): JsonResponse
    {
        $this->assertManager($request, $client);
        $this->assertClientAccount($client, $account);
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => ['sometimes', 'required', 'email', 'max:255'],
            'all_projects' => ['sometimes', 'boolean'],
            'project_ids' => ['sometimes', 'array'],
            'project_ids.*' => ['uuid'],
            'active' => ['sometimes', 'boolean'],
        ]);

        if (array_key_exists('email', $data)) {
            $this->assertEmailIsFree((string) $data['email'], (string) $account->id);
        }
        $projectIds = array_key_exists('project_ids', $data)
            ? $this->validatedProjectIds($client, $data['project_ids'])
            : null;

        DB::transaction(function () use ($account, $data, $projectIds): void {
            $attributes = array_intersect_key($data, array_flip(['name', 'email']));
            if (array_key_exists('all_projects', $data)) {
                $attributes['client_all_projects'] = $data['all_projects'];
            }
            if (array_key_exists('active', $data)) {
                $attributes['status'] = $data['active'] ? 'ACTIVE' : 'BLOCKED';
            }

            $account->update($attributes);
            if ($projectIds !== null) {
                $account->clientProjects()->sync($projectIds);
            }
            if ($account->isBlocked()) {
                $account->refreshSessions()->whereNull('revoked_at')->update(['revoked_at' => now()]);
            }
        });

        return response()->json(['data' => $this->accountData($account->fresh()->load('clientProjects:id,name'))]);
    }

    /**
     * Ссылка для первого входа или сброса пароля. Прежние ссылки аккаунта перестают работать.
     */
    public function passwordLink(Request $request, Client $client, User $account): JsonResponse
    {
        $this->assertManager($request, $client);
        $this->assertClientAccount($client, $account);
        abort_if($account->isBlocked(), 422, 'Сначала включите аккаунт.');

        return response()->json(['invite_url' => $this->passwordSetup->issueUrl($account)]);
    }

    private function assertManager(Request $request, Client $client): void
    {
        $actor = $request->user();
        abort_unless($actor?->can(UserPermission::CLIENTS_FLOW_ACCESS_MANAGE->value), 403, 'Недостаточно прав.');
        abort_unless($actor->isSuperAdmin() || (string) $actor->company_id === (string) $client->company_id, 404);
    }

    private function assertClientAccount(Client $client, User $account): void
    {
        abort_unless(
            (string) $account->client_id === (string) $client->id
            && (string) $account->company_id === (string) $client->company_id
            && $account->role === UserRole::CLIENT->value,
            404,
        );
    }

    private function assertEmailIsFree(string $email, ?string $exceptUserId = null): void
    {
        $taken = User::withBlocked()
            ->whereRaw('LOWER(email) = ?', [mb_strtolower(trim($email))])
            ->when($exceptUserId, fn (Builder $query) => $query->whereKeyNot($exceptUserId))
            ->exists();

        if ($taken) {
            throw ValidationException::withMessages(['email' => ['Пользователь с таким email уже существует.']]);
        }
    }

    /**
     * @return Builder<User>
     */
    private function accountsQuery(Client $client): Builder
    {
        return User::withBlocked()
            ->where('client_id', $client->id)
            ->where('company_id', $client->company_id)
            ->whereHas('roleModel', fn (Builder $query) => $query->where('name', UserRole::CLIENT->value));
    }

    /**
     * @return Builder<Project>
     */
    private function clientProjectsQuery(Client $client): Builder
    {
        return Project::query()
            ->where('company_id', $client->company_id)
            ->where('client_id', $client->id);
    }

    /**
     * @param  array<int, string>  $projectIds
     * @return array<int, string>
     */
    private function validatedProjectIds(Client $client, array $projectIds): array
    {
        $projectIds = array_values(array_unique($projectIds));
        if (count($projectIds) !== $this->clientProjectsQuery($client)->whereIn('id', $projectIds)->count()) {
            throw ValidationException::withMessages(['project_ids' => ['Выбранный проект не относится к этому клиенту.']]);
        }

        return $projectIds;
    }

    private function accountData(User $user): array
    {
        return [
            'id' => (string) $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'active' => ! $user->isBlocked(),
            'all_projects' => (bool) $user->client_all_projects,
            'project_ids' => $user->clientProjects->pluck('id')->map(fn ($id) => (string) $id)->values(),
            'projects' => $user->clientProjects->pluck('name')->values(),
            'password_set' => $user->password_set_at !== null,
            'last_login_at' => $user->last_login_at,
        ];
    }
}
