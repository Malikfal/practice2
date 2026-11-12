<?php

namespace App\Console\Commands;

use App\Models\KnowledgeBaseArticle;
use App\Models\ProjectNote;
use App\Models\Task;
use App\Services\Workspace\KnowledgeBaseArticleService;
use App\Services\Workspace\ProjectNoteService;
use App\Services\Workspace\ProjectService;
use App\Support\ContentImages;
use App\Support\ExternalImageDownloader;
use Illuminate\Console\Command;
use Illuminate\Http\UploadedFile;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

class ImportExternalContentImagesCommand extends Command
{
    protected $signature = 'content:import-external-images
        {--dry-run : Только показать, что будет сделано}
        {--remove-failed : Убрать из текста картинки, которые не удалось скачать}
        {--remove-host=* : Убирать недоступные картинки только с этих хостов (вместе с --remove-failed)}
        {--api-url= : Адрес API для новых ссылок, по умолчанию APP_URL/api}';

    protected $description = 'Копирует к себе внешние картинки из статей базы знаний, заметок и описаний задач';

    private bool $dryRun = false;

    private array $stats = ['imported' => 0, 'removed' => 0, 'failed' => 0, 'records' => 0];

    public function handle(
        ExternalImageDownloader $downloader,
        KnowledgeBaseArticleService $articles,
        ProjectNoteService $notes,
        ProjectService $projects,
    ): int {
        $this->dryRun = (bool) $this->option('dry-run');
        $apiUrl = rtrim((string) ($this->option('api-url') ?: rtrim((string) config('app.url'), '/').'/api'), '/');
        $ownHosts = [(string) parse_url($apiUrl, PHP_URL_HOST)];

        KnowledgeBaseArticle::query()->where('content', 'like', '%<img%')->orderBy('id')->each(
            fn (KnowledgeBaseArticle $article) => $this->processRecord(
                "статья «{$article->title}» ({$article->id})",
                (string) $article->content,
                $ownHosts,
                $downloader,
                fn (UploadedFile $file): string => $apiUrl.'/knowledge-base/images/'.$articles->saveImage($article, $file, null)->id,
                fn (string $html) => KnowledgeBaseArticle::query()->whereKey($article->id)->toBase()->update(['content' => $html]),
            )
        );

        ProjectNote::query()->where('content', 'like', '%<img%')->orderBy('id')->each(
            fn (ProjectNote $note) => $this->processRecord(
                "заметка «{$note->title}» ({$note->id})",
                (string) $note->content,
                $ownHosts,
                $downloader,
                fn (UploadedFile $file): string => $apiUrl.'/project-note-images/'.$notes->saveImage($note, $file, null)->id,
                fn (string $html) => ProjectNote::query()->whereKey($note->id)->toBase()->update(['content' => $html]),
            )
        );

        Task::query()->with('project')->whereHas('project')->where('description', 'like', '%<img%')->orderBy('id')->each(
            fn (Task $task) => $this->processRecord(
                "задача «{$task->title}» ({$task->id})",
                (string) $task->description,
                $ownHosts,
                $downloader,
                fn (UploadedFile $file): string => $apiUrl.'/task-description-images/'
                    .$projects->saveTaskDescriptionImage($task->project, $task, $file, null)->id,
                fn (string $html) => Task::query()->whereKey($task->id)->toBase()->update(['description' => $html]),
            )
        );

        $this->info(sprintf(
            '%sЗаписей с внешними картинками: %d, скопировано: %d, убрано: %d, не удалось скачать и оставлено: %d.',
            $this->dryRun ? '[проверка] ' : '',
            $this->stats['records'],
            $this->stats['imported'],
            $this->stats['removed'],
            $this->stats['failed'],
        ));

        return self::SUCCESS;
    }

    /**
     * @param  list<string>  $ownHosts
     * @param  callable(UploadedFile): string  $store
     * @param  callable(string): mixed  $save
     */
    private function processRecord(
        string $label,
        string $html,
        array $ownHosts,
        ExternalImageDownloader $downloader,
        callable $store,
        callable $save,
    ): void {
        // Возвращаем void: each() останавливает обход, если колбэк вернул false.
        $sources = ContentImages::externalSources($html, $ownHosts);
        if ($sources === []) {
            return;
        }

        $this->stats['records']++;
        $this->line($label);
        $updated = $html;

        foreach ($sources as $src) {
            try {
                $file = $downloader->download($src);
            } catch (HttpExceptionInterface $e) {
                if ($this->shouldRemove($src)) {
                    $updated = ContentImages::removeImage($updated, $src);
                    $this->stats['removed']++;
                    $this->line("  убрана: {$src} ({$e->getMessage()})");
                } else {
                    $this->stats['failed']++;
                    $this->line("  не скачалась: {$src} ({$e->getMessage()})");
                }

                continue;
            }

            $this->stats['imported']++;
            $this->line("  скопирована: {$src}");
            if (! $this->dryRun) {
                $updated = ContentImages::replaceSource($updated, $src, $store($file));
            }
        }

        if (! $this->dryRun && $updated !== $html) {
            $save($updated);
        }
    }

    private function shouldRemove(string $src): bool
    {
        if (! $this->option('remove-failed')) {
            return false;
        }

        $hosts = array_map('strtolower', (array) $this->option('remove-host'));

        return $hosts === [] || in_array(strtolower((string) parse_url($src, PHP_URL_HOST)), $hosts, true);
    }
}
