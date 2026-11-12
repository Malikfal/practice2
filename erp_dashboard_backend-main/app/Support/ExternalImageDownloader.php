<?php

namespace App\Support;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\UriInterface;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

/**
 * Скачивает картинку по внешней ссылке, чтобы сохранить её у себя.
 * Вставленный из других сервисов текст ссылается на их файлы, и такие картинки ломаются,
 * когда сервис закрывает доступ (так пропали картинки из OTask).
 */
class ExternalImageDownloader
{
    public const MAX_BYTES = 20 * 1024 * 1024;

    private const EXTENSIONS = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/gif' => 'gif',
        'image/webp' => 'webp',
    ];

    public function download(string $url): UploadedFile
    {
        $target = $this->resolvePublicTarget($url);
        // Закрепляем проверенный IP, чтобы DNS не подменил адрес между проверкой и запросом.
        $curl = $target['host'] === $target['ip']
            ? []
            : [CURLOPT_RESOLVE => [$target['host'].':'.$target['port'].':'.$target['ip']]];

        try {
            $response = Http::timeout(15)
                ->connectTimeout(5)
                ->withHeaders(['Accept' => 'image/*'])
                ->withOptions([
                    'curl' => $curl,
                    'allow_redirects' => [
                        'max' => 3,
                        'protocols' => ['http', 'https'],
                        'on_redirect' => function ($request, $response, UriInterface $uri): void {
                            $this->resolvePublicTarget((string) $uri);
                        },
                    ],
                    'on_headers' => function (ResponseInterface $response) use ($target): void {
                        if ((int) $response->getHeaderLine('Content-Length') > self::MAX_BYTES) {
                            $this->fail($target['host'], 'файл больше 20 МБ');
                        }
                    },
                ])
                ->get($url);
        } catch (HttpExceptionInterface $e) {
            throw $e;
        } catch (\Throwable $e) {
            if ($e->getPrevious() instanceof HttpExceptionInterface) {
                throw $e->getPrevious();
            }

            $this->fail($target['host'], 'сервер не ответил');
        }

        if (! $response->successful()) {
            $this->fail($target['host'], 'сервер ответил '.$response->status());
        }

        $body = $response->body();
        if ($body === '') {
            $this->fail($target['host'], 'пустой ответ');
        }
        if (strlen($body) > self::MAX_BYTES) {
            $this->fail($target['host'], 'файл больше 20 МБ');
        }

        $mime = (new \finfo(FILEINFO_MIME_TYPE))->buffer($body) ?: '';
        $extension = self::EXTENSIONS[$mime] ?? null;
        if ($extension === null) {
            $this->fail($target['host'], 'по ссылке не картинка');
        }

        $path = tempnam(sys_get_temp_dir(), 'external-image-');
        if ($path === false || file_put_contents($path, $body) === false) {
            throw new \RuntimeException('Не удалось сохранить скачанную картинку.');
        }
        app()->terminating(static fn () => @unlink($path));

        return new UploadedFile($path, $this->fileName($url, $extension), $mime, null, true);
    }

    /**
     * Пропускает только http(s) на стандартных портах и публичные адреса,
     * чтобы через загрузку по ссылке нельзя было обратиться к внутренним сервисам.
     *
     * @return array{host: string, port: int, ip: string}
     */
    private function resolvePublicTarget(string $url): array
    {
        $parts = parse_url($url);
        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = strtolower(trim((string) ($parts['host'] ?? ''), '[]'));

        if (! in_array($scheme, ['http', 'https'], true) || $host === '') {
            abort(422, 'Ссылка на картинку должна начинаться с http:// или https://.');
        }

        $defaultPort = $scheme === 'https' ? 443 : 80;
        $port = (int) ($parts['port'] ?? $defaultPort);
        if ($port !== $defaultPort) {
            $this->fail($host, 'нестандартный порт');
        }

        $ips = filter_var($host, FILTER_VALIDATE_IP) ? [$host] : $this->lookup($host);
        if ($ips === []) {
            $this->fail($host, 'адрес не найден');
        }

        foreach ($ips as $ip) {
            if (! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                $this->fail($host, 'внутренний адрес');
            }
        }

        return ['host' => $host, 'port' => $port, 'ip' => $ips[0]];
    }

    /**
     * @return list<string>
     */
    protected function lookup(string $host): array
    {
        return gethostbynamel($host) ?: [];
    }

    private function fileName(string $url, string $extension): string
    {
        $name = pathinfo(rawurldecode((string) parse_url($url, PHP_URL_PATH)), PATHINFO_FILENAME);
        $name = trim(preg_replace('/[^\pL\pN._-]+/u', '-', $name) ?? '', '-.');

        return ($name !== '' ? mb_substr($name, 0, 80) : 'image').'.'.$extension;
    }

    private function fail(string $host, string $reason): never
    {
        abort(422, "Не удалось скопировать картинку с {$host}: {$reason}.");
    }
}
