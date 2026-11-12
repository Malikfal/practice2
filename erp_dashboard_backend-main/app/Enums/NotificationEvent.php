<?php

namespace App\Enums;

/**
 * Каталог событий задачи, о которых приходят уведомления.
 * Из него строятся настройки компании («событие × связь») и личные настройки пользователя:
 * новое событие — это новый case здесь и один вызов TaskNotificationService в коде.
 */
enum NotificationEvent: string
{
    case TASK_ASSIGNED = 'task.assigned';
    case TASK_CREATED = 'task.created';
    case TASK_CLIENT_CREATED = 'task.client_created';
    case TASK_STATUS_CHANGED = 'task.status_changed';
    case TASK_DESCRIPTION_CHANGED = 'task.description_changed';
    case TASK_DEADLINE_CHANGED = 'task.deadline_changed';
    case TASK_PRIORITY_CHANGED = 'task.priority_changed';
    case TASK_ATTACHMENT_ADDED = 'task.attachment_added';
    case TASK_COMMENT_ADDED = 'task.comment_added';
    case TASK_MENTIONED = 'task.mentioned';
    case TASK_CLIENT_MESSAGE_ADDED = 'task.client_message_added';
    case TASK_CLIENT_REPLY_ADDED = 'task.client_reply_added';
    case TASK_CLIENT_APPROVED = 'task.client_approved';
    case TIME_ADDED = 'time.added';
    case TIME_DELETED = 'time.deleted';
    case TIME_MOVED = 'time.moved';

    /**
     * Тип уведомления, в которое сводятся изменения полей одного сохранения задачи.
     */
    public const TASK_UPDATED_TYPE = 'task.updated';

    public function label(): string
    {
        return match ($this) {
            self::TASK_ASSIGNED => 'Назначение исполнителем',
            self::TASK_CREATED => 'Новая задача',
            self::TASK_CLIENT_CREATED => 'Задача от клиента',
            self::TASK_STATUS_CHANGED => 'Смена статуса',
            self::TASK_DESCRIPTION_CHANGED => 'Изменение названия или описания',
            self::TASK_DEADLINE_CHANGED => 'Изменение дедлайна',
            self::TASK_PRIORITY_CHANGED => 'Изменение приоритета',
            self::TASK_ATTACHMENT_ADDED => 'Новое вложение',
            self::TASK_COMMENT_ADDED => 'Комментарий',
            self::TASK_MENTIONED => 'Упоминание в комментарии',
            self::TASK_CLIENT_MESSAGE_ADDED => 'Сообщение клиента',
            self::TASK_CLIENT_REPLY_ADDED => 'Ответ клиенту',
            self::TASK_CLIENT_APPROVED => 'Согласование клиентом',
            self::TIME_ADDED => 'Добавление времени вручную',
            self::TIME_DELETED => 'Удаление времени',
            self::TIME_MOVED => 'Перенос времени',
        };
    }

    /**
     * Название события в личных настройках клиента.
     */
    public function clientLabel(): string
    {
        return match ($this) {
            self::TASK_CREATED => 'Новые задачи в проекте',
            self::TASK_STATUS_CHANGED => 'Смена статуса задачи',
            self::TASK_DESCRIPTION_CHANGED => 'Изменение описания задачи',
            self::TASK_DEADLINE_CHANGED => 'Изменение дедлайна',
            self::TASK_PRIORITY_CHANGED => 'Изменение приоритета',
            self::TASK_CLIENT_REPLY_ADDED => 'Ответы по задачам',
            default => $this->label(),
        };
    }

    /**
     * Подсказка в личных настройках клиента.
     */
    public function clientHint(): ?string
    {
        return match ($this) {
            self::TASK_CREATED => 'В проекте появилась новая задача.',
            self::TASK_STATUS_CHANGED => 'Задача перешла на другой этап.',
            self::TASK_DESCRIPTION_CHANGED => 'Изменились название или описание задачи.',
            self::TASK_DEADLINE_CHANGED => 'Дедлайн поставили, перенесли или сняли.',
            self::TASK_PRIORITY_CHANGED => 'Изменился приоритет задачи.',
            self::TASK_CLIENT_REPLY_ADDED => 'Новое сообщение от исполнителя в переписке по задаче.',
            default => null,
        };
    }

    public function hint(): string
    {
        return match ($this) {
            self::TASK_ASSIGNED => 'Сотрудника добавили в исполнители задачи.',
            self::TASK_CREATED => 'Задача опубликована: у неё появились название и исполнитель.',
            self::TASK_CLIENT_CREATED => 'Клиент создал задачу в кабинете. Пока исполнителя нет, задача в черновиках.',
            self::TASK_STATUS_CHANGED => 'Задачу перевели в другую колонку.',
            self::TASK_DESCRIPTION_CHANGED => 'Сохранены новые название или описание.',
            self::TASK_DEADLINE_CHANGED => 'Дедлайн поставили, перенесли или сняли.',
            self::TASK_PRIORITY_CHANGED => 'Приоритет изменил сотрудник или клиент.',
            self::TASK_ATTACHMENT_ADDED => 'К задаче прикрепили файл.',
            self::TASK_COMMENT_ADDED => 'Внутренний комментарий сотрудника. Клиенту не отправляется.',
            self::TASK_MENTIONED => 'Сотрудника упомянули через @ в комментарии к задаче.',
            self::TASK_CLIENT_MESSAGE_ADDED => 'Клиент написал в переписке по задаче.',
            self::TASK_CLIENT_REPLY_ADDED => 'Сотрудник ответил клиенту в переписке по задаче.',
            self::TASK_CLIENT_APPROVED => 'Клиент согласовал задачу.',
            self::TIME_ADDED => 'Сотрудник без роли «Админ» добавил время вручную, себе или другому.',
            self::TIME_DELETED => 'Сотрудник без роли «Админ» удалил интервал рабочего времени.',
            self::TIME_MOVED => 'Сотрудник без роли «Админ» перенёс интервал времени в другую задачу.',
        };
    }

    /**
     * Раздел, в котором событие показывается в настройках.
     */
    public function group(): string
    {
        return match ($this) {
            self::TASK_ASSIGNED, self::TASK_CREATED, self::TASK_CLIENT_CREATED => 'tasks',
            self::TASK_STATUS_CHANGED,
            self::TASK_DESCRIPTION_CHANGED,
            self::TASK_DEADLINE_CHANGED,
            self::TASK_PRIORITY_CHANGED,
            self::TASK_ATTACHMENT_ADDED => 'changes',
            self::TASK_COMMENT_ADDED, self::TASK_MENTIONED => 'discussion',
            self::TASK_CLIENT_MESSAGE_ADDED, self::TASK_CLIENT_REPLY_ADDED, self::TASK_CLIENT_APPROVED => 'client',
            self::TIME_ADDED, self::TIME_DELETED, self::TIME_MOVED => 'time',
        };
    }

    public static function groupLabel(string $group, bool $forClient = false): string
    {
        return match ($group) {
            'tasks' => 'Задачи',
            'changes' => $forClient ? 'Изменения задач' : 'Изменения задачи',
            'discussion' => 'Обсуждение',
            'client' => $forClient ? 'Переписка' : 'Работа с клиентом',
            'time' => 'Учёт времени',
            default => $group,
        };
    }

    /**
     * Область настроек группы: события задач настраиваются по связям с задачей, учёт времени — по ролям.
     */
    public static function groupScope(string $group): string
    {
        return $group === 'time' ? 'time' : 'task';
    }

    /**
     * Связи, для которых событие имеет смысл. Остальные ячейки матрицы заблокированы.
     *
     * @return array<int, NotificationRelation>
     */
    public function relations(): array
    {
        $staff = [
            NotificationRelation::ASSIGNEE,
            NotificationRelation::CREATOR,
            NotificationRelation::PROJECT_MANAGER,
            NotificationRelation::PROJECT_MEMBER,
            NotificationRelation::WATCHER,
        ];

        return match ($this) {
            // Уведомление получает только тот, кого назначили, остальные узнают из «Новой задачи» или истории.
            self::TASK_ASSIGNED => [NotificationRelation::ASSIGNEE],
            self::TASK_MENTIONED => [NotificationRelation::MENTIONED],
            // Исполнители новой задачи получают «Назначение», наблюдателей у неё ещё нет.
            self::TASK_CREATED => [
                NotificationRelation::PROJECT_MANAGER,
                NotificationRelation::PROJECT_MEMBER,
                NotificationRelation::CLIENT,
            ],
            self::TASK_CLIENT_CREATED => [
                NotificationRelation::PROJECT_MANAGER,
                NotificationRelation::PROJECT_MEMBER,
            ],
            self::TASK_STATUS_CHANGED,
            self::TASK_DESCRIPTION_CHANGED,
            self::TASK_DEADLINE_CHANGED,
            self::TASK_PRIORITY_CHANGED,
            self::TASK_CLIENT_REPLY_ADDED => [...$staff, NotificationRelation::CLIENT],
            // Вложения задачи клиент не видит, внутренние комментарии ему не отправляются никогда.
            self::TASK_ATTACHMENT_ADDED,
            self::TASK_COMMENT_ADDED,
            self::TASK_CLIENT_MESSAGE_ADDED,
            self::TASK_CLIENT_APPROVED => $staff,
            self::TIME_ADDED, self::TIME_DELETED, self::TIME_MOVED => [NotificationRelation::ADMIN],
        };
    }

    /**
     * Значения по умолчанию, пока компания не меняла настройки.
     *
     * @return array<int, NotificationRelation>
     */
    public function defaultRelations(): array
    {
        return match ($this) {
            self::TASK_ASSIGNED => [NotificationRelation::ASSIGNEE],
            self::TASK_MENTIONED => [NotificationRelation::MENTIONED],
            self::TASK_CREATED => [],
            self::TASK_CLIENT_CREATED => [NotificationRelation::PROJECT_MANAGER],
            self::TASK_STATUS_CHANGED => [
                NotificationRelation::ASSIGNEE,
                NotificationRelation::CREATOR,
                NotificationRelation::PROJECT_MANAGER,
                NotificationRelation::WATCHER,
            ],
            self::TASK_DESCRIPTION_CHANGED,
            self::TASK_ATTACHMENT_ADDED,
            self::TASK_COMMENT_ADDED => [
                NotificationRelation::ASSIGNEE,
                NotificationRelation::CREATOR,
                NotificationRelation::WATCHER,
            ],
            self::TASK_DEADLINE_CHANGED => [
                NotificationRelation::ASSIGNEE,
                NotificationRelation::PROJECT_MANAGER,
                NotificationRelation::WATCHER,
            ],
            self::TASK_PRIORITY_CHANGED => [
                NotificationRelation::ASSIGNEE,
                NotificationRelation::WATCHER,
            ],
            self::TASK_CLIENT_MESSAGE_ADDED, self::TASK_CLIENT_APPROVED => [
                NotificationRelation::ASSIGNEE,
                NotificationRelation::CREATOR,
                NotificationRelation::PROJECT_MANAGER,
                NotificationRelation::WATCHER,
            ],
            self::TASK_CLIENT_REPLY_ADDED => [
                NotificationRelation::ASSIGNEE,
                NotificationRelation::WATCHER,
                NotificationRelation::CLIENT,
            ],
            self::TIME_ADDED, self::TIME_DELETED, self::TIME_MOVED => [NotificationRelation::ADMIN],
        };
    }

    public function allowsRelation(NotificationRelation $relation): bool
    {
        return in_array($relation, $this->relations(), true);
    }

    public function isEnabledByDefault(NotificationRelation $relation): bool
    {
        return in_array($relation, $this->defaultRelations(), true);
    }

    /**
     * Есть ли у события получатели-клиенты.
     */
    public function isForClients(): bool
    {
        return $this->allowsRelation(NotificationRelation::CLIENT);
    }

    /**
     * Право, без которого сотрудник не видит данные события.
     */
    public function staffPermission(): ?UserPermission
    {
        return match ($this) {
            self::TASK_CLIENT_MESSAGE_ADDED, self::TASK_CLIENT_REPLY_ADDED => UserPermission::PROJECTS_TABS_TASKS_CLIENT_COMMENTS_VIEW,
            self::TIME_ADDED, self::TIME_DELETED, self::TIME_MOVED => UserPermission::TIME_VIEW_ALL,
            default => null,
        };
    }

    /**
     * Права клиента, хотя бы одно из которых нужно, чтобы видеть данные события.
     *
     * @return array<int, UserPermission>
     */
    public function clientPermissions(): array
    {
        return match ($this) {
            self::TASK_DESCRIPTION_CHANGED => [UserPermission::CLIENT_PORTAL_TASK_DESCRIPTION_VIEW],
            self::TASK_DEADLINE_CHANGED => [
                UserPermission::CLIENT_PORTAL_TASK_DEADLINE_VIEW,
                UserPermission::CLIENT_PORTAL_TASK_DEADLINE_SET,
            ],
            self::TASK_PRIORITY_CHANGED => [
                UserPermission::CLIENT_PORTAL_TASK_PRIORITY_VIEW,
                UserPermission::CLIENT_PORTAL_TASK_PRIORITY_UPDATE,
            ],
            self::TASK_CLIENT_REPLY_ADDED => [UserPermission::PROJECTS_TABS_TASKS_CLIENT_COMMENTS_VIEW],
            default => [],
        };
    }

    /**
     * По черновикам уведомлений нет, кроме действий клиента и переписки с ним:
     * черновик с названием клиент видит как обычную задачу. Учёт времени от состояния задачи не зависит.
     */
    public function notifiesForDrafts(): bool
    {
        return match ($this) {
            self::TASK_CLIENT_CREATED,
            self::TASK_CLIENT_MESSAGE_ADDED,
            self::TASK_CLIENT_REPLY_ADDED,
            self::TASK_CLIENT_APPROVED,
            self::TIME_ADDED,
            self::TIME_DELETED,
            self::TIME_MOVED => true,
            default => false,
        };
    }

    /**
     * События учёта времени: о действиях администраторов не уведомляют,
     * а получателю нужно право видеть всё время, а не доступ к задаче.
     */
    public function isTimeEvent(): bool
    {
        return in_array($this, [self::TIME_ADDED, self::TIME_DELETED, self::TIME_MOVED], true);
    }

    /**
     * Тип записи в ленте. Изменения полей одного сохранения сводятся в одно уведомление.
     */
    public function type(): string
    {
        return $this->isFieldChange() ? self::TASK_UPDATED_TYPE : $this->value;
    }

    public function isFieldChange(): bool
    {
        return in_array($this, [
            self::TASK_DESCRIPTION_CHANGED,
            self::TASK_DEADLINE_CHANGED,
            self::TASK_PRIORITY_CHANGED,
        ], true);
    }

    /**
     * Событие, к которому относится изменение поля задачи; null — поле не уведомляет (например, оценка).
     */
    public static function forField(string $field): ?self
    {
        return match ($field) {
            'title', 'description' => self::TASK_DESCRIPTION_CHANGED,
            'deadline' => self::TASK_DEADLINE_CHANGED,
            'priority' => self::TASK_PRIORITY_CHANGED,
            default => null,
        };
    }

    /**
     * @return array<int, string>
     */
    public static function values(): array
    {
        return array_map(static fn (self $event): string => $event->value, self::cases());
    }
}
