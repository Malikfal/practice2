import { HintToolTip } from '../../../../ui/HintTooltip';
import { cx } from '../../../../ui/table';

/** Имя сотрудника в таблицах ФОТ: архивные выделены цветом и подсказкой, под именем — должность. */
export function PayrollEmployeeName({
  name,
  isArchived,
  position,
  weight = 'semibold',
  className,
}: {
  name: string;
  isArchived?: boolean;
  position?: string | null;
  weight?: 'semibold' | 'medium';
  className?: string;
}) {
  const label = (
    <span
      className={cx(
        'inline-flex items-center gap-1.5',
        weight === 'semibold' ? 'font-semibold' : 'font-medium',
        isArchived ? 'text-amber-700' : 'text-[#10275a]',
        className,
      )}
    >
      {name}
      {isArchived ? <HintToolTip content='Сотрудник архивирован' /> : null}
    </span>
  );

  if (!position) return label;

  return (
    <span className='block min-w-0'>
      {label}
      <span className='block text-xs text-[#7e8fb4]'>{position}</span>
    </span>
  );
}
