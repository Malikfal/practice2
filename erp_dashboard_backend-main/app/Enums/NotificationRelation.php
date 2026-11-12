<?php

namespace App\Enums;

/**
 * Кем пользователь приходится задаче (или компании — для учёта времени).
 * По связи компания решает, какие события ему присылать.
 */
enum NotificationRelation: string
{
    case ASSIGNEE = 'assignee';
    case CREATOR = 'creator';
    case PROJECT_MANAGER = 'project_manager';
    case PROJECT_MEMBER = 'project_member';
    case WATCHER = 'watcher';
    case CLIENT = 'client';
    // Сотрудники с ролью «Админ»: получают события учёта времени, не связанные с участием в задаче.
    case ADMIN = 'admin';
    // Упомянут через @ в комментарии: связь есть только у тех, кого упомянули в этом комментарии.
    case MENTIONED = 'mentioned';

    public function label(): string
    {
        return match ($this) {
            self::ASSIGNEE => 'Исполнители',
            self::CREATOR => 'Автор задачи',
            self::PROJECT_MANAGER => 'PM проекта',
            self::PROJECT_MEMBER => 'Участники проекта',
            self::WATCHER => 'Наблюдатели',
            self::CLIENT => 'Клиент',
            self::ADMIN => 'Администраторы',
            self::MENTIONED => 'Упомянутые',
        };
    }

    /**
     * Подпись в уведомлении: «Почему я это получил».
     */
    public function reason(): string
    {
        return match ($this) {
            self::ASSIGNEE => 'Вы исполнитель',
            self::CREATOR => 'Вы автор задачи',
            self::PROJECT_MANAGER => 'Вы PM проекта',
            self::PROJECT_MEMBER => 'Вы участник проекта',
            self::WATCHER => 'Вы следите за задачей',
            self::CLIENT => 'Задача вашего проекта',
            self::ADMIN => 'Вы администратор',
            self::MENTIONED => 'Вас упомянули',
        };
    }

    /**
     * Порядок, в котором причины показываются пользователю: самая конкретная первой.
     */
    public function priority(): int
    {
        return match ($this) {
            self::ASSIGNEE => 0,
            self::CREATOR => 1,
            self::WATCHER => 2,
            self::PROJECT_MANAGER => 3,
            self::PROJECT_MEMBER => 4,
            self::CLIENT => 5,
            self::ADMIN => 6,
            self::MENTIONED => -1,
        };
    }

    public function isClient(): bool
    {
        return $this === self::CLIENT;
    }
}
