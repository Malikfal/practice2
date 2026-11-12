<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\PayrollPayoutArticleIndexRequest;
use App\Http\Requests\Workspace\PayrollPayoutArticleManageRequest;
use App\Http\Requests\Workspace\SavePayrollPayoutArticleRequest;
use App\Models\PayrollPayoutArticle;
use App\Services\Workspace\PayrollPayoutArticleService;
use Illuminate\Http\JsonResponse;

class PayrollPayoutArticleController extends Controller
{
    public function __construct(
        private readonly PayrollPayoutArticleService $articles,
    ) {}

    public function index(PayrollPayoutArticleIndexRequest $request): JsonResponse
    {
        return response()->json(['data' => $this->articles->list($this->companyId($request))->all()]);
    }

    public function store(SavePayrollPayoutArticleRequest $request): JsonResponse
    {
        return response()->json(
            $this->articles->create($this->companyId($request), $request->validated('name')),
            201,
        );
    }

    public function update(SavePayrollPayoutArticleRequest $request, PayrollPayoutArticle $article): JsonResponse
    {
        return response()->json(
            $this->articles->rename($article, $this->companyId($request), $request->validated('name')),
        );
    }

    /** Статья с выплатами не удаляется, а уходит в архив: ответ содержит ее новое состояние. */
    public function destroy(PayrollPayoutArticleManageRequest $request, PayrollPayoutArticle $article): JsonResponse
    {
        return response()->json(['data' => $this->articles->delete($article, $this->companyId($request))]);
    }

    public function restore(PayrollPayoutArticleManageRequest $request, PayrollPayoutArticle $article): JsonResponse
    {
        return response()->json($this->articles->restore($article, $this->companyId($request)));
    }
}
