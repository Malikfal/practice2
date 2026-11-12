<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Enums\DataImportType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\StoreDataImportRequest;
use App\Http\Resources\Workspace\DataImportResource;
use App\Http\Resources\Workspace\DataImportRowResource;
use App\Models\DataImport;
use App\Services\Imports\DataImportService;
use App\Support\DataImportAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DataImportController extends Controller
{
    public function __construct(private readonly DataImportService $imports) {}

    public function index(Request $request): JsonResponse
    {
        $allowedTypes = DataImportAccess::allowedTypes($request->user());
        $paginator = DataImport::query()
            ->where('company_id', $request->user()->company_id)
            ->whereIn('type', $allowedTypes)
            ->latest()
            ->paginate(min(max((int) $request->integer('per_page', 20), 1), 100));

        return response()->json([
            'data' => DataImportResource::collection($paginator->getCollection())->resolve($request),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                // Типы, которые пользователь может загрузить: по ним фронтенд строит выбор типа.
                'allowed_types' => $allowedTypes,
            ],
        ]);
    }

    public function store(StoreDataImportRequest $request): JsonResponse
    {
        $import = $this->imports->create(
            $request->user(),
            DataImportType::from((string) $request->validated('type')),
            $request->file('file'),
        );

        return response()->json(DataImportResource::make($import)->resolve($request), 202);
    }

    public function show(Request $request, string $import): JsonResponse
    {
        $model = $this->findForCompany($request, $import)->load(['logs' => fn ($query) => $query->latest()->limit(100)]);

        return response()->json(DataImportResource::make($model)->resolve($request));
    }

    public function rows(Request $request, string $import): JsonResponse
    {
        $model = $this->findForCompany($request, $import);
        $paginator = $model->rows()->orderBy('row_number')->paginate(min(max((int) $request->integer('per_page', 50), 1), 200));

        return response()->json([
            'data' => DataImportRowResource::collection($paginator->getCollection())->resolve($request),
            'meta' => ['current_page' => $paginator->currentPage(), 'last_page' => $paginator->lastPage(), 'total' => $paginator->total()],
        ]);
    }

    public function download(Request $request, string $import): mixed
    {
        return $this->imports->download($this->findForCompany($request, $import));
    }

    public function retry(Request $request, string $import): JsonResponse
    {
        return response()->json(DataImportResource::make($this->imports->retry($this->findForCompany($request, $import)))->resolve($request), 202);
    }

    public function cancel(Request $request, string $import): JsonResponse
    {
        return response()->json(DataImportResource::make($this->imports->cancel($this->findForCompany($request, $import)))->resolve($request));
    }

    private function findForCompany(Request $request, string $id): DataImport
    {
        $import = DataImport::query()->where('company_id', $request->user()->company_id)->findOrFail($id);
        abort_unless(DataImportAccess::can($request->user(), $import->type), 403);

        return $import;
    }
}
