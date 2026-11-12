<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\ProjectExportRequest;
use App\Services\Workspace\ProjectExportService;
use Illuminate\Http\Response;

class ProjectExportController extends Controller
{
    public function __construct(
        private readonly ProjectExportService $exports,
    ) {
    }

    public function __invoke(ProjectExportRequest $request): Response
    {
        $content = $this->exports->csv(
            $request->validated(),
            (string) $request->user()->company_id,
        );

        return response($content, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="projects.csv"',
        ]);
    }
}
