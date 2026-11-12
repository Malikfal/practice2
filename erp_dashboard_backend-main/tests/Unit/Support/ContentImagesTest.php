<?php

namespace Tests\Unit\Support;

use App\Support\ContentImages;
use PHPUnit\Framework\TestCase;

class ContentImagesTest extends TestCase
{
    private const OTASK = 'https://api.otask.ru/api/v1/files/b0f7841e.png';

    private const GOOGLE = 'https://lh7-rt.googleusercontent.com/docsz/AD_4n?key=a&amp;b=1';

    public function test_finds_external_sources_except_own_and_relative(): void
    {
        $html = '<p>текст</p><img src="'.self::OTASK.'" alt="x.png">'
            .'<p><img src=\''.self::GOOGLE.'\'></p>'
            .'<img src="https://api.flow-erp.ru/api/project-note-images/1">'
            .'<img src="/knowledge-base/images/2"><img src="data:image/png;base64,AA==">'
            .'<img src="'.self::OTASK.'">';

        $this->assertSame(
            [self::OTASK, 'https://lh7-rt.googleusercontent.com/docsz/AD_4n?key=a&b=1'],
            ContentImages::externalSources($html, ['api.flow-erp.ru']),
        );
    }

    public function test_replaces_source_and_keeps_other_attributes(): void
    {
        $html = '<p><img src="'.self::GOOGLE.'" alt="схема" width="624"></p>';

        $this->assertSame(
            '<p><img src="https://api.flow-erp.ru/api/knowledge-base/images/3" alt="схема" width="624"></p>',
            ContentImages::replaceSource(
                $html,
                'https://lh7-rt.googleusercontent.com/docsz/AD_4n?key=a&b=1',
                'https://api.flow-erp.ru/api/knowledge-base/images/3',
            ),
        );
    }

    public function test_removes_image_and_paragraph_left_empty(): void
    {
        $html = '<p>Примеры таблиц:</p><p><img src="'.self::OTASK.'"></p><p></p>'
            .'<p>до <img src="'.self::OTASK.'" alt="a"> после</p><img src="'.self::OTASK.'">'
            .'<img src="https://example.com/keep.png">';

        $this->assertSame(
            '<p>Примеры таблиц:</p><p></p><p>до  после</p><img src="https://example.com/keep.png">',
            ContentImages::removeImage($html, self::OTASK),
        );
    }
}
