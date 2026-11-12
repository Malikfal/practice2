<?php

namespace Tests\Unit\Workspace;

use App\Enums\FinanceArticleDistributionMethod;
use App\Enums\FinanceSource;
use App\Enums\FinanceType;
use App\Models\Client;
use App\Models\Finance;
use App\Models\FinanceArticle;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use App\Services\Workspace\FinancialResultServices\Data\FinancialResultInputData;
use App\Services\Workspace\FinancialResultServices\FinancialResultFilterService;
use App\Services\Workspace\FinancialResultServices\Reports\FinancialResultReportService;
use Tests\TestCase;

class FinancialResultReportServiceTest extends TestCase
{
    public function test_report_uses_payment_date_and_preserves_project_detail_rules(): void
    {
        $filters = $this->app->make(FinancialResultFilterService::class)->fromArray([
            'from' => '2026-09-01',
            'to' => '2026-09-30',
            'granularity' => 'month',
        ]);
        $incomeArticle = $this->article('income', 'Продажи', FinanceType::ENTRANCE);
        $salaryArticle = $this->article('salary', 'Зарплата', FinanceType::EXPENDITURE);
        $hostingArticle = $this->article('hosting', 'Хостинг', FinanceType::EXPENDITURE);
        $employee = new User(['id' => 'employee', 'name' => 'Анна', 'last_name' => 'Иванова', 'email' => 'anna@example.test']);
        $managerOne = new User(['id' => 'manager-1', 'name' => 'Первый', 'last_name' => 'Менеджер']);
        $managerTwo = new User(['id' => 'manager-2', 'name' => 'Второй', 'last_name' => 'Менеджер']);
        $projectOne = $this->project('project-1', 'Проект 1', 'client-1', [$managerOne, $managerTwo]);
        $projectTwo = $this->project('project-2', 'Проект 2', 'client-1');
        $finances = collect([
            $this->finance('income-1', 'project-1', 1000, FinanceType::ENTRANCE, '2026-09-02', $incomeArticle),
            $this->finance('salary-1', 'project-1', 300, FinanceType::EXPENDITURE, '2026-09-03', $salaryArticle, $employee),
            $this->finance('hosting-1', 'project-1', 100, FinanceType::EXPENDITURE, '2026-09-04', $hostingArticle),
            $this->finance('income-2', 'project-2', 500, FinanceType::ENTRANCE, '2026-09-05', $incomeArticle),
            $this->finance('hosting-2', 'project-2', 700, FinanceType::EXPENDITURE, '2026-09-06', $hostingArticle),
            $this->finance('without-project', null, 200, FinanceType::EXPENDITURE, '2026-09-07', $hostingArticle),
        ]);
        $input = new FinancialResultInputData(
            $filters,
            collect([$projectOne, $projectTwo])->keyBy('id'),
            $finances,
            collect([$incomeArticle, $salaryArticle, $hostingArticle]),
        );
        $reports = $this->app->make(FinancialResultReportService::class);
        $result = $reports->build($input);
        $overview = $reports->overview($result);
        $projects = collect($reports->projects($result)['data'])->keyBy('project.id');
        $managers = collect($reports->managers($result)['data'])->keyBy('manager.id');
        $clients = $reports->clients($result)['data'];

        $this->assertSame(['income' => 1500, 'expenses' => 1300, 'profit' => 200], $overview['summary']);
        $this->assertSame(1500, $overview['histogram'][0]['income']);
        $this->assertSame(1300, $overview['histogram'][0]['expenses']);
        $this->assertSame(-200, $projects['project-2']['profit']);
        $this->assertSame('Без проекта', $projects['']['project']['name']);
        $this->assertSame(200, $projects['']['expenses']);
        $this->assertSame(300, $projects['project-1']['employee_expenses']);
        $this->assertSame(100, $projects['project-1']['other_expenses']);
        $this->assertSame('employee', $projects['project-1']['employees'][0]['employee']['id']);
        $this->assertSame('income', $projects['project-1']['income_articles'][0]['article']['id']);
        $this->assertSame(1000, $projects['project-1']['income_articles'][0]['income']);
        $this->assertSame('hosting', $projects['project-1']['expense_articles'][0]['article']['id']);

        // В overview зарплата остаётся в разрезе статей, хотя в проекте она показана через сотрудника.
        $salary = collect($overview['expense_articles'])->firstWhere('article_id', 'salary');
        $this->assertSame(300, $salary['amount']);
        $this->assertSame(1000, $managers['manager-1']['income']);
        $this->assertSame(1000, $managers['manager-2']['income']);
        $this->assertCount(2, $clients);
        $this->assertArrayNotHasKey('projects', $clients[0]);
        $this->assertSame(200, collect($clients)->sum('profit'));
    }

    private function article(string $id, string $name, FinanceType $type): FinanceArticle
    {
        return new FinanceArticle([
            'id' => $id,
            'parent_id' => null,
            'name' => $name,
            'type' => $type,
            'distribution_method' => FinanceArticleDistributionMethod::BY_TERM,
        ]);
    }

    /** @param  list<User>  $managers */
    private function project(string $id, string $name, string $clientId, array $managers = []): Project
    {
        $project = new Project(['id' => $id, 'name' => $name, 'status' => 'ACTIVE']);
        $project->setRelation('client', new Client(['id' => $clientId, 'name' => 'Клиент']));
        $project->setRelation('members', collect($managers)->map(function (User $manager) use ($id): ProjectMember {
            $member = new ProjectMember(['project_id' => $id, 'user_id' => $manager->id, 'is_pm' => true]);
            $member->setRelation('user', $manager);

            return $member;
        }));

        return $project;
    }

    private function finance(
        string $id,
        ?string $projectId,
        int $amount,
        FinanceType $type,
        string $paymentDate,
        FinanceArticle $article,
        ?User $employee = null,
    ): Finance {
        $finance = new Finance([
            'id' => $id,
            'project_id' => $projectId,
            'amount' => $amount,
            'type' => $type,
            'source' => FinanceSource::MANUAL,
            'dateOfPayment' => $paymentDate,
            // Эти даты намеренно не совпадают с периодом: новый отчёт не должен их читать.
            'distribution_from' => '2030-01-01',
            'distribution_to' => '2030-12-31',
            'finance_article_id' => $article->id,
            'employee_id' => $employee?->id,
        ]);
        $finance->setRelation('article', $article);
        $finance->setRelation('employee', $employee);

        return $finance;
    }
}
