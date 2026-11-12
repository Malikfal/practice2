<?php

namespace Tests\Unit\Support;

use App\Support\ExternalImageDownloader;
use Illuminate\Support\Facades\Http;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class ExternalImageDownloaderTest extends TestCase
{
    // Минимальный валидный PNG 1×1.
    private const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    public function test_downloads_image_with_name_from_url(): void
    {
        Http::fake(['images.example.com/*' => Http::response(base64_decode(self::PNG), 200, ['Content-Type' => 'image/png'])]);

        $file = $this->downloader(['93.184.216.34'])->download('https://images.example.com/docs/%D1%81%D1%85%D0%B5%D0%BC%D0%B0?key=1');

        $this->assertSame('схема.png', $file->getClientOriginalName());
        $this->assertSame('image/png', $file->getClientMimeType());
        $this->assertSame(base64_decode(self::PNG), file_get_contents($file->getPathname()));
    }

    public function test_rejects_internal_addresses_and_ports(): void
    {
        Http::fake();

        foreach ([
            'http://127.0.0.1/a.png',
            'http://10.0.0.5/a.png',
            'http://[::1]/a.png',
            'https://images.example.com:8443/a.png',
            'ftp://images.example.com/a.png',
        ] as $url) {
            $this->assertFails(fn () => $this->downloader(['93.184.216.34'])->download($url), $url);
        }

        $this->assertFails(
            fn () => $this->downloader(['192.168.1.10'])->download('https://intranet.example.com/a.png'),
            'внутренний адрес',
        );
        Http::assertNothingSent();
    }

    public function test_fails_on_error_response_or_not_an_image(): void
    {
        Http::fake([
            'api.otask.ru/*' => Http::response('Not found', 404),
            'example.com/*' => Http::response('<html></html>', 200, ['Content-Type' => 'image/png']),
        ]);

        $this->assertFails(
            fn () => $this->downloader(['91.142.91.68'])->download('https://api.otask.ru/api/v1/files/b0f7841e.png'),
            'Не удалось скопировать картинку с api.otask.ru: сервер ответил 404.',
        );
        $this->assertFails(
            fn () => $this->downloader(['93.184.216.34'])->download('https://example.com/a.png'),
            'по ссылке не картинка',
        );
    }

    /**
     * @param  list<string>  $ips
     */
    private function downloader(array $ips): ExternalImageDownloader
    {
        return new class($ips) extends ExternalImageDownloader
        {
            public function __construct(private readonly array $ips) {}

            protected function lookup(string $host): array
            {
                return $this->ips;
            }
        };
    }

    private function assertFails(callable $callback, string $expectedMessage): void
    {
        try {
            $callback();
        } catch (HttpException $e) {
            $this->assertSame(422, $e->getStatusCode());
            if (! str_contains($expectedMessage, '://')) {
                $this->assertStringContainsString($expectedMessage, $e->getMessage());
            }

            return;
        }

        $this->fail("Ожидалась ошибка: {$expectedMessage}");
    }
}
