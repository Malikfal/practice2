<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\DeleteKnowledgeBaseRequest;
use App\Http\Requests\Workspace\KnowledgeBaseViewRequest;
use App\Http\Requests\Workspace\StoreKnowledgeBaseArticleRequest;
use App\Http\Requests\Workspace\StoreKnowledgeBaseFolderRequest;
use App\Http\Requests\Workspace\StoreKnowledgeBaseImageRequest;
use App\Http\Requests\Workspace\SyncKnowledgeBaseArticleAccessRequest;
use App\Http\Requests\Workspace\SyncKnowledgeBaseFolderAccessRequest;
use App\Http\Requests\Workspace\UpdateKnowledgeBaseArticleRequest;
use App\Http\Requests\Workspace\UpdateKnowledgeBaseFolderRequest;
use App\Http\Responses\Workspace\KnowledgeBaseArticleIndexResponse;
use App\Http\Responses\Workspace\KnowledgeBaseArticleResponse;
use App\Http\Responses\Workspace\KnowledgeBaseFolderIndexResponse;
use App\Http\Responses\Workspace\KnowledgeBaseFolderResponse;
use App\Http\Responses\Workspace\KnowledgeBaseImageUploadResponse;
use App\Models\KnowledgeBaseArticle;
use App\Models\KnowledgeBaseDocument;
use App\Models\KnowledgeBaseFolder;
use App\Services\Workspace\KnowledgeBaseArticleService;
use App\Services\Workspace\KnowledgeBaseFolderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class KnowledgeBaseController extends Controller
{
    public function __construct(
        private readonly KnowledgeBaseArticleService $articles,
        private readonly KnowledgeBaseFolderService $folders,
    ) {}

    public function index(KnowledgeBaseViewRequest $request): JsonResponse
    {
        return new KnowledgeBaseArticleIndexResponse(
            $this->articles->list($request->user())
        );
    }

    public function folders(KnowledgeBaseViewRequest $request): JsonResponse
    {
        return new KnowledgeBaseFolderIndexResponse(
            $this->folders->folders($request->user())
        );
    }

    public function storeFolder(StoreKnowledgeBaseFolderRequest $request): JsonResponse
    {
        return new KnowledgeBaseFolderResponse(
            $this->folders->createFolder($request->user(), $request->validated()),
            201
        );
    }

    public function updateFolder(UpdateKnowledgeBaseFolderRequest $request, KnowledgeBaseFolder $folder): JsonResponse
    {
        return new KnowledgeBaseFolderResponse(
            $this->folders->updateFolder($request->user(), $folder, $request->validated())
        );
    }

    public function syncFolderAccesses(SyncKnowledgeBaseFolderAccessRequest $request, KnowledgeBaseFolder $folder): JsonResponse
    {
        return new KnowledgeBaseFolderResponse(
            $this->folders->syncFolderAccesses($request->user(), $folder, $request->validated())
        );
    }

    public function destroyFolder(DeleteKnowledgeBaseRequest $request, KnowledgeBaseFolder $folder): Response
    {
        $this->folders->deleteFolder($request->user(), $folder);

        return response()->noContent();
    }

    public function store(StoreKnowledgeBaseArticleRequest $request): JsonResponse
    {
        return new KnowledgeBaseArticleResponse(
            $this->articles->createDraft($request->user(), $request->validated()),
            201
        );
    }

    public function update(UpdateKnowledgeBaseArticleRequest $request, KnowledgeBaseArticle $article): JsonResponse
    {
        return new KnowledgeBaseArticleResponse(
            $this->articles->update($request->user(), $article, $request->validated())
        );
    }

    public function syncArticleAccesses(SyncKnowledgeBaseArticleAccessRequest $request, KnowledgeBaseArticle $article): JsonResponse
    {
        return new KnowledgeBaseArticleResponse(
            $this->articles->syncArticleAccesses($request->user(), $article, $request->validated())
        );
    }

    public function publish(StoreKnowledgeBaseArticleRequest $request, KnowledgeBaseArticle $article): JsonResponse
    {
        return new KnowledgeBaseArticleResponse(
            $this->articles->publish($request->user(), $article)
        );
    }

    public function destroy(DeleteKnowledgeBaseRequest $request, KnowledgeBaseArticle $article): Response
    {
        $this->articles->delete($request->user(), $article);

        return response()->noContent();
    }

    public function uploadImage(StoreKnowledgeBaseImageRequest $request, KnowledgeBaseArticle $article): JsonResponse
    {
        return new KnowledgeBaseImageUploadResponse(
            $this->articles->storeImage(
                $request->user(),
                $article,
                $request->imageFile()
            )
        );
    }

    public function image(KnowledgeBaseViewRequest $request, KnowledgeBaseDocument $image): StreamedResponse
    {
        return $this->articles->openDocument($request->user(), $image);
    }
}
