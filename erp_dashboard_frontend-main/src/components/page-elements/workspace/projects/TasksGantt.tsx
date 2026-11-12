import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react';

import type { Task } from '../../../../types/app';
import { formatTaskDueDates } from '../../../../utils/taskDueBuckets';
import {
  GANTT_DAY_WIDTH,
  GANTT_SCALES,
  buildGanttCells,
  buildGanttGroups,
  buildGanttRange,
  daysBetween,
  formatGanttDates,
  getGanttItem,
  type GanttItem,
  type GanttScale,
} from '../../../../utils/taskGantt';

type TaskStatusInfo = {
  label: string;
  color: string;
};

type Props<T extends Task> = {
  // Задачи уже отфильтрованы; выполненные в вид не передаются, как и в "По срокам".
  tasks: T[];
  isLoading: boolean;
  hasActiveFilter: boolean;
  getStatus: (_task: T) => TaskStatusInfo;
  getSubtitle?: (_task: T) => string | null;
  onOpenTask: (_task: T) => void;
  // Родитель на телефоне прокручивается сам: диаграмма растёт по высоте без своей вертикальной прокрутки.
  scrollWithPageOnMobile?: boolean;
};

type Viewport = {
  // Видимая часть шкалы в px от её начала.
  start: number;
  end: number;
};

const NARROW_SCREEN_QUERY = '(max-width: 639px)';
const OVERDUE_COLOR = '#ef2d2d';
const TODAY_COLOR = '#f29a3f';
// Отметки "только старт" и "только дедлайн" шириной 14px.
const MARKER_HALF_WIDTH = 7;
const EDGE_HINT_MIN_VISIBLE = 40;

function joinClassNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function tintColor(color: string, percent: number) {
  return `color-mix(in srgb, ${color} ${percent}%, white)`;
}

/** Грубая оценка ширины подписи 12px, чтобы решить, влезает ли она в полоску. */
function estimateLabelWidth(text: string) {
  return text.length * 6.8 + 18;
}

function getTaskTitle(task: Task) {
  return task.parent_task_id
    ? `↳ ${task.title || 'Без названия'}`
    : task.title || 'Без названия';
}

function isTaskOverdue(task: Task, now: Date) {
  if (!task.deadline) return false;
  const deadline = new Date(task.deadline);
  return !Number.isNaN(deadline.getTime()) && deadline < now;
}

function getItemBounds(item: GanttItem<unknown>, rangeStart: Date, dayWidth: number) {
  const left = daysBetween(rangeStart, item.startDay) * dayWidth;
  if (item.kind === 'range') {
    const width = Math.max((daysBetween(item.startDay, item.endDay) + 1) * dayWidth, 6);
    return { x0: left, x1: left + width };
  }
  const center = left + dayWidth / 2;
  return { x0: center - MARKER_HALF_WIDTH, x1: center + MARKER_HALF_WIDTH };
}

/**
 * Подзадачи идут сразу за родителем, если он тоже на шкале; остальные — по дате начала.
 */
function orderGanttItems<T extends Task>(items: GanttItem<T>[]): GanttItem<T>[] {
  const sorted = [...items].sort(
    (left, right) =>
      left.startDay.getTime() - right.startDay.getTime() ||
      left.endDay.getTime() - right.endDay.getTime() ||
      (left.task.title ?? '').localeCompare(right.task.title ?? '', 'ru'),
  );
  const ids = new Set(sorted.map((item) => item.task.id));
  const childrenByParent = new Map<string, GanttItem<T>[]>();
  const roots: GanttItem<T>[] = [];
  for (const item of sorted) {
    const parentId = item.task.parent_task_id ?? null;
    if (!parentId || !ids.has(parentId)) {
      roots.push(item);
      continue;
    }
    const list = childrenByParent.get(parentId) ?? [];
    list.push(item);
    childrenByParent.set(parentId, list);
  }

  const result: GanttItem<T>[] = [];
  const visit = (item: GanttItem<T>) => {
    result.push(item);
    (childrenByParent.get(item.task.id) ?? []).forEach(visit);
  };
  roots.forEach(visit);
  return result;
}

function useIsNarrowScreen() {
  const [isNarrow, setIsNarrow] = useState(
    () => window.matchMedia(NARROW_SCREEN_QUERY).matches,
  );
  useEffect(() => {
    const media = window.matchMedia(NARROW_SCREEN_QUERY);
    const handleChange = () => setIsNarrow(media.matches);
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);
  return isNarrow;
}

export default function TasksGantt<T extends Task>({
  tasks,
  isLoading,
  hasActiveFilter,
  getStatus,
  getSubtitle,
  onOpenTask,
  scrollWithPageOnMobile = false,
}: Props<T>) {
  const isNarrow = useIsNarrowScreen();
  // На узком экране по дням видно меньше недели, поэтому там стартуем с недель.
  const [scale, setScale] = useState<GanttScale>(() => (isNarrow ? 'week' : 'day'));
  // null — по умолчанию: список свёрнут, пока есть диаграмма, чтобы не отнимать у неё высоту.
  const [isUndatedExpanded, setIsUndatedExpanded] = useState<boolean | null>(null);
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const labelsRef = useRef<HTMLDivElement | null>(null);
  const undatedRef = useRef<HTMLDivElement | null>(null);
  const scrolledScaleRef = useRef<GanttScale | null>(null);
  const viewportFrameRef = useRef(0);

  const now = useMemo(() => new Date(), []);

  const { items, undatedTasks } = useMemo(() => {
    const dated: GanttItem<T>[] = [];
    const undated: T[] = [];
    for (const task of tasks) {
      const item = getGanttItem(task);
      if (item) dated.push(item);
      else undated.push(task);
    }
    undated.sort((left, right) =>
      (left.title ?? '').localeCompare(right.title ?? '', 'ru'),
    );
    return { items: orderGanttItems(dated), undatedTasks: undated };
  }, [tasks]);

  const dayWidth = GANTT_DAY_WIDTH[scale];
  const range = useMemo(() => buildGanttRange(items, scale, now), [items, now, scale]);
  const cells = useMemo(() => buildGanttCells(range, scale, now), [now, range, scale]);
  const groups = useMemo(() => buildGanttGroups(range, scale), [range, scale]);
  const timelineWidth = range.days * dayWidth;
  const todayX = (daysBetween(range.start, now) + 0.5) * dayWidth;

  const updateViewport = useCallback(() => {
    const body = bodyRef.current;
    if (!body) return;
    // Колонка названий прилипает слева и закрывает начало шкалы.
    const labelsWidth = labelsRef.current?.offsetWidth ?? 0;
    const start = body.scrollLeft;
    const end = start + body.clientWidth - labelsWidth;
    setViewport((prev) =>
      prev && prev.start === start && prev.end === end ? prev : { start, end },
    );
  }, []);

  const handleBodyScroll = () => {
    // Шапка вынесена из области прокрутки, чтобы на телефоне прилипать к верху страницы.
    if (headerRef.current && bodyRef.current) {
      headerRef.current.scrollLeft = bodyRef.current.scrollLeft;
    }
    cancelAnimationFrame(viewportFrameRef.current);
    viewportFrameRef.current = requestAnimationFrame(updateViewport);
  };

  const scrollTimelineTo = useCallback((x: number, behavior: ScrollBehavior) => {
    const body = bodyRef.current;
    if (!body) return;
    const labelsWidth = labelsRef.current?.offsetWidth ?? 0;
    const visibleWidth = body.clientWidth - labelsWidth;
    body.scrollTo({ left: Math.max(0, x - visibleWidth / 3), behavior });
  }, []);

  const scrollToToday = useCallback(
    (behavior: ScrollBehavior = 'auto') => scrollTimelineTo(todayX, behavior),
    [scrollTimelineTo, todayX],
  );

  const hasChart = !isLoading && items.length > 0;
  const isUndatedOpen = isUndatedExpanded ?? !hasChart;

  // Сегодняшний день в зоне видимости при открытии вида и при смене масштаба.
  useLayoutEffect(() => {
    if (!hasChart) {
      scrolledScaleRef.current = null;
      return;
    }
    if (scrolledScaleRef.current === scale) return;
    scrolledScaleRef.current = scale;
    scrollToToday();
    updateViewport();
  }, [hasChart, scale, scrollToToday, updateViewport]);

  useEffect(() => {
    const body = bodyRef.current;
    if (!hasChart || !body) return;
    const observer = new ResizeObserver(() => updateViewport());
    observer.observe(body);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(viewportFrameRef.current);
    };
  }, [hasChart, updateViewport]);

  if (isLoading) {
    return (
      <div className='flex flex-1 items-center justify-center rounded-xl border border-[#e3e9f3] bg-[#fbfcff] py-10'>
        <div className='h-6 w-6 animate-spin rounded-full border-2 border-[#c9d8f8] border-t-[#2d6ff7]' />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className='grid min-h-40 flex-1 place-items-center rounded-xl border border-[#e3e9f3] bg-white px-4 py-10 text-center text-[#7e8fb4]'>
        {hasActiveFilter ? 'По выбранным фильтрам ничего не найдено.' : 'Задач пока нет.'}
      </div>
    );
  }

  const fillClassName = scrollWithPageOnMobile
    ? 'sm:min-h-0 sm:flex-1'
    : 'min-h-0 flex-1';

  const openUndated = () => {
    setIsUndatedExpanded(true);
    requestAnimationFrame(() =>
      undatedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
    );
  };

  return (
    <div
      className={joinClassNames(
        'flex min-w-0 flex-col gap-2',
        scrollWithPageOnMobile ? 'sm:min-h-80' : 'min-h-80',
        fillClassName,
      )}
    >
      <div className='flex flex-wrap items-center gap-2'>
        <div
          role='tablist'
          aria-label='Масштаб'
          className='inline-flex items-center rounded-xl border border-[#e3e9f3] bg-white p-0.5 text-[13px] font-semibold text-[#7e8fb4]'
        >
          {GANTT_SCALES.map((option) => (
            <button
              key={option.key}
              type='button'
              role='tab'
              aria-selected={scale === option.key}
              onClick={() => setScale(option.key)}
              className={joinClassNames(
                'rounded-lg px-3 py-1.5 transition-colors',
                scale === option.key
                  ? 'bg-[#f3f7ff] text-[#2d6ff7]'
                  : 'hover:text-[#1f3565]',
              )}
            >
              {option.name}
            </button>
          ))}
        </div>
        {hasChart ? (
          <button
            type='button'
            onClick={() => scrollToToday('smooth')}
            className='h-9 rounded-xl border border-[#c9d8f8] bg-white px-3 text-[13px] font-semibold text-[#1f3565] transition-colors hover:bg-[#f3f7ff]'
          >
            Сегодня
          </button>
        ) : null}
        {undatedTasks.length ? (
          <button
            type='button'
            onClick={openUndated}
            className='inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#e3e9f3] bg-[#fbfcff] px-3 text-[13px] font-semibold text-[#53617c] transition-colors hover:bg-[#f3f7ff]'
          >
            Без сроков
            <span className='rounded-full bg-[#e8eef9] px-1.5 text-[11px] text-[#1f3565]'>
              {undatedTasks.length}
            </span>
          </button>
        ) : null}
        {hasChart ? (
          <button
            type='button'
            onClick={() => setIsLegendOpen((prev) => !prev)}
            aria-expanded={isLegendOpen}
            aria-label='Обозначения'
            title='Обозначения'
            className={joinClassNames(
              'grid size-9 place-items-center rounded-xl border text-[14px] font-semibold transition-colors 2xl:hidden',
              isLegendOpen
                ? 'border-[#2d6ff7] bg-[#edf3ff] text-[#2d6ff7]'
                : 'border-[#c9d8f8] bg-white text-[#53617c]',
            )}
          >
            ?
          </button>
        ) : null}
        {hasChart ? <GanttLegend className='ml-auto hidden 2xl:flex' /> : null}
      </div>
      {hasChart && isLegendOpen ? (
        <GanttLegend className='flex rounded-xl border border-[#e3e9f3] bg-[#fbfcff] px-3 py-2 2xl:hidden' />
      ) : null}

      {hasChart ? (
        <div
          className={joinClassNames(
            'flex flex-col rounded-xl border border-[#e3e9f3] bg-white',
            fillClassName,
          )}
        >
          {/* Шапка: месяцы (годы) и деления шкалы, прокручивается вместе с телом. */}
          <div
            ref={headerRef}
            className={joinClassNames(
              'shrink-0 overflow-hidden rounded-t-xl border-b border-[#e3e9f3] bg-[#f3f7ff] [scrollbar-gutter:stable]',
              scrollWithPageOnMobile && 'max-sm:sticky max-sm:top-0 max-sm:z-20',
            )}
          >
            <div className='flex min-w-max'>
              <div className='sticky left-0 z-10 hidden h-14 w-72 shrink-0 items-end border-r border-[#e3e9f3] bg-[#f3f7ff] px-3 pb-2 text-xs font-bold tracking-[0.05em] text-[#7e8fb4] uppercase sm:flex'>
                Задача
              </div>
              <div className='relative h-14 shrink-0' style={{ width: timelineWidth }}>
                {groups.map((group) => (
                  <div
                    key={group.key}
                    className='absolute top-0 flex h-7 items-center border-l border-[#e3e9f3] px-2 text-[12px] font-semibold whitespace-nowrap text-[#1f3565]'
                    style={{
                      left: group.offset * dayWidth,
                      width: group.days * dayWidth,
                    }}
                  >
                    <span className='sticky left-2 truncate sm:left-[calc(18rem+0.5rem)]'>
                      {group.label}
                    </span>
                  </div>
                ))}
                {cells.map((cell) => (
                  <div
                    key={cell.key}
                    className={joinClassNames(
                      'absolute top-7 flex h-7 items-center justify-center border-t border-l border-[#e3e9f3] text-[11px] whitespace-nowrap',
                      cell.isCurrent
                        ? 'bg-[#fff1e0] font-semibold text-[#c56a12]'
                        : cell.isWeekend
                          ? 'text-[#9aa8c7]'
                          : 'text-[#53617c]',
                    )}
                    style={{ left: cell.offset * dayWidth, width: cell.days * dayWidth }}
                  >
                    {cell.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div
            ref={bodyRef}
            onScroll={handleBodyScroll}
            className={joinClassNames(
              'relative rounded-b-xl [scrollbar-gutter:stable]',
              scrollWithPageOnMobile
                ? 'overflow-x-auto overflow-y-hidden sm:min-h-0 sm:flex-1 sm:overflow-y-auto'
                : 'min-h-0 flex-1 overflow-auto',
            )}
          >
            <div className='flex min-w-max'>
              <div
                ref={labelsRef}
                className='sticky left-0 z-10 hidden w-72 shrink-0 border-r border-[#e3e9f3] bg-white sm:block'
              >
                {items.map((item) => {
                  const { task } = item;
                  const status = getStatus(task);
                  const subtitle = getSubtitle?.(task);
                  const isOverdue = isTaskOverdue(task, now);
                  const isHovered = hoveredTaskId === task.id;
                  return (
                    <button
                      key={task.id}
                      type='button'
                      onClick={() => onOpenTask(task)}
                      onMouseEnter={() => setHoveredTaskId(task.id)}
                      onMouseLeave={() => setHoveredTaskId(null)}
                      title={task.title}
                      className={joinClassNames(
                        'flex h-11 w-full min-w-0 items-center gap-2 border-b border-[#eef2f8] px-3 text-left transition-colors',
                        isHovered ? 'bg-[#f3f7ff]' : 'bg-white',
                      )}
                    >
                      <span
                        className='size-2 shrink-0 rounded-full'
                        style={{ backgroundColor: status.color }}
                        aria-hidden='true'
                      />
                      <span className='flex min-w-0 flex-1 flex-col'>
                        <span
                          className={joinClassNames(
                            'truncate text-[13px] leading-snug font-semibold',
                            isHovered ? 'text-[#2d6ff7]' : 'text-[#10275a]',
                          )}
                        >
                          {getTaskTitle(task)}
                        </span>
                        <span className='truncate text-[11px] leading-snug text-[#7e8fb4]'>
                          <span
                            className={
                              isOverdue ? 'font-semibold text-[#ef2d2d]' : undefined
                            }
                          >
                            {formatGanttDates(item, now)}
                            {isOverdue ? ' · просрочено' : ''}
                          </span>
                          {subtitle ? ` · ${subtitle}` : ''}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className='relative shrink-0' style={{ width: timelineWidth }}>
                {/* Сетка шкалы, выходные и отметка текущего дня под полосками задач. */}
                <div className='pointer-events-none absolute inset-0' aria-hidden='true'>
                  {cells.map((cell) => (
                    <div
                      key={cell.key}
                      className={joinClassNames(
                        'absolute inset-y-0 border-l border-[#eef2f8]',
                        cell.isWeekend && 'bg-[#f5f7fb]',
                      )}
                      style={{
                        left: cell.offset * dayWidth,
                        width: cell.days * dayWidth,
                      }}
                    />
                  ))}
                  <div
                    className='absolute inset-y-0 w-0.5 -translate-x-1/2'
                    style={{ left: todayX, backgroundColor: TODAY_COLOR }}
                  />
                </div>

                {items.map((item) => (
                  <GanttRow
                    key={item.task.id}
                    item={item}
                    rangeStart={range.start}
                    dayWidth={dayWidth}
                    viewport={viewport}
                    status={getStatus(item.task)}
                    isOverdue={isTaskOverdue(item.task, now)}
                    isHovered={hoveredTaskId === item.task.id}
                    isNarrow={isNarrow}
                    now={now}
                    onHoverChange={(isOver) =>
                      setHoveredTaskId(isOver ? item.task.id : null)
                    }
                    onOpen={() => onOpenTask(item.task)}
                    onScrollTo={(x) => scrollTimelineTo(x, 'smooth')}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className='grid min-h-24 flex-1 place-items-center rounded-xl border border-[#e3e9f3] bg-white px-4 py-8 text-center text-[13px] text-[#7e8fb4]'>
          Нет задач со сроками.
        </div>
      )}

      {undatedTasks.length ? (
        <div
          ref={undatedRef}
          className='shrink-0 scroll-mt-2 rounded-xl border border-[#e3e9f3] bg-[#fbfcff]'
        >
          <button
            type='button'
            onClick={() => setIsUndatedExpanded(!isUndatedOpen)}
            aria-expanded={isUndatedOpen}
            className='flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-semibold text-[#1f3565]'
          >
            <svg
              viewBox='0 0 24 24'
              className={joinClassNames(
                'size-4 shrink-0 fill-none stroke-current stroke-[1.8] text-[#7e8fb4] transition-transform',
                isUndatedOpen ? 'rotate-90' : '',
              )}
              aria-hidden='true'
            >
              <path d='m9 6 6 6-6 6' strokeLinecap='round' strokeLinejoin='round' />
            </svg>
            Без сроков
            <span className='rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[#7e8fb4]'>
              {undatedTasks.length}
            </span>
          </button>
          {isUndatedOpen ? (
            <div
              className={joinClassNames(
                'grid gap-1.5 px-3 pb-3 sm:grid-cols-[repeat(auto-fill,minmax(240px,1fr))]',
                scrollWithPageOnMobile
                  ? 'sm:max-h-44 sm:overflow-y-auto'
                  : 'max-h-44 overflow-y-auto',
              )}
            >
              {undatedTasks.map((task) => {
                const status = getStatus(task);
                const subtitle = getSubtitle?.(task);
                return (
                  <button
                    key={task.id}
                    type='button'
                    onClick={() => onOpenTask(task)}
                    title={task.title}
                    className='flex min-w-0 items-center gap-2 rounded-lg border border-[#e3e9f3] bg-white px-2.5 py-1.5 text-left transition-colors hover:border-[#2d6ff7] hover:bg-[#f3f7ff]'
                  >
                    <span
                      className='size-2 shrink-0 rounded-full'
                      style={{ backgroundColor: status.color }}
                      aria-hidden='true'
                    />
                    <span className='flex min-w-0 flex-1 flex-col'>
                      <span className='truncate text-[13px] leading-snug font-semibold text-[#10275a]'>
                        {getTaskTitle(task)}
                      </span>
                      {subtitle ? (
                        <span className='truncate text-[11px] leading-snug text-[#7e8fb4]'>
                          {subtitle}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function GanttLegend({ className }: { className: string }) {
  return (
    <div
      className={joinClassNames(
        'flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[#7e8fb4]',
        className,
      )}
    >
      <span className='inline-flex items-center gap-1.5'>
        <span className='h-2.5 w-6 rounded-sm border border-[#2d6ff7] bg-[#c9dafd]' />
        Старт — дедлайн
      </span>
      <span className='inline-flex items-center gap-1.5'>
        <span className='size-2.5 rounded-full border-2 border-[#2d6ff7] bg-white' />
        Только старт
      </span>
      <span className='inline-flex items-center gap-1.5'>
        <span className='size-2.5 rotate-45 bg-[#2d6ff7]' />
        Только дедлайн
      </span>
      <span className='inline-flex items-center gap-1.5'>
        <span className='h-2.5 w-6 rounded-sm border-2 border-[#ef2d2d] bg-[#fde8eb]' />
        Просрочено
      </span>
      <span className='inline-flex items-center gap-1.5'>
        <span className='h-3 w-0.5' style={{ backgroundColor: TODAY_COLOR }} />
        Сегодня
      </span>
    </div>
  );
}

function GanttRow<T extends Task>({
  item,
  rangeStart,
  dayWidth,
  viewport,
  status,
  isOverdue,
  isHovered,
  isNarrow,
  now,
  onHoverChange,
  onOpen,
  onScrollTo,
}: {
  item: GanttItem<T>;
  rangeStart: Date;
  dayWidth: number;
  viewport: Viewport | null;
  status: TaskStatusInfo;
  isOverdue: boolean;
  isHovered: boolean;
  isNarrow: boolean;
  now: Date;
  onHoverChange: (_isOver: boolean) => void;
  onOpen: () => void;
  onScrollTo: (_x: number) => void;
}) {
  const { task, kind } = item;
  const { x0, x1 } = getItemBounds(item, rangeStart, dayWidth);
  const title = getTaskTitle(task);
  const dates = formatGanttDates(item, now);
  // На телефоне название уже есть над полоской, поэтому рядом с ней пишем сроки.
  const label = isNarrow ? dates : title;
  const accent = isOverdue ? OVERDUE_COLOR : status.color;
  const tooltip = [
    task.title || 'Без названия',
    formatTaskDueDates(task),
    `Статус: ${status.label}`,
    isOverdue ? 'Просрочено' : null,
  ]
    .filter(Boolean)
    .join('\n');

  // Справа подпись идёт после полоски и не видна, пока задача едва выглядывает из-за края.
  const isBeforeView = viewport !== null && x1 < viewport.start + 4;
  const isAfterView = viewport !== null && x0 > viewport.end - EDGE_HINT_MIN_VISIBLE;

  const stop = (event: MouseEvent, action: () => void) => {
    event.stopPropagation();
    action();
  };

  const barPosition =
    'absolute bottom-1.5 flex h-5 items-center sm:top-1/2 sm:bottom-auto sm:h-7 sm:-translate-y-1/2';
  const outerLabel = (
    <span
      className={joinClassNames(
        'ml-1.5 max-w-60 truncate text-[11px] leading-snug font-medium whitespace-nowrap group-hover:text-[#2d6ff7] sm:text-[12px]',
        isOverdue ? 'text-[#ef2d2d]' : 'text-[#53617c]',
      )}
    >
      {label}
    </span>
  );

  let mark;
  if (kind === 'range') {
    const width = x1 - x0;
    const hasInnerLabel = estimateLabelWidth(label) <= width;
    mark = (
      <button
        type='button'
        onClick={(event) => stop(event, onOpen)}
        title={tooltip}
        className={joinClassNames('group', barPosition)}
        style={{ left: x0 }}
      >
        <span
          className={joinClassNames(
            'flex h-full items-center overflow-clip rounded-md px-2 text-[11px] font-semibold shadow-sm transition-[filter] group-hover:brightness-95 sm:text-[12px]',
            isOverdue ? 'border-2 text-[#b42345]' : 'border text-[#10275a]',
          )}
          style={{
            width,
            borderColor: accent,
            backgroundColor: isOverdue ? '#fde8eb' : tintColor(status.color, 30),
          }}
        >
          {/* overflow-clip не мешает sticky: подпись держится у левого края видимой шкалы. */}
          {hasInnerLabel ? (
            <span className='sticky left-2 min-w-0 truncate leading-snug sm:left-[calc(18rem+0.5rem)]'>
              {label}
            </span>
          ) : null}
        </span>
        {hasInnerLabel ? null : outerLabel}
      </button>
    );
  } else {
    mark = (
      <button
        type='button'
        onClick={(event) => stop(event, onOpen)}
        title={tooltip}
        className={joinClassNames('group', barPosition)}
        style={{ left: x0 }}
      >
        <span className='grid size-3.5 shrink-0 place-items-center'>
          {kind === 'deadline' ? (
            <span
              className='size-2.5 rotate-45 ring-2 ring-white transition-transform group-hover:scale-125'
              style={{ backgroundColor: accent }}
            />
          ) : (
            <span
              className='size-3 rounded-full border-2 bg-white transition-transform group-hover:scale-125'
              style={{ borderColor: accent }}
            />
          )}
        </span>
        {outerLabel}
      </button>
    );
  }

  const edgeHintClassName = joinClassNames(
    'absolute bottom-1.5 z-[1] inline-flex h-5 items-center gap-1 rounded-md border bg-white px-1.5 text-[11px] font-semibold whitespace-nowrap shadow-sm sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2',
    isOverdue ? 'border-[#f5b5bf] text-[#ef2d2d]' : 'border-[#c9d8f8] text-[#2d6ff7]',
  );

  return (
    // Строка целиком открывает задачу: отметки слишком мелкие для пальца.
    <div
      className={joinClassNames(
        'relative h-14 cursor-pointer border-b border-[#eef2f8] sm:h-11',
        isHovered && 'bg-[#f3f7ff]/70',
      )}
      onClick={onOpen}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      {/* На телефоне колонки названий нет: название над полоской, у левого края экрана. */}
      <span className='sticky left-2 mt-1.5 inline-flex max-w-[calc(100vw-5rem)] items-center gap-1.5 sm:hidden'>
        <span
          className='size-2 shrink-0 rounded-full'
          style={{ backgroundColor: status.color }}
          aria-hidden='true'
        />
        <span className='truncate text-[12px] leading-snug font-semibold text-[#10275a]'>
          {title}
        </span>
      </span>

      {mark}

      {isBeforeView && viewport ? (
        <button
          type='button'
          onClick={(event) => stop(event, () => onScrollTo(x0))}
          className={edgeHintClassName}
          style={{ left: viewport.start + 6 }}
          title='Показать задачу на шкале'
        >
          ‹ {dates}
        </button>
      ) : null}
      {isAfterView && viewport ? (
        <button
          type='button'
          onClick={(event) => stop(event, () => onScrollTo(x0))}
          className={joinClassNames(edgeHintClassName, '-translate-x-full')}
          style={{ left: viewport.end - 6 }}
          title='Показать задачу на шкале'
        >
          {dates} ›
        </button>
      ) : null}
    </div>
  );
}
