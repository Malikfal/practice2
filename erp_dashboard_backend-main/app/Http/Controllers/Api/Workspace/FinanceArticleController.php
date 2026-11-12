<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\DeleteFinanceRequest;
use App\Http\Requests\Workspace\FinanceArticleIndexRequest;
use App\Http\Requests\Workspace\FinanceViewRequest;
use App\Http\Requests\Workspace\StoreFinanceArticleRequest;
use App\Http\Requests\Workspace\UpdateFinanceArticleRequest;
use App\Http\Responses\Workspace\FinanceArticleIndexResponse;
use App\Http\Responses\Workspace\FinanceArticleResponse;
use App\Models\FinanceArticle;
use App\Services\Workspace\FinanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

class FinanceArticleController extends Controller
{
    public function __construct(
        private readonly FinanceService $finances,
    ) {}

    public function index(FinanceArticleIndexRequest $request): JsonResponse
    {
        return new FinanceArticleIndexResponse(
            $this->finances->articles($request->validated(), $this->companyId($request)),
        );
    }

    public function store(StoreFinanceArticleRequest $request): JsonResponse
    {
        return new FinanceArticleResponse(
            $this->finances->createArticle($request->validated(), $this->companyId($request)),
            201,
        );
    }

    public function show(FinanceViewRequest $request, FinanceArticle $article): JsonResponse
    {
        return new FinanceArticleResponse(
            $this->finances->showArticle($article, $this->companyId($request)),
        );
    }

    public function update(UpdateFinanceArticleRequest $request, FinanceArticle $article): JsonResponse
    {
        return new FinanceArticleResponse(
            $this->finances->updateArticle($article, $request->validated(), $this->companyId($request)),
        );
    }

    public function destroy(DeleteFinanceRequest $request, FinanceArticle $article): Response
    {
        $this->finances->deleteArticle($article, $this->companyId($request));

        return response()->noContent();
    }
}
