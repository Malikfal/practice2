<?php

namespace App\Services\Workspace;

use App\Models\Client;
use App\Models\ClientContact;
use App\Models\ClientLegalEntity;
use App\Models\ClientLegalEntityBankDetail;
use App\Models\Company;
use App\Models\ProjectRate;
use App\Services\Workspace\FinanceAnalyticsServices\FinanceAnalyticsCacheService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ClientService
{
    public function __construct(
        private readonly FinanceAnalyticsCacheService $financeAnalyticsCache,
    ) {}

    public function paginate(array $data, string $companyId): LengthAwarePaginator
    {
        $search = trim((string) ($data['search'] ?? ''));

        $query = Client::query()
            ->with(['projects', 'contacts', 'legalEntities.bankDetails'])
            ->where('company_id', $companyId)
            ->orderBy('name');

        if ($search !== '') {
            $query->whereRaw('LOWER(name) LIKE ?', ['%' . mb_strtolower($search) . '%']);
        }

        $paginator = $query
            ->paginate((int) ($data['per_page'] ?? 20))
            ->withQueryString();

        $this->attachCurrentRatesToClients($paginator->getCollection());

        return $paginator;
    }

    public function create(array $data, string $companyId): Client
    {
        $client = Client::create([
            'id' => (string) Str::uuid(),
            'company_id' => $companyId,
            'name' => trim((string) $data['name']),
            'description' => $this->nullableString($data['description'] ?? null),
            'weekly_limit_seconds' => $data['weekly_limit_seconds'] ?? null,
        ])->load(['projects', 'contacts', 'legalEntities.bankDetails']);

        $this->attachCurrentRatesToClients(collect([$client]));

        return $client;
    }

    public function show(Client $client, string $companyId): Client
    {
        $this->assertClientCompany($client, $companyId);

        $client = $client->load(['contacts', 'legalEntities.bankDetails', 'projects']);

        $this->attachCurrentRatesToClients(collect([$client]));

        return $client;
    }

    public function update(Client $client, array $data, string $companyId): Client
    {
        $this->assertClientCompany($client, $companyId);

        $attributes = [
            'name' => trim((string) $data['name']),
            'description' => $this->nullableString($data['description'] ?? null),
        ];
        // Лимит меняется, только если его передали: другие формы клиента его не отправляют.
        if (array_key_exists('weekly_limit_seconds', $data)) {
            $attributes['weekly_limit_seconds'] = $data['weekly_limit_seconds'];
        }

        $client->update($attributes);

        $client = $client->refresh()->load(['projects', 'contacts', 'legalEntities.bankDetails']);

        $this->attachCurrentRatesToClients(collect([$client]));
        $this->financeAnalyticsCache->invalidateCompany($companyId);

        return $client;
    }

    public function delete(Client $client, string $companyId): void
    {
        $this->assertClientCompany($client, $companyId);

        DB::transaction(function () use ($client): void {
            $client->projects()->update(['client_id' => null]);
            $client->delete();
        });

        $this->financeAnalyticsCache->invalidateCompany($companyId);
    }

    public function contacts(Client $client, string $companyId): Collection
    {
        $this->assertClientCompany($client, $companyId);

        return $client->contacts()
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get();
    }

    public function createContact(Client $client, array $data, string $companyId): ClientContact
    {
        $this->assertClientCompany($client, $companyId);

        return ClientContact::create($this->contactAttributes($data, [
            'id' => (string) Str::uuid(),
            'client_id' => $client->id,
        ]));
    }

    public function showContact(Client $client, ClientContact $contact, string $companyId): ClientContact
    {
        $this->assertContactBelongsToClient($client, $contact, $companyId);

        return $contact;
    }

    public function updateContact(
        Client $client,
        ClientContact $contact,
        array $data,
        string $companyId,
    ): ClientContact {
        $this->assertContactBelongsToClient($client, $contact, $companyId);

        $contact->update($this->contactAttributes($data));

        return $contact->refresh();
    }

    public function deleteContact(Client $client, ClientContact $contact, string $companyId): void
    {
        $this->assertContactBelongsToClient($client, $contact, $companyId);

        $contact->delete();
    }

    public function legalEntities(Client $client, string $companyId): Collection
    {
        $this->assertClientCompany($client, $companyId);

        return $client->legalEntities()
            ->with(['bankDetails'])
            ->orderBy('name')
            ->get();
    }

    public function createLegalEntity(Client $client, array $data, string $companyId): ClientLegalEntity
    {
        $this->assertClientCompany($client, $companyId);

        return ClientLegalEntity::create($this->legalEntityAttributes($data, [
            'id' => (string) Str::uuid(),
            'client_id' => $client->id,
        ]))->load(['bankDetails']);
    }

    public function showLegalEntity(
        Client $client,
        ClientLegalEntity $legalEntity,
        string $companyId,
    ): ClientLegalEntity {
        $this->assertLegalEntityBelongsToClient($client, $legalEntity, $companyId);

        return $legalEntity->load(['bankDetails']);
    }

    public function updateLegalEntity(
        Client $client,
        ClientLegalEntity $legalEntity,
        array $data,
        string $companyId,
    ): ClientLegalEntity {
        $this->assertLegalEntityBelongsToClient($client, $legalEntity, $companyId);

        $legalEntity->update($this->legalEntityAttributes($data));

        return $legalEntity->refresh()->load(['bankDetails']);
    }

    public function deleteLegalEntity(
        Client $client,
        ClientLegalEntity $legalEntity,
        string $companyId,
    ): void {
        $this->assertLegalEntityBelongsToClient($client, $legalEntity, $companyId);

        $legalEntity->delete();
    }

    public function bankDetails(
        Client $client,
        ClientLegalEntity $legalEntity,
        string $companyId,
    ): Collection {
        $this->assertLegalEntityBelongsToClient($client, $legalEntity, $companyId);

        return $legalEntity->bankDetails()
            ->orderBy('bank')
            ->get();
    }

    public function createBankDetail(
        Client $client,
        ClientLegalEntity $legalEntity,
        array $data,
        string $companyId,
    ): ClientLegalEntityBankDetail {
        $this->assertLegalEntityBelongsToClient($client, $legalEntity, $companyId);

        return ClientLegalEntityBankDetail::create($this->bankDetailAttributes($data, [
            'id' => (string) Str::uuid(),
            'client_legal_entity_id' => $legalEntity->id,
        ]));
    }

    public function showBankDetail(
        Client $client,
        ClientLegalEntity $legalEntity,
        ClientLegalEntityBankDetail $bankDetail,
        string $companyId,
    ): ClientLegalEntityBankDetail {
        $this->assertBankDetailBelongsToLegalEntity($client, $legalEntity, $bankDetail, $companyId);

        return $bankDetail;
    }

    public function updateBankDetail(
        Client $client,
        ClientLegalEntity $legalEntity,
        ClientLegalEntityBankDetail $bankDetail,
        array $data,
        string $companyId,
    ): ClientLegalEntityBankDetail {
        $this->assertBankDetailBelongsToLegalEntity($client, $legalEntity, $bankDetail, $companyId);

        $bankDetail->update($this->bankDetailAttributes($data));

        return $bankDetail->refresh();
    }

    public function deleteBankDetail(
        Client $client,
        ClientLegalEntity $legalEntity,
        ClientLegalEntityBankDetail $bankDetail,
        string $companyId,
    ): void {
        $this->assertBankDetailBelongsToLegalEntity($client, $legalEntity, $bankDetail, $companyId);

        $bankDetail->delete();
    }

    private function contactAttributes(array $data, array $base = []): array
    {
        return array_merge($base, [
            'first_name' => trim((string) $data['first_name']),
            'last_name' => $this->nullableString($data['last_name'] ?? null),
            'middle_name' => $this->nullableString($data['middle_name'] ?? null),
            'email' => $this->nullableString($data['email'] ?? null),
            'phone' => $this->nullableString($data['phone'] ?? null),
            'position' => $this->nullableString($data['position'] ?? null),
            'comments' => $this->nullableString($data['comments'] ?? null),
            'payload' => $data['payload'] ?? null,
        ]);
    }

    private function legalEntityAttributes(array $data, array $base = []): array
    {
        return array_merge($base, [
            'name' => trim((string) $data['name']),
            'legal_address' => trim((string) $data['legal_address']),
            'postal_code' => trim((string) $data['postal_code']),
            'inn' => trim((string) $data['inn']),
            'kpp' => $this->nullableString($data['kpp'] ?? null),
            'ogrn' => $this->nullableString($data['ogrn'] ?? null),
            'signer_last_name' => $this->nullableString($data['signer_last_name'] ?? null),
            'signer_first_name' => $this->nullableString($data['signer_first_name'] ?? null),
            'signer_middle_name' => $this->nullableString($data['signer_middle_name'] ?? null),
            'signer_position' => $this->nullableString($data['signer_position'] ?? null),
            'phone' => $this->nullableString($data['phone'] ?? null),
            'email' => $this->nullableString($data['email'] ?? null),
        ]);
    }

    private function bankDetailAttributes(array $data, array $base = []): array
    {
        return array_merge($base, [
            'checking_account' => trim((string) $data['checking_account']),
            'bank' => trim((string) $data['bank']),
            'bik' => trim((string) $data['bik']),
            'correspondent_account' => trim((string) $data['correspondent_account']),
        ]);
    }

    private function assertClientCompany(Client $client, string $companyId): void
    {
        if ((string) $client->company_id !== $companyId) {
            throw new NotFoundHttpException;
        }
    }

    private function assertContactBelongsToClient(
        Client $client,
        ClientContact $contact,
        string $companyId,
    ): void {
        $this->assertClientCompany($client, $companyId);

        if ((string) $contact->client_id !== (string) $client->id) {
            throw new NotFoundHttpException;
        }
    }

    private function assertLegalEntityBelongsToClient(
        Client $client,
        ClientLegalEntity $legalEntity,
        string $companyId,
    ): void {
        $this->assertClientCompany($client, $companyId);

        if ((string) $legalEntity->client_id !== (string) $client->id) {
            throw new NotFoundHttpException;
        }
    }

    private function assertBankDetailBelongsToLegalEntity(
        Client $client,
        ClientLegalEntity $legalEntity,
        ClientLegalEntityBankDetail $bankDetail,
        string $companyId,
    ): void {
        $this->assertLegalEntityBelongsToClient($client, $legalEntity, $companyId);

        if ((string) $bankDetail->client_legal_entity_id !== (string) $legalEntity->id) {
            throw new NotFoundHttpException;
        }
    }

    private function nullableString(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $value = trim((string) $value);

        return $value === '' ? null : $value;
    }

    private function attachCurrentRatesToClients(Collection $clients): void
    {
        $projectIds = $clients
            ->flatMap(fn (Client $client): Collection => $client->projects)
            ->pluck('id')
            ->map(static fn ($id): string => (string) $id)
            ->unique()
            ->values()
            ->all();

        if ($projectIds === []) {
            return;
        }

        $ratesByProject = ProjectRate::currentForProjects(
            $projectIds,
            Company::todayFor((string) $clients->first()->company_id),
        );

        $clients->each(function (Client $client) use ($ratesByProject): void {
            $client->projects->each(function ($project) use ($ratesByProject): void {
                $project->current_rate = $ratesByProject[(string) $project->id] ?? null;
            });
        });
    }
}
