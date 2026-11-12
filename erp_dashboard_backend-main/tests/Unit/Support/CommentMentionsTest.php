<?php

namespace Tests\Unit\Support;

use App\Support\CommentMentions;
use PHPUnit\Framework\TestCase;

class CommentMentionsTest extends TestCase
{
    public function test_extracts_unique_user_ids_and_plain_text(): void
    {
        $id = '9d8f09b5-bc80-41cb-a36f-e2711cd9ae0f';
        $text = "@[Алексей Мошкин]({$id}) глянь, и @[Алексей Мошкин]({$id}) ещё раз. Почта a@b.ru";

        $this->assertSame([$id], CommentMentions::userIds($text));
        $this->assertSame('@Алексей Мошкин глянь, и @Алексей Мошкин ещё раз. Почта a@b.ru', CommentMentions::toPlainText($text));
        $this->assertSame([], CommentMentions::userIds('без упоминаний @someone'));
        $this->assertNull(CommentMentions::toPlainText(null));
    }
}
