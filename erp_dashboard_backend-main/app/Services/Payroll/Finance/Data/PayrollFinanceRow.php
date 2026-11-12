<?php

namespace App\Services\Payroll\Finance\Data;

/** Готовая к записи payroll-сумма, сгруппированная по финансовой статье и проекту. */
final readonly class PayrollFinanceRow
{
    public function __construct(
        public ?string $financeArticleId,
        public ?string $projectId,
        public int $amount,
    ) {}

    /** Возвращает устойчивый ключ финансовой статьи и проекта. */
    public function key(): string
    {
        return ($this->financeArticleId ?? '__none_article__')
            .':'.($this->projectId ?? '__none_project__');
    }

    /** Возвращает ту же финансовую строку с другой суммой. */
    public function withAmount(int $amount): self
    {
        return new self(
            financeArticleId: $this->financeArticleId,
            projectId: $this->projectId,
            amount: $amount,
        );
    }
}
