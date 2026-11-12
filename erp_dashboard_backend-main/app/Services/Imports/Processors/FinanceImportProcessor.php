<?php

namespace App\Services\Imports\Processors;

use App\Enums\FinanceArticleDistributionMethod;
use App\Enums\FinanceSource;
use App\Enums\FinanceType;
use App\Models\Client;
use App\Models\DataImport;
use App\Models\FinanceArticle;
use App\Models\Project;
use App\Models\User;
use App\Services\Imports\SpreadsheetReader;
use App\Services\Workspace\ClientService;
use App\Services\Workspace\FinanceService;
use App\Services\Workspace\ProjectService;
use BackedEnum;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class FinanceImportProcessor extends AbstractImportProcessor
{
    private Collection $articles;

    private Collection $clients;

    private Collection $projects;

    private Collection $employees;

    private ?string $loadedCompanyId = null;

    public function __construct(
        SpreadsheetReader $reader,
        private readonly FinanceService $finances,
        private readonly ClientService $clientService,
        private readonly ProjectService $projectService,
    ) {
        parent::__construct($reader);
    }

    protected function requiredHeaders(): array
    {
        return ['date', 'type', 'amount'];
    }

    protected function headerAliases(): array
    {
        return [
            'date' => ['Дата'],
            'type' => ['Тип'],
            'article' => ['Статья'],
            'amount' => ['Сумма'],
            'project' => ['Проект'],
            'client' => ['Клиент'],
            'employee' => ['Участник', 'Сотрудник'],
            'comment' => ['Комментарий'],
        ];
    }

    protected function importRow(DataImport $import, array $row): array
    {
        $this->loadContext($import->company_id);
        $warnings = [];
        $type = $this->financeType($this->text($row['type'] ?? null));
        $article = $this->resolveArticle($import->company_id, $this->text($row['article'] ?? null), $type);
        $employee = $this->resolveEmployee($this->text($row['employee'] ?? null), $warnings);
        $project = $this->resolveProject(
            $import,
            $this->text($row['project'] ?? null),
            $this->text($row['client'] ?? null),
            $warnings,
        );
        try {
            $date = $this->date($row['date'] ?? null, 'date');
        } catch (ValidationException) {
            throw ValidationException::withMessages(['date' => ['Некорректная или отсутствует дата.']]);
        }
        if ($date === null) {
            throw ValidationException::withMessages(['date' => ['Некорректная или отсутствует дата.']]);
        }

        $normalized = [
            'project_id' => $project?->id,
            'finance_article_id' => $article?->id,
            'employee_id' => $employee?->id,
            'amount' => $this->rublesToKopecks($row['amount'] ?? null, 'amount'),
            'type' => $type->value,
            'source' => FinanceSource::IMPORT->value,
            'comment' => $this->text($row['comment'] ?? null),
            'dateOfPayment' => $date,
        ];

        return [
            'model' => $this->finances->create($normalized, $import->company_id),
            'normalized' => $normalized,
            'warnings' => $warnings ?: null,
        ];
    }

    protected function afterRowFailure(DataImport $import): void
    {
        $this->loadedCompanyId = null;
    }

    private function financeType(?string $value): FinanceType
    {
        $normalized = mb_strtolower((string) $value);
        if (in_array($normalized, ['поступление', 'приход', 'entrance', 'income'], true)) {
            return FinanceType::ENTRANCE;
        }
        if (in_array($normalized, ['расход', 'expenditure', 'expense'], true)) {
            return FinanceType::EXPENDITURE;
        }

        throw ValidationException::withMessages(['type' => [sprintf('Тип "%s" не распознан.', (string) $value)]]);
    }

    private function resolveArticle(string $companyId, ?string $name, FinanceType $type): ?FinanceArticle
    {
        if ($name === null) {
            return null;
        }

        $normalized = $this->normalizeLookup($name);
        $article = $this->articles->first(fn (FinanceArticle $item): bool => $this->normalizeLookup($item->name) === $normalized && $this->enumValue($item->type) === $type->value);
        if ($article) {
            return $article;
        }

        $this->transactionLock("finance-article:{$companyId}:{$type->value}:{$normalized}");
        $article = FinanceArticle::query()
            ->where('company_id', $companyId)
            ->where('type', $type->value)
            ->get()
            ->first(fn (FinanceArticle $item): bool => $this->normalizeLookup($item->name) === $normalized);

        if (! $article) {
            $article = $this->finances->createArticle([
                'name' => $name,
                'type' => $type->value,
                'parent_id' => null,
                'distribution_method' => FinanceArticleDistributionMethod::BY_TERM->value,
            ], $companyId);
        }

        $this->articles->push($article);

        return $article;
    }

    private function resolveEmployee(?string $email, array &$warnings): ?User
    {
        if ($email === null) {
            return null;
        }

        $employee = $this->employees->first(fn (User $item): bool => mb_strtolower(trim((string) $item->email)) === mb_strtolower($email));
        if (! $employee) {
            $warnings[] = "Сотрудник с email \"{$email}\" не найден. Платёж создан без участника.";
        }

        return $employee;
    }

    private function resolveProject(DataImport $import, ?string $projectName, ?string $clientName, array &$warnings): ?Project
    {
        if ($projectName === null) {
            return null;
        }

        $normalizedProject = $this->normalizeLookup($projectName);
        $projects = $this->projects->filter(fn (Project $project): bool => $this->normalizeLookup($project->name) === $normalizedProject)->values();
        if ($projects->isEmpty()) {
            $warnings[] = "Проект \"{$projectName}\" не найден. Платёж создан без проекта.";

            return null;
        }

        if ($clientName === null) {
            if ($projects->count() === 1) {
                return $projects->first();
            }
            $warnings[] = "Найдено несколько проектов \"{$projectName}\". Платёж создан без проекта.";

            return null;
        }

        $normalizedClient = $this->normalizeLookup($clientName);
        $client = $this->clients->first(fn (Client $item): bool => $this->normalizeLookup($item->name) === $normalizedClient);
        if ($client) {
            $matching = $projects->filter(fn (Project $project): bool => (string) $project->client_id === (string) $client->id)->values();
            if ($matching->count() === 1) {
                return $matching->first();
            }
            if ($matching->count() > 1) {
                $warnings[] = "Найдено несколько проектов \"{$projectName}\" для клиента \"{$clientName}\". Платёж создан без проекта.";

                return null;
            }
        }

        $withoutClient = $projects->filter(fn (Project $project): bool => $project->client_id === null)->values();
        if ($withoutClient->count() === 1) {
            $client ??= $this->createClient($import->company_id, $clientName);
            $project = $withoutClient->first();
            $project = $this->projectService->update($project, [
                'name' => $project->name,
                'description' => $project->description,
                'status' => $this->enumValue($project->status),
                'client_id' => $client->id,
                'starts_at' => $project->starts_at,
                'ends_at' => $project->ends_at,
                'budget' => $project->budget,
                'manager_payment_method' => $this->enumValue($project->manager_payment_method),
            ]);
            $this->replaceProjectInContext($project);

            return $project;
        }
        if ($withoutClient->count() > 1) {
            $warnings[] = "Найдено несколько проектов \"{$projectName}\" без клиента. Платёж создан без проекта.";

            return null;
        }

        if ($projects->count() === 1) {
            $warnings[] = "Проект \"{$projectName}\" уже привязан к другому клиенту. Платёж создан с указанным проектом.";

            return $projects->first();
        }

        $warnings[] = "Найдено несколько проектов \"{$projectName}\" с другими клиентами. Платёж создан без проекта.";

        return null;
    }

    private function createClient(string $companyId, string $name): Client
    {
        $normalized = $this->normalizeLookup($name);
        $this->transactionLock("client:{$companyId}:{$normalized}");
        $client = Client::query()->where('company_id', $companyId)->get()
            ->first(fn (Client $item): bool => $this->normalizeLookup($item->name) === $normalized);
        if (! $client) {
            $client = $this->clientService->create(['name' => $name, 'description' => ''], $companyId);
        }
        if (! $this->clients->contains('id', $client->id)) {
            $this->clients->push($client);
        }

        return $client;
    }

    private function loadContext(string $companyId): void
    {
        if ($this->loadedCompanyId === $companyId) {
            return;
        }

        $this->articles = FinanceArticle::query()->where('company_id', $companyId)->get();
        $this->clients = Client::query()->where('company_id', $companyId)->get();
        $this->projects = Project::query()->where('company_id', $companyId)->with('client')->get();
        $this->employees = User::withBlocked()->where('company_id', $companyId)->get();
        $this->loadedCompanyId = $companyId;
    }

    private function replaceProjectInContext(Project $updated): void
    {
        $this->projects = $this->projects->map(fn (Project $project): Project => (string) $project->id === (string) $updated->id ? $updated : $project);
    }

    private function normalizeLookup(mixed $value): string
    {
        return str_replace('ё', 'е', mb_strtolower(trim(preg_replace('/\s+/u', ' ', (string) $value) ?? '')));
    }

    private function enumValue(mixed $value): string
    {
        return $value instanceof BackedEnum ? (string) $value->value : (string) $value;
    }

    private function transactionLock(string $key): void
    {
        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::select('SELECT pg_advisory_xact_lock(hashtext(?))', [$key]);
        }
    }
}
