<?php

namespace App\Http\Requests\Workspace\Concerns;

use App\Support\ExternalImageDownloader;
use Illuminate\Http\UploadedFile;

/**
 * Картинку для редактора присылают файлом или ссылкой: ссылкой — когда в текст
 * вставили картинку с другого сайта, и её нужно скопировать к себе.
 */
trait AcceptsImageFileOrUrl
{
    protected function imageRules(): array
    {
        return [
            'image' => ['required_without:url', 'image', 'max:20480', 'mimes:jpg,jpeg,png,gif,webp'],
            'url' => ['required_without:image', 'string', 'max:2048', 'url:http,https'],
        ];
    }

    public function imageFile(): UploadedFile
    {
        return $this->file('image')
            ?? app(ExternalImageDownloader::class)->download((string) $this->validated('url'));
    }
}
