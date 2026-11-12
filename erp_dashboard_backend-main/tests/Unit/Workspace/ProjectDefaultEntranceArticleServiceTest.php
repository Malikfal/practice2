<?php

namespace Tests\Unit\Workspace;

use App\Enums\UserPermission;
use App\Http\Requests\Workspace\ProjectDefaultEntranceArticleBatchRequest;
use App\Http\Requests\Workspace\UpdateProjectDefaultEntranceArticleRequest;
use App\Http\Resources\Workspace\ProjectDefaultEntranceArticleResource;
use App\Models\Project;
use App\Models\User;
use App\Services\Workspace\ProjectDefaultEntranceArticleService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Mockery;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Tests\TestCase;

class ProjectDefaultEntranceArticleServiceTest extends TestCase
{
    private const INCOME_ID = '00000000-0000-0000-0000-000000000001';

    private const EXPENSE_ID = '00000000-0000-0000-0000-000000000002';

    private const FOREIGN_ID = '00000000-0000-0000-0000-000000000003';

    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('finance_article', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('company_id');
            $table->string('name');
            $table->string('type');
        });
        Schema::create('projects', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('company_id');
            $table->string('default_entrance_finance_article_id')->nullable();
            $table->timestamps();
        });

        DB::table('projects')->insert([
            'id' => 'project', 'company_id' => 'company',
            'created_at' => now(), 'updated_at' => now(),
        ]);
        DB::table('finance_article')->insert([
            ['id' => self::INCOME_ID, 'company_id' => 'company', 'name' => 'Income', 'type' => 'ENTRANCE'],
            ['id' => self::EXPENSE_ID, 'company_id' => 'company', 'name' => 'Expense', 'type' => 'EXPENDITURE'],
            ['id' => self::FOREIGN_ID, 'company_id' => 'other', 'name' => 'Foreign', 'type' => 'ENTRANCE'],
        ]);
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('projects');
        Schema::dropIfExists('finance_article');
        parent::tearDown();
    }

    public function test_update_accepts_company_income_article_and_null(): void
    {
        $actor = Mockery::mock(User::class);
        $actor->shouldReceive('canPerformProjectAction')
            ->with(Mockery::type(Project::class), UserPermission::PROJECTS_CREATE_UPDATE->value)
            ->andReturn(true);

        $service = new ProjectDefaultEntranceArticleService;
        $project = Project::query()->findOrFail('project');
        $updated = $service->update($actor, $project, self::INCOME_ID);
        $this->assertSame(self::INCOME_ID, $updated->default_entrance_finance_article_id);
        $this->assertSame('Income', $updated->defaultEntranceFinanceArticle->name);

        $cleared = $service->update($actor, $updated, null);
        $this->assertNull($cleared->default_entrance_finance_article_id);
        $this->assertNull($cleared->defaultEntranceFinanceArticle);
    }

    public function test_update_rejects_expense_and_foreign_income_articles(): void
    {
        $actor = Mockery::mock(User::class);
        $actor->shouldReceive('canPerformProjectAction')->andReturn(true);
        $service = new ProjectDefaultEntranceArticleService;

        foreach ([self::EXPENSE_ID, self::FOREIGN_ID] as $articleId) {
            try {
                $service->update($actor, Project::query()->findOrFail('project'), $articleId);
                $this->fail("Expected validation error for $articleId");
            } catch (ValidationException $exception) {
                $this->assertArrayHasKey('default_entrance_finance_article_id', $exception->errors());
            }
        }
        $this->assertNull(Project::query()->findOrFail('project')->default_entrance_finance_article_id);
    }

    public function test_update_requires_the_same_project_permission_as_rates(): void
    {
        $actor = Mockery::mock(User::class);
        $actor->shouldReceive('canPerformProjectAction')->andReturn(false);

        $this->expectException(NotFoundHttpException::class);
        (new ProjectDefaultEntranceArticleService)->update(
            $actor, Project::query()->findOrFail('project'), self::INCOME_ID,
        );
    }

    public function test_show_requires_about_tab_access_and_returns_article(): void
    {
        DB::table('projects')->where('id', 'project')->update([
            'default_entrance_finance_article_id' => self::INCOME_ID,
        ]);
        $project = Project::query()->findOrFail('project');
        $service = new ProjectDefaultEntranceArticleService;

        $viewer = Mockery::mock(User::class);
        $viewer->shouldReceive('can')
            ->with(UserPermission::PROJECTS_TABS_ABOUT_VIEW->value)->andReturn(true);
        $viewer->shouldReceive('canAccessProject')->with($project)->andReturn(true);
        $this->assertSame(self::INCOME_ID, $service->show($viewer, $project)
            ->defaultEntranceFinanceArticle->id);

        $denied = Mockery::mock(User::class);
        $denied->shouldReceive('can')
            ->with(UserPermission::PROJECTS_TABS_ABOUT_VIEW->value)->andReturn(false);
        $this->expectException(NotFoundHttpException::class);
        $service->show($denied, $project);
    }

    public function test_request_accepts_only_a_company_income_article_or_null(): void
    {
        $request = UpdateProjectDefaultEntranceArticleRequest::create('/projects/project/default-entrance-article', 'PATCH');
        $project = Project::query()->findOrFail('project');
        $request->setRouteResolver(static fn () => new class($project)
        {
            public function __construct(private readonly Project $project) {}

            public function parameter(string $key): ?Project
            {
                return $key === 'project' ? $this->project : null;
            }
        });

        foreach ([self::INCOME_ID, null] as $articleId) {
            $this->assertFalse(Validator::make([
                'default_entrance_finance_article_id' => $articleId,
            ], $request->rules())->fails());
        }
        foreach ([self::EXPENSE_ID, self::FOREIGN_ID] as $articleId) {
            $this->assertTrue(Validator::make([
                'default_entrance_finance_article_id' => $articleId,
            ], $request->rules())->fails());
        }
        $this->assertTrue(Validator::make([], $request->rules())->fails());
    }

    public function test_batch_read_preserves_requested_order_and_rejects_inaccessible_projects(): void
    {
        DB::table('projects')->insert([
            'id' => 'second', 'company_id' => 'company',
            'default_entrance_finance_article_id' => self::INCOME_ID,
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $actor = Mockery::mock(User::class);
        $actor->shouldReceive('can')->with(UserPermission::PROJECTS_TABS_ABOUT_VIEW->value)->andReturn(true);
        $actor->shouldReceive('canAccessProject')->andReturn(true);

        $projects = (new ProjectDefaultEntranceArticleService)->showMany($actor, ['second', 'project']);
        $this->assertSame(['second', 'project'], $projects->pluck('id')->all());
        $this->assertSame(self::INCOME_ID, $projects[0]->defaultEntranceFinanceArticle->id);
        $this->assertNull($projects[1]->defaultEntranceFinanceArticle);

        $denied = Mockery::mock(User::class);
        $denied->shouldReceive('can')->with(UserPermission::PROJECTS_TABS_ABOUT_VIEW->value)->andReturn(true);
        $denied->shouldReceive('canAccessProject')->andReturnUsing(
            static fn (Project $project): bool => $project->id !== 'second',
        );
        $this->expectException(NotFoundHttpException::class);
        (new ProjectDefaultEntranceArticleService)->showMany($denied, ['project', 'second']);
    }

    public function test_batch_request_requires_distinct_uuid_project_ids(): void
    {
        $rules = (new ProjectDefaultEntranceArticleBatchRequest)->rules();
        $id = '00000000-0000-0000-0000-000000000010';

        $this->assertFalse(Validator::make(['project_ids' => [$id]], $rules)->fails());
        $this->assertTrue(Validator::make(['project_ids' => []], $rules)->fails());
        $this->assertTrue(Validator::make(['project_ids' => [$id, $id]], $rules)->fails());
        $this->assertTrue(Validator::make(['project_ids' => ['not-a-uuid']], $rules)->fails());
    }

    public function test_resource_has_the_same_shape_for_single_and_batch_responses(): void
    {
        DB::table('projects')->where('id', 'project')->update([
            'default_entrance_finance_article_id' => self::INCOME_ID,
        ]);
        $project = Project::query()->with('defaultEntranceFinanceArticle')->findOrFail('project');

        $single = ProjectDefaultEntranceArticleResource::make($project)->resolve(request());
        $batch = ProjectDefaultEntranceArticleResource::collection(collect([$project]))->resolve(request());

        $this->assertSame($single, $batch[0]);
        $this->assertSame('project', $single['project_id']);
        $this->assertSame(self::INCOME_ID, $single['default_entrance_finance_article_id']);
        $this->assertSame(['id' => self::INCOME_ID, 'name' => 'Income'], $single['default_entrance_finance_article']);
    }
}
