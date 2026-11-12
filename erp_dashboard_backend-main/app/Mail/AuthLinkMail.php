<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Письмо со ссылкой-действием: подтвердить почту или задать новый пароль.
 */
class AuthLinkMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly string $subjectLine,
        public readonly string $greeting,
        public readonly string $intro,
        public readonly string $actionLabel,
        public readonly string $actionUrl,
        public readonly string $outro,
    ) {}

    public static function verifyEmail(string $name, string $companyName, string $url): self
    {
        return new self(
            subjectLine: 'Подтвердите почту для входа в ФЛОУ',
            greeting: "Здравствуйте, {$name}!",
            intro: "Компания «{$companyName}» зарегистрирована в ФЛОУ на тарифе ФРИ. Подтвердите почту, чтобы войти и начать работу.",
            actionLabel: 'Подтвердить почту',
            actionUrl: $url,
            outro: 'Ссылка действует 48 часов. Если вы не регистрировались в ФЛОУ, просто удалите это письмо.',
        );
    }

    public static function resetPassword(string $name, string $url): self
    {
        return new self(
            subjectLine: 'Восстановление пароля ФЛОУ',
            greeting: "Здравствуйте, {$name}!",
            intro: 'Мы получили запрос на смену пароля. Нажмите кнопку, чтобы задать новый пароль.',
            actionLabel: 'Задать новый пароль',
            actionUrl: $url,
            outro: 'Ссылка действует 2 часа. Если вы не запрашивали смену пароля, просто удалите это письмо: текущий пароль останется прежним.',
        );
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->subjectLine);
    }

    public function content(): Content
    {
        return new Content(view: 'mail.auth-link');
    }
}
