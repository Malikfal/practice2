import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';

import type { HoursChartGroupBy } from '../../../../../types/app';
import { formatReportTime } from '../ReportsTable';
import {
  axisLabel,
  formatHoursValue,
  incompleteNote,
  isWeekend,
  periodLabel,
  type HoursChartPoint,
} from './hoursChartUtils';

const DEFAULT_WIDTH = 720;
const HEIGHT = 260;
const PADDING = { top: 24, right: 16, bottom: 28, left: 44 };
const AXIS_CHAR_WIDTH = 7;
const VALUE_CHAR_WIDTH = 6.5;
/** Подписи значений над точками ставятся, когда на точку хватает места. */
const VALUE_LABEL_MIN_SLOT = 40;
const TOOLTIP_WIDTH = 240;
const LINE_COLOR = '#2d6ff7';
const STEPS_HOURS = [
  0.5, 1, 2, 4, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000,
];

/** Шкала часов от нуля с круглым шагом: не больше пяти делений. */
function hourTicks(maxSeconds: number): number[] {
  const maxHours = Math.max(maxSeconds / 3600, 1);
  const step =
    STEPS_HOURS.find((item) => maxHours / item <= 4) ??
    Math.ceil(maxHours / 4 / 1000) * 1000;
  const top = Math.ceil(maxHours / step) * step;
  const ticks: number[] = [];
  for (let value = 0; value <= top + step / 2; value += step) ticks.push(value * 3600);
  return ticks;
}

/** Ширина графика в пикселях: viewBox совпадает с ней, и подписи не масштабируются. */
function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setWidth(Math.max(260, Math.round(element.clientWidth)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}

type Props = {
  points: HoursChartPoint[];
  groupBy: HoursChartGroupBy;
};

/**
 * Линия выработки в часах. Неполный период — полая точка и пунктир к ней, будущие периоды
 * остаются на оси без точки: их нули выглядели бы провалом. Выходные в разбивке по дням подсвечены.
 */
export default function HoursChart({ points, groupBy }: Props) {
  const [containerRef, width] = useElementWidth<HTMLDivElement>();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const values = points.map((point) => (point.isFuture ? null : point.seconds));
  const ticks = hourTicks(Math.max(0, ...values.map((value) => value ?? 0)));
  const high = ticks[ticks.length - 1];
  const innerWidth = width - PADDING.left - PADDING.right;
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const baseline = PADDING.top + innerHeight;
  const slot = innerWidth / Math.max(points.length, 1);
  const center = (index: number) => PADDING.left + slot * index + slot / 2;
  const y = (seconds: number) => baseline - (seconds / high) * innerHeight;
  const labels = points.map((point) => axisLabel(point, groupBy));
  const longestLabel = Math.max(...labels.map((label) => label.length), 1);
  const labelStep = Math.max(1, Math.ceil(((longestLabel + 2) * AXIS_CHAR_WIDTH) / slot));
  const showValueLabels = slot >= VALUE_LABEL_MIN_SLOT;
  const showPoints = slot >= 10;

  const segments = values.flatMap((value, index) => {
    const next = values[index + 1];
    if (value === null || next === null || next === undefined) return [];
    return [
      {
        index,
        path: `M${center(index)},${y(value)} L${center(index + 1)},${y(next)}`,
        isIncomplete: points[index].isIncomplete || points[index + 1].isIncomplete,
      },
    ];
  });
  const drawn = values
    .map((value, index) => ({ value, index }))
    .filter((item): item is { value: number; index: number } => item.value !== null);
  const area =
    drawn.length > 1
      ? `M${center(drawn[0].index)},${baseline} ${drawn
          .map((item) => `L${center(item.index)},${y(item.value)}`)
          .join(' ')} L${center(drawn[drawn.length - 1].index)},${baseline} Z`
      : null;

  const activePoint = activeIndex === null ? null : points[activeIndex];
  const lastIndex = points.length - 1;

  // Стрелки листают периоды, как наведение мышью.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (points.length === 0) return;
    const moves: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      Home: -points.length,
      End: points.length,
    };
    if (event.key === 'Escape') {
      setActiveIndex(null);
      return;
    }
    const move = moves[event.key];
    if (move === undefined) return;
    event.preventDefault();
    setActiveIndex((current) =>
      Math.min(
        lastIndex,
        Math.max(0, (current ?? (move > 0 ? -1 : points.length)) + move),
      ),
    );
  };

  return (
    <div
      ref={containerRef}
      className='relative rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2d6ff7]'
      tabIndex={0}
      role='group'
      aria-label='График выработки в часах. Стрелки влево и вправо переключают период.'
      onKeyDown={handleKeyDown}
      onBlur={() => setActiveIndex(null)}
    >
      <svg
        viewBox={`0 0 ${width} ${HEIGHT}`}
        width={width}
        height={HEIGHT}
        className='block max-w-full'
        aria-hidden='true'
        onMouseLeave={() => setActiveIndex(null)}
      >
        <defs>
          <linearGradient id='hours-chart-area' x1='0' x2='0' y1='0' y2='1'>
            <stop offset='0%' stopColor={LINE_COLOR} stopOpacity={0.16} />
            <stop offset='100%' stopColor={LINE_COLOR} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {groupBy === 'day'
          ? points.map((point, index) =>
              isWeekend(point.key) ? (
                <rect
                  key={`weekend-${point.key}`}
                  x={center(index) - slot / 2}
                  y={PADDING.top}
                  width={slot}
                  height={innerHeight}
                  fill='#f5f7fb'
                />
              ) : null,
            )
          : null}

        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PADDING.left}
              x2={width - PADDING.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke={tick === 0 ? '#d3dcec' : '#edf1f8'}
            />
            <text
              x={PADDING.left - 8}
              y={y(tick) + 4}
              textAnchor='end'
              className='fill-[#7e8fb4] text-[11px] tabular-nums'
            >
              {formatHoursValue(tick)} ч
            </text>
          </g>
        ))}

        {activeIndex !== null ? (
          <line
            x1={center(activeIndex)}
            x2={center(activeIndex)}
            y1={PADDING.top}
            y2={baseline}
            stroke='#c3cee3'
            strokeDasharray='3 3'
          />
        ) : null}

        {area ? <path d={area} fill='url(#hours-chart-area)' /> : null}
        {segments.map((segment) => (
          <path
            key={segment.index}
            d={segment.path}
            fill='none'
            stroke={LINE_COLOR}
            strokeWidth={2}
            strokeLinecap='round'
            strokeDasharray={segment.isIncomplete ? '2 5' : undefined}
          />
        ))}
        {values.map((value, index) =>
          value === null || (!showPoints && activeIndex !== index) ? null : (
            <circle
              key={points[index].key}
              cx={center(index)}
              cy={y(value)}
              r={activeIndex === index ? 5 : 3.5}
              fill={points[index].isIncomplete ? '#ffffff' : LINE_COLOR}
              stroke={points[index].isIncomplete ? LINE_COLOR : '#ffffff'}
              strokeWidth={2}
            />
          ),
        )}

        {showValueLabels
          ? values.map((value, index) => {
              if (value === null || value === 0) return null;
              const text = formatHoursValue(value);
              const textWidth = text.length * VALUE_CHAR_WIDTH;
              return (
                <text
                  key={`value-${points[index].key}`}
                  x={Math.min(width - 2 - textWidth / 2, center(index))}
                  y={y(value) - 9}
                  textAnchor='middle'
                  className='fill-[#3b4a68] text-[11px] font-medium tabular-nums'
                  paintOrder='stroke'
                  stroke='#ffffff'
                  strokeWidth={4}
                >
                  {text}
                </text>
              );
            })
          : null}

        {points.map((point, index) => (
          <g key={`axis-${point.key}`}>
            {index % labelStep === 0 ? (
              <text
                x={center(index)}
                y={HEIGHT - 8}
                textAnchor='middle'
                className={`text-[11px] ${
                  point.isFuture ? 'fill-[#b8c3da]' : 'fill-[#7e8fb4]'
                }`}
              >
                {labels[index]}
              </text>
            ) : null}
            {/* Зона наведения — весь период, чтобы попадать и в пустые периоды. */}
            <rect
              x={center(index) - slot / 2}
              y={0}
              width={slot}
              height={HEIGHT}
              fill='transparent'
              onMouseEnter={() => setActiveIndex(index)}
            />
          </g>
        ))}
      </svg>

      {activePoint && activeIndex !== null ? (
        <div
          className='pointer-events-none absolute top-2 z-10'
          style={{
            width: Math.min(TOOLTIP_WIDTH, width - 16),
            left: Math.max(
              8,
              center(activeIndex) + 12 + TOOLTIP_WIDTH > width - 8
                ? center(activeIndex) - 12 - TOOLTIP_WIDTH
                : center(activeIndex) + 12,
            ),
          }}
          role='status'
        >
          <div className='grid gap-0.5 rounded-lg border border-[#d3dcec] bg-white px-3 py-2 text-xs text-[#53617c] shadow-lg'>
            <div className='font-semibold text-[#1f3565]'>
              {periodLabel(activePoint, groupBy)}
            </div>
            {activePoint.isFuture ? (
              <div>Период ещё не начался</div>
            ) : (
              <>
                <div className='tabular-nums'>
                  {formatReportTime(activePoint.seconds)}
                </div>
                {incompleteNote(activePoint, groupBy) ? (
                  <div className='text-[#b45309]'>
                    {incompleteNote(activePoint, groupBy)}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
