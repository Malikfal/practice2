<?php

namespace App\Services\Imports\Processors;

use App\Enums\ProjectStatus;
use App\Models\Client;
use App\Models\DataImport;
use App\Models\User;
use App\Services\Imports\SpreadsheetReader;
use App\Services\Workspace\ProjectService;
use Illuminate\Validation\ValidationException;

class ProjectImportProcessor extends AbstractImportProcessor
{
    public function __construct(SpreadsheetReader $reader, private readonly ProjectService $projects)
    {
        parent::__construct($reader);
    }

    protected function requiredHeaders(): array
    {
        return ['name'];
    }

    protected function headerAliases(): array
    {
        return [
            'name' => ['Название', 'name'],
            'description' => ['Описание', 'description'],
            'status' => ['Статус', 'status'],
            'client' => ['Клиент', 'client'],
            'managers' => ['Менеджеры', 'managers'],
            'members' => ['Участники', 'members'],
            'weekly_hours' => ['Часы за неделю', 'weekly hours'],
            'spent' => ['Затрачено', 'spent'],
            'budget' => ['Бюджет', 'budget'],
            'period' => ['Сроки', 'period'],
        ];
    }

    protected function importRow(DataImport $import, array $row): array
    {
        $actor = User::withBlocked()->findOrFail($import->created_by_id);
        $warnings = [];
        $client = $this->client($import->company_id, $this->text($row['client'] ?? null), $warnings);
        $status = $this->status($this->text($row['status'] ?? null), $warnings);
        $normalized = [
            'name' => $this->requiredName($row['name'] ?? null),
            'description' => $this->text($row['description'] ?? null) ?? '',
            'status' => $status->value,
            'client_id' => $client?->id,
            'starts_at' => null,
            'ends_at' => null,
            'budget' => null,
        ];

        foreach ([
            'managers' => 'Менеджеры',
            'members' => 'Участники',
            'weekly_hours' => 'Часы за неделю',
            'spent' => 'Затрачено',
            'budget' => 'Бюджет',
            'period' => 'Сроки',
        ] as $key => $label) {
            if ($this->text($row[$key] ?? null) !== null) {
                $warnings[] = "Колонка «{$label}» пока не поддерживается и не была импортирована.";
            }
        }

        return [
            'model' => $this->projects->create($actor, $normalized),
            'normalized' => $normalized,
            'warnings' => $warnings ?: null,
        ];
    }

    private function requiredName(mixed $value): string
    {
        return $this->text($value) ?? throw ValidationException::withMessages(['name' => ['Отсутствует название проекта.']]);
    }

    private function status(?string $value, array &$warnings): ProjectStatus
    {
        if ($value === null) {
            return ProjectStatus::ACTIVE;
        }

        $normalized = mb_strtolower($value);
        $status = match ($normalized) {
            'active', 'активный' => ProjectStatus::ACTIVE,
            'archived', 'архив' => ProjectStatus::ARCHIVED,
            default => null,
        };
        if (! $status) {
            $warnings[] = "Статус \"{$value}\" не распознан, установлен ACTIVE.";

            return ProjectStatus::ACTIVE;
        }

        return $status;
    }

    private function client(string $companyId, ?string $name, array &$warnings): ?Client
    {
        if ($name === null) {
            return null;
        }

        $normalized = mb_strtolower($name);
        $client = Client::query()->where('company_id', $companyId)->get()
            ->first(fn (Client $item): bool => mb_strtolower(trim((string) $item->name)) === $normalized);
        if (! $client) {
            $warnings[] = "Клиент \"{$name}\" не найден. Проект создан без клиента.";
        }

        return $client;
    }
}
