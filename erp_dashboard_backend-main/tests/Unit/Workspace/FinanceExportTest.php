<?php

namespace Tests\Unit\Workspace;

use App\Enums\FinanceType;
use App\Exports\FinanceExport;
use App\Models\Client;
use App\Models\Finance;
use App\Models\FinanceArticle;
use App\Models\Project;
use App\Models\User;
use Tests\TestCase;

class FinanceExportTest extends TestCase
{
    public function test_it_exports_columns_accepted_by_finance_import(): void
    {
        $client = new Client(['name' => 'ООО Клиент']);
        $project = new Project(['name' => 'ERP']);
        $project->setRelation('client', $client);

        $finance = new Finance([
            'dateOfPayment' => '2026-08-28',
            'type' => FinanceType::ENTRANCE,
            'amount' => 123456,
            'comment' => 'Оплата этапа',
        ]);
        $finance->setRelation('article', new FinanceArticle(['name' => 'Разработка']));
        $finance->setRelation('project', $project);
        $finance->setRelation('employee', new User(['email' => 'employee@example.com']));

        $export = new FinanceExport(collect([$finance]));

        $this->assertSame([
            'Дата',
            'Тип',
            'Статья',
            'Сумма',
            'Проект',
            'Клиент',
            'Участник',
            'Комментарий',
        ], $export->headings());
        $this->assertSame([
            '28.08.2026',
            'Поступление',
            'Разработка',
            '1234.56',
            'ERP',
            'ООО Клиент',
            'employee@example.com',
            'Оплата этапа',
        ], $export->map($finance));
        $this->assertSame(['delimiter' => ';', 'use_bom' => true], $export->getCsvSettings());
    }
}
