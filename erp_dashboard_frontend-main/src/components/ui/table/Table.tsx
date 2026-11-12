import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  type ComponentProps,
  type ReactNode,
} from 'react';

import Preloader from '../Preloader';
import SortIcon from '../SortIcon';
import type { SortDirection } from './useTableSort';

/**
 * Общие детали таблиц панели.
 *
 * Правила оформления:
 * - заголовок выравнивается так же, как данные колонки: текст и даты — влево,
 *   числа и деньги — вправо (`numeric`), иконки, флажки и действия — по центру;
 * - `density='list'` — основные списки и отчёты, `density='compact'` — карточки,
 *   модалки и вложенные таблицы;
 * - таблица на `border-separate`: при `border-collapse` границы закреплённых
 *   ячеек пропадают при прокрутке (баги Firefox и WebKit);
 * - закрепление (`pin`) включается явно и только в таблицах, которые реально
 *   прокручиваются по горизонтали. Закрепляйте слева колонку, по которой узнают
 *   строку (ФИО, название), — не «Действия»: закреплённая колонка постоянно
 *   отнимает ширину и перекрывает данные. Тень у закреплённой колонки
 *   `TableContainer` показывает сам, когда под ней есть скрытая часть таблицы.
 */

export type TableDensity = 'list' | 'compact';
export type CellAlign = 'left' | 'center' | 'right';
export type CellPin = 'left' | 'right';

type TableContextValue = { density: TableDensity; striped: boolean };

const TableContext = createContext<TableContextValue>({ density: 'list', striped: true });

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

const cellPaddingClasses: Record<TableDensity, string> = {
  list: 'px-2.5 py-2',
  compact: 'px-2 py-1.5',
};

const alignClasses: Record<CellAlign, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

const pinClasses: Record<CellPin, string> = {
  left: 'sticky left-0 z-10',
  right: 'sticky right-0 z-10',
};

// Тень — полоса за краем ячейки, а не `box-shadow`: так полосы соседних строк
// сливаются в одну линию. `-bottom-px` закрывает нижнюю границу ячейки.
const pinShadowClasses: Record<CellPin, string> = {
  left: 'after:pointer-events-none after:absolute after:top-0 after:-bottom-px after:left-[calc(100%+1px)] after:w-3 after:bg-linear-to-r after:from-[rgba(16,39,90,0.1)] after:to-transparent after:opacity-0 after:transition-opacity group-data-[scroll-start]/table-scroll:after:opacity-100',
  right:
    'after:pointer-events-none after:absolute after:top-0 after:-bottom-px after:right-full after:w-3 after:bg-linear-to-l after:from-[rgba(16,39,90,0.1)] after:to-transparent after:opacity-0 after:transition-opacity group-data-[scroll-end]/table-scroll:after:opacity-100',
};

// Ячейка на несколько колонок (заголовок группы) тянется дальше закреплённой
// колонки, её тень встала бы не на место.
function pinCellClasses(pin: CellPin, colSpan?: number) {
  return cx(pinClasses[pin], (colSpan ?? 1) <= 1 && pinShadowClasses[pin]);
}

const cellBorderClasses = 'border-b border-r border-[#e3e9f3] last:border-r-0';

type TableContainerProps = ComponentProps<'div'> & {
  /** Подпись области прокрутки для скринридеров; делает область фокусируемой. */
  label?: string;
};

/**
 * Рамка и прокрутка таблицы. Высоту и `flex-1` задаёт место использования.
 * Отмечает, скрыта ли часть таблицы слева (`data-scroll-start`) и справа
 * (`data-scroll-end`), — по этим меткам закреплённые колонки показывают тень.
 */
export function TableContainer({
  label,
  className,
  children,
  ref,
  ...props
}: TableContainerProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const update = () => {
      const maxScrollLeft = element.scrollWidth - element.clientWidth;
      element.toggleAttribute('data-scroll-start', element.scrollLeft > 1);
      element.toggleAttribute('data-scroll-end', element.scrollLeft < maxScrollLeft - 1);
    };

    // Ширина меняется и у области, и у самой таблицы (загрузка строк, смена колонок).
    const resizeObserver = new ResizeObserver(update);
    const observeChildren = () => {
      resizeObserver.disconnect();
      resizeObserver.observe(element);
      for (const child of element.children) resizeObserver.observe(child);
    };
    const mutationObserver = new MutationObserver(observeChildren);

    observeChildren();
    mutationObserver.observe(element, { childList: true });
    element.addEventListener('scroll', update, { passive: true });

    return () => {
      element.removeEventListener('scroll', update);
      mutationObserver.disconnect();
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div
      ref={(node) => {
        scrollRef.current = node;
        if (typeof ref === 'function') return ref(node);
        if (ref) ref.current = node;
      }}
      role={label ? 'region' : undefined}
      aria-label={label}
      tabIndex={label ? 0 : undefined}
      className={cx(
        'group/table-scroll overflow-auto rounded-xl border border-[#e3e9f3] bg-white focus-visible:outline-2 focus-visible:outline-[#2d6ff7]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

type TableProps = ComponentProps<'table'> & {
  density?: TableDensity;
  /** Чередование фона строк; выключайте в таблицах с группами и раскрытием. */
  striped?: boolean;
  /** `table-layout: fixed`: ширины колонок задаются первой строкой или `<col>`. */
  fixed?: boolean;
};

export function Table({
  density = 'list',
  striped = true,
  fixed = false,
  className,
  children,
  ...props
}: TableProps) {
  return (
    <TableContext.Provider value={{ density, striped }}>
      <table
        className={cx(
          'w-full border-separate border-spacing-0 text-sm text-[#1f3565]',
          fixed && 'table-fixed',
          className,
        )}
        {...props}
      >
        {children}
      </table>
    </TableContext.Provider>
  );
}

type THeadProps = ComponentProps<'thead'> & { sticky?: boolean };

export function THead({ sticky = false, className, ...props }: THeadProps) {
  return <thead className={cx(sticky && 'sticky top-0 z-20', className)} {...props} />;
}

export function TBody(props: ComponentProps<'tbody'>) {
  return <tbody {...props} />;
}

type TFootProps = ComponentProps<'tfoot'> & { sticky?: boolean };

/** Строка итогов: фон шапки и полужирный текст. */
export function TFoot({ sticky = false, className, ...props }: TFootProps) {
  return (
    <tfoot
      className={cx(
        '[&_td]:bg-[#f3f7ff] [&_td]:font-semibold [&_td]:text-[#10275a] [&_th]:font-semibold',
        sticky && 'sticky bottom-0 z-20',
        className,
      )}
      {...props}
    />
  );
}

type TrProps = ComponentProps<'tr'> & {
  striped?: boolean;
  hoverable?: boolean;
  /**
   * Свой фон строки (например, `bg-amber-50` у строк-групп) вместо белого с зеброй.
   * Через `className` фон не задавайте: порядок классов Tailwind не гарантирует,
   * какой из двух `bg-*` победит.
   */
  background?: string;
};

/** Строка тела. В `<thead>` используйте обычный `<tr>`. */
export function Tr({
  striped,
  hoverable = true,
  background,
  className,
  ...props
}: TrProps) {
  const table = useContext(TableContext);

  return (
    <tr
      className={cx(
        'transition-colors',
        background ?? cx('bg-white', (striped ?? table.striped) && 'even:bg-[#fbfcff]'),
        hoverable && 'hover:bg-[#f3f7ff]',
        className,
      )}
      {...props}
    />
  );
}

type ThProps = ComponentProps<'th'> & {
  align?: CellAlign;
  /** Числовая колонка: заголовок справа. */
  numeric?: boolean;
  pin?: CellPin;
  /** Текущее направление сортировки этой колонки, `null` — колонка не отсортирована. */
  sortDirection?: SortDirection | null;
  /** Делает заголовок кнопкой сортировки. */
  onSort?: () => void;
  /** Доступное имя кнопки сортировки, если текста заголовка недостаточно. */
  sortLabel?: string;
};

export function Th({
  align,
  numeric = false,
  pin,
  sortDirection = null,
  onSort,
  sortLabel,
  scope = 'col',
  className,
  children,
  ...props
}: ThProps) {
  const { density } = useContext(TableContext);
  const resolvedAlign = align ?? (numeric ? 'right' : 'left');
  const ariaSort =
    onSort && sortDirection
      ? sortDirection === 'asc'
        ? 'ascending'
        : 'descending'
      : undefined;

  return (
    <th
      scope={scope}
      aria-sort={ariaSort}
      className={cx(
        cellBorderClasses,
        cellPaddingClasses[density],
        alignClasses[resolvedAlign],
        'bg-[#f3f7ff] align-middle text-xs font-bold tracking-[0.05em] text-[#7e8fb4] uppercase',
        pin && pinCellClasses(pin, props.colSpan),
        className,
      )}
      {...props}
    >
      {onSort ? (
        <button
          type='button'
          onClick={onSort}
          aria-label={sortLabel}
          // Кнопка по умолчанию центрирует перенесённый текст — выравниваем как колонку.
          className={cx(
            'inline-flex items-center gap-1 uppercase transition-colors hover:text-[#2d6ff7]',
            alignClasses[resolvedAlign],
          )}
        >
          <span>{children}</span>
          <SortIcon direction={sortDirection} />
        </button>
      ) : (
        children
      )}
    </th>
  );
}

type TdProps = ComponentProps<'td'> & {
  align?: CellAlign;
  /** Числа и деньги: справа, цифры одинаковой ширины, без переноса. */
  numeric?: boolean;
  pin?: CellPin;
};

export function Td({ align, numeric = false, pin, className, ...props }: TdProps) {
  const { density } = useContext(TableContext);
  const resolvedAlign = align ?? (numeric ? 'right' : 'left');

  return (
    <td
      className={cx(
        cellBorderClasses,
        cellPaddingClasses[density],
        alignClasses[resolvedAlign],
        'align-middle',
        numeric && 'whitespace-nowrap tabular-nums',
        // Фон строки, чтобы прокручиваемые ячейки не просвечивали сквозь закреплённую.
        pin && cx(pinCellClasses(pin, props.colSpan), 'bg-inherit'),
        className,
      )}
      {...props}
    />
  );
}

type TableMessageRowProps = {
  /** Если не задано, ячейка растягивается на все колонки шапки. */
  colSpan?: number;
  className?: string;
  children: ReactNode;
};

/** Строка на всю ширину таблицы: загрузка, пусто, ошибка. */
export function TableMessageRow({ colSpan, className, children }: TableMessageRowProps) {
  const { density } = useContext(TableContext);
  const cellRef = useRef<HTMLTableCellElement>(null);

  // Число колонок берётся из шапки, чтобы не держать его вручную рядом с разметкой.
  useLayoutEffect(() => {
    const cell = cellRef.current;
    if (!cell || colSpan) return;

    const headerRow = cell.closest('table')?.tHead?.rows[0];
    const count = headerRow
      ? Array.from(headerRow.cells).reduce((total, header) => total + header.colSpan, 0)
      : 1;

    if (cell.colSpan !== count) cell.colSpan = count;
  });

  return (
    <tr>
      <td
        ref={cellRef}
        colSpan={colSpan}
        className={cx(
          'border-b border-[#e3e9f3] px-4 text-center text-sm text-[#7e8fb4]',
          density === 'list' ? 'py-10' : 'py-6',
          className,
        )}
      >
        {children}
      </td>
    </tr>
  );
}

export function TableLoadingRow({ colSpan }: { colSpan?: number }) {
  return (
    <TableMessageRow colSpan={colSpan}>
      <Preloader color='slate' />
    </TableMessageRow>
  );
}

export function TableEmptyRow({
  colSpan,
  children,
}: {
  colSpan?: number;
  children: ReactNode;
}) {
  return <TableMessageRow colSpan={colSpan}>{children}</TableMessageRow>;
}

export function TableErrorRow({
  colSpan,
  children,
  onRetry,
}: {
  colSpan?: number;
  children: ReactNode;
  onRetry?: () => void;
}) {
  return (
    <TableMessageRow colSpan={colSpan} className='text-[#c83f52]'>
      <span>{children}</span>
      {onRetry ? (
        <button
          type='button'
          onClick={onRetry}
          className='ml-3 font-semibold text-[#2d6ff7] hover:underline'
        >
          Повторить
        </button>
      ) : null}
    </TableMessageRow>
  );
}

type TableExpandButtonProps = {
  expanded: boolean;
  onToggle: () => void;
  label: string;
  className?: string;
};

/** Шеврон раскрытия строки; клик не всплывает к обработчику строки. */
export function TableExpandButton({
  expanded,
  onToggle,
  label,
  className,
}: TableExpandButtonProps) {
  return (
    <button
      type='button'
      aria-expanded={expanded}
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className={cx(
        'inline-flex size-6 shrink-0 items-center justify-center rounded-md text-[#7e8fb4] transition-colors hover:bg-[#e8efff] hover:text-[#2d6ff7]',
        className,
      )}
    >
      <svg
        viewBox='0 0 16 16'
        aria-hidden='true'
        className={cx(
          'size-3.5 fill-none stroke-current stroke-2 transition-transform [stroke-linecap:round] [stroke-linejoin:round]',
          expanded && 'rotate-90',
        )}
      >
        <path d='m6 3.5 4.5 4.5L6 12.5' />
      </svg>
    </button>
  );
}

/** Ряд иконок-действий в ячейке. */
export function TableActions({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div className={cx('flex items-center justify-center gap-1', className)} {...props} />
  );
}

type TableActionTone = 'default' | 'danger' | 'success';

const actionToneClasses: Record<TableActionTone, string> = {
  default: 'enabled:hover:bg-[#edf3ff] enabled:hover:text-[#2d6ff7]',
  danger: 'enabled:hover:bg-[#fff1f3] enabled:hover:text-[#f2324c]',
  success: 'enabled:hover:bg-[#ebf8f0] enabled:hover:text-[#0ea04a]',
};

type TableActionButtonProps = ComponentProps<'button'> & {
  label: string;
  tone?: TableActionTone;
  active?: boolean;
};

/** Иконка-действие в строке; `label` — подсказка и доступное имя. */
export function TableActionButton({
  label,
  tone = 'default',
  active = false,
  className,
  type = 'button',
  ...props
}: TableActionButtonProps) {
  return (
    <button
      type={type}
      title={label}
      aria-label={label}
      className={cx(
        'inline-flex size-7 shrink-0 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:size-4',
        active ? 'text-[#2d6ff7]' : 'text-[#7e8fb4]',
        actionToneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
