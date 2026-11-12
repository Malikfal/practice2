import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react';

import type {
  ManagerReportBucket,
  ManagerReportGranularity,
  ManagerReportManagerRow,
  ManagerReportCompany,
  ManagerReportMetrics,
  ManagerReportSeriesPoint,
} from '../../../../../types/managerReport';
import {
  formatInputDate,
  formatReportDate,
  formatReportHours,
  formatReportMoney,
} from './managerReportUtils';

const DEFAULT_WIDTH = 520;
const HEIGHT = 184;
const PADDING = { top: 26, right: 14, bottom: 24, left: 14 };
const AXIS_CHAR_WIDTH = 7;
const VALUE_CHAR_WIDTH = 6.5;
/** Подпись значения: высота строки и отступ от точки. */
const VALUE_LABEL_GAP = 8;
const VALUE_LABEL_HEIGHT = 12;
/** Насколько точка неполного периода может выйти за шкалу, если ее значение вне масштаба. */
const PIN_OFFSET = 8;
/** Место под подпись нижней точки, когда шкала начинается не с нуля. */
const FLOOR_GAP = 22;
const TOOLTIP_WIDTH = 340;
const TOOLTIP_OFFSET = 16;
const REFERENCE_COLOR = '#9aa8c4';
const DAY_MS = 86_400_000;

export type ManagerReportChartType = 'line' | 'bar';

type SeriesKey =
  | 'supervised_seconds'
  | 'developer_seconds'
  | 'supervised_hour_cost'
  | 'total_hour_cost'
  | 'developer_hour_cost';

type SeriesKind = 'hours' | 'money';

type Series = {
  key: SeriesKey;
  label: string;
  /** Короткая подпись в шапке панели, где показатель назван заголовком. */
  shortLabel?: string;
  kind: SeriesKind;
  color: string;
  /** Пунктир: совпадающая линия не закрывает другую целиком. */
  dashed?: boolean;
};

/**
 * Цвет закреплен за величиной: показатели менеджера синие, разработчиков оранжевые,
 * общая стоимость часа бирюзовая. Палитра проверена на различимость при дальтонизме.
 */
const SERIES: Series[] = [
  {
    key: 'supervised_seconds',
    label: 'Часы под контролем',
    shortLabel: 'под контролем',
    kind: 'hours',
    color: '#2d6ff7',
  },
  {
    key: 'developer_seconds',
    label: 'Часы разработчиков',
    shortLabel: 'разработчики',
    kind: 'hours',
    color: '#eb6834',
    dashed: true,
  },
  {
    key: 'supervised_hour_cost',
    label: 'Стоимость часа под контролем',
    kind: 'money',
    color: '#2d6ff7',
  },
  {
    key: 'total_hour_cost',
    label: 'Стоимость часа разработки',
    kind: 'money',
    color: '#1baf7a',
  },
  {
    key: 'developer_hour_cost',
    label: 'Стоимость часа разработчика',
    kind: 'money',
    color: '#eb6834',
  },
];

/**
 * Панель - один график со своей шкалой. Часы идут вместе, каждая стоимость часа отдельно:
 * показатели разного порядка на общей шкале сжимают друг друга в ровную полоску.
 */
type Panel = { key: string; title: string; kind: SeriesKind; series: Series[] };

function panelsOf(series: Series[]): Panel[] {
  const hours = series.filter((item) => item.kind === 'hours');
  return [
    ...(hours.length > 0
      ? [{ key: 'hours', title: 'Часы', kind: 'hours' as const, series: hours }]
      : []),
    ...series
      .filter((item) => item.kind === 'money')
      .map((item) => ({
        key: item.key,
        title: item.label,
        kind: 'money' as const,
        series: [item],
      })),
  ];
}

function formatValue(kind: SeriesKind, value: number): string {
  return kind === 'hours' ? formatReportHours(value) : formatReportMoney(value);
}

/** На оси неделя подписывается датой начала, полный диапазон показывается при наведении. */
function axisLabel(
  bucket: ManagerReportBucket,
  granularity: ManagerReportGranularity,
): string {
  if (granularity !== 'week') return bucket.label;
  const [, month, day] = bucket.from.split('-');
  return `${day}.${month}`;
}

function parseDay(value: string): number {
  const [year, month, day] = value.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

/** Целый период группировки, в который попадает день. */
function fullPeriod(
  day: number,
  granularity: ManagerReportGranularity,
): [number, number] {
  const date = new Date(day);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  switch (granularity) {
    case 'week': {
      const start = day - ((date.getUTCDay() + 6) % 7) * DAY_MS;
      return [start, start + 6 * DAY_MS];
    }
    case 'month':
      return [Date.UTC(year, month, 1), Date.UTC(year, month + 1, 0)];
    case 'quarter': {
      const first = month - (month % 3);
      return [Date.UTC(year, first, 1), Date.UTC(year, first + 3, 0)];
    }
    case 'year':
      return [Date.UTC(year, 0, 1), Date.UTC(year, 11, 31)];
  }
}

type Coverage = { days: number; fullDays: number; isOngoing: boolean };

/**
 * Период неполный, если обрезан границей отчёта или еще идет. Его часы и стоимость часа
 * несравнимы с целыми периодами: такая точка помечается и не задает масштаб графика.
 */
function bucketCoverage(
  bucket: ManagerReportBucket,
  granularity: ManagerReportGranularity,
  today: number,
): Coverage | null {
  const from = parseDay(bucket.from);
  const to = parseDay(bucket.to);
  const [start, end] = fullPeriod(from, granularity);
  const fullDays = Math.round((end - start) / DAY_MS) + 1;
  const isOngoing = today <= to;
  const days = Math.max(0, Math.round((Math.min(to, today) - from) / DAY_MS) + 1);
  return days < fullDays || isOngoing ? { days, fullDays, isOngoing } : null;
}

/** Шкала линий не от нуля: иначе динамика показателя занимает малую часть высоты. */
function scaleDomain(
  values: number[],
  chartType: ManagerReportChartType,
): [number, number] {
  if (values.length === 0) return [0, 1];
  const max = Math.max(...values);
  const min = Math.min(...values);
  if (max <= 0) return [0, 1];
  if (chartType === 'bar') return [0, max];
  // Размах не меньше пятой части максимума: колебания в пару процентов не выглядят скачками.
  const span = Math.max(max - min, max * 0.2);
  const extra = (span - (max - min)) / 2;
  const low = min - extra;
  // Обрезать ось ради небольшой части высоты незачем.
  return [low < max * 0.4 ? 0 : low, max + extra];
}

/** Ширина графика в пикселях: viewBox совпадает с ней, и подписи не масштабируются вместе с карточкой. */
function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setWidth(Math.max(200, Math.round(element.clientWidth)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}

/** Столбец со скругленным верхом, прижатый к оси. */
function barPath(x: number, y: number, width: number, height: number): string {
  const radius = Math.min(4, width / 2, height);
  return [
    `M${x},${y + height}`,
    `V${y + radius}`,
    `Q${x},${y} ${x + radius},${y}`,
    `H${x + width - radius}`,
    `Q${x + width},${y} ${x + width},${y + radius}`,
    `V${y + height}`,
    'Z',
  ].join(' ');
}

/**
 * Подпись над точкой на изломе вверх и под точкой на изломе вниз, по соседним точкам.
 * На монотонном участке подпись над точкой.
 */
function preferredSide(values: Array<number | null>, index: number): 'above' | 'below' {
  const value = values[index];
  const neighbours = [values[index - 1], values[index + 1]].filter(
    (item): item is number => item !== null && item !== undefined,
  );
  if (value === null || value === undefined || neighbours.length === 0) return 'above';
  return neighbours.every((item) => item > value) ? 'below' : 'above';
}

type PlacedLabel = {
  key: SeriesKey;
  x: number;
  y: number;
  text: string;
  /** Меньше - важнее: при нехватке места остаются крайние значения и последняя точка. */
  priority: number;
};

/** Важность подписи точки: неполный период, последняя точка, максимум, минимум, первая. */
function labelPriority(
  values: Array<number | null>,
  incomplete: boolean[],
  index: number,
): number {
  if (incomplete[index]) return 0;
  const complete = values
    .map((value, valueIndex) => ({ value, valueIndex }))
    .filter(
      (item): item is { value: number; valueIndex: number } =>
        item.value !== null && !incomplete[item.valueIndex],
    );
  if (complete.length === 0) return 5;
  if (index === complete[complete.length - 1].valueIndex) return 1;
  const value = values[index];
  if (value === Math.max(...complete.map((item) => item.value))) return 2;
  if (value === Math.min(...complete.map((item) => item.value))) return 3;
  return index === complete[0].valueIndex ? 4 : 5;
}

/** Один график - одна шкала. Наведение общее для всех графиков карточки. */
const ReportChart = memo(function ReportChart({
  title,
  kind,
  series,
  points,
  reference,
  buckets,
  incomplete,
  granularity,
  chartType,
  hoveredIndex,
  onHover,
}: {
  title: string;
  kind: SeriesKind;
  series: Series[];
  points: Array<ManagerReportSeriesPoint | undefined>;
  /** Тот же показатель по всей компании: тонкая линия для сравнения. */
  reference?: Array<number | null>;
  buckets: ManagerReportBucket[];
  incomplete: boolean[];
  granularity: ManagerReportGranularity;
  chartType: ManagerReportChartType;
  hoveredIndex: number | null;
  onHover: (_index: number | null) => void;
}) {
  const [containerRef, width] = useElementWidth<HTMLDivElement>();
  /** null - значения нет (например, стоимость часа без часов): точка и столбец не рисуются. */
  const values = series.map((item) =>
    points.map((point) => (point ? point[item.key] : null) ?? null),
  );
  const scaled = reference ? [...values, reference] : values;
  const known = (onlyComplete: boolean) =>
    scaled.flatMap((seriesValues) =>
      seriesValues.filter(
        (value, index): value is number =>
          value !== null && !(onlyComplete && incomplete[index]),
      ),
    );
  // Масштаб задают целые периоды. Если их нет, берутся все значения.
  const complete = known(true);
  const [low, high] = scaleDomain(
    complete.length > 0 ? complete : known(false),
    chartType,
  );
  const innerWidth = width - PADDING.left - PADDING.right;
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const slot = innerWidth / Math.max(buckets.length, 1);
  const baseline = PADDING.top + innerHeight;
  const labels = buckets.map((bucket) => axisLabel(bucket, granularity));
  const longestLabel = Math.max(...labels.map((label) => label.length), 1);
  const labelStep = Math.max(1, Math.ceil(((longestLabel + 2) * AXIS_CHAR_WIDTH) / slot));
  const center = (index: number) => PADDING.left + slot * index + slot / 2;
  const floor = low > 0 ? baseline - FLOOR_GAP : baseline;
  // Значение неполного периода вне шкалы прижимается к ее краю, точное число есть в подписи.
  const y = (value: number) =>
    Math.min(
      baseline,
      Math.max(
        PADDING.top - PIN_OFFSET,
        floor - ((value - low) / (high - low)) * (floor - PADDING.top),
      ),
    );
  // Столбцы шире, когда есть место: над каждым помещается подпись значения.
  const groupWidth = Math.min(slot - 8, series.length * 44);
  const barWidth = Math.max(3, (groupWidth - (series.length - 1) * 2) / series.length);

  const candidates: PlacedLabel[] = [];
  buckets.forEach((_bucket, index) => {
    const placed: Array<PlacedLabel & { side: 'above' | 'below'; pointY: number }> = [];
    series.forEach((item, seriesIndex) => {
      const value = values[seriesIndex][index];
      if (value === null || (chartType === 'bar' && value === 0)) return;
      const text = formatValue(kind, value);
      const textWidth = text.length * VALUE_CHAR_WIDTH;
      // Над столбцом подпись ставится, только если помещается по его ширине.
      if (chartType === 'bar' && series.length > 1 && textWidth > barWidth + 4) return;
      const x =
        chartType === 'line'
          ? center(index)
          : center(index) - groupWidth / 2 + seriesIndex * (barWidth + 2) + barWidth / 2;
      const pointY = y(value);
      const side =
        chartType === 'bar' || value < low
          ? 'above'
          : value > high
            ? 'below'
            : preferredSide(values[seriesIndex], index);
      placed.push({
        key: item.key,
        // Крайние подписи не выходят за границы графика.
        x: Math.min(width - 2 - textWidth / 2, Math.max(2 + textWidth / 2, x)),
        y: 0,
        text,
        pointY,
        side,
        priority: labelPriority(values[seriesIndex], incomplete, index),
      });
    });
    if (chartType === 'line') {
      // Близкие точки разных линий: верхняя подписывается сверху, нижняя снизу.
      placed.sort((a, b) => a.pointY - b.pointY);
      for (let i = 1; i < placed.length; i += 1) {
        if (placed[i].pointY - placed[i - 1].pointY < VALUE_LABEL_HEIGHT * 2) {
          placed[i - 1].side = 'above';
          placed[i].side = 'below';
        }
      }
    }
    const positioned = placed.map((label) => {
      const below =
        label.side === 'below' &&
        label.pointY + VALUE_LABEL_GAP + VALUE_LABEL_HEIGHT < baseline;
      return {
        ...label,
        y: below
          ? label.pointY + VALUE_LABEL_GAP + VALUE_LABEL_HEIGHT - 2
          : label.pointY - VALUE_LABEL_GAP,
      };
    });
    // Совпадающие точки разных линий подписываются один раз.
    const unique = positioned
      .filter(
        (label, labelIndex) =>
          !positioned.some(
            (other, otherIndex) =>
              otherIndex < labelIndex &&
              other.text === label.text &&
              Math.abs(other.pointY - label.pointY) < 1,
          ),
      )
      .sort((a, b) => a.y - b.y);
    // Подписи, которым не хватило места под точкой, раздвигаются вверх.
    for (let i = unique.length - 2; i >= 0; i -= 1) {
      unique[i].y = Math.min(unique[i].y, unique[i + 1].y - VALUE_LABEL_HEIGHT);
    }
    candidates.push(...unique);
  });
  // Когда точек много, подписи соседних периодов наезжают: остаются самые важные.
  const valueLabels: PlacedLabel[] = [];
  [...candidates]
    .sort((a, b) => a.priority - b.priority || a.x - b.x)
    .forEach((label) => {
      const labelWidth = label.text.length * VALUE_CHAR_WIDTH;
      const overlaps = valueLabels.some(
        (other) =>
          Math.abs(other.y - label.y) < VALUE_LABEL_HEIGHT &&
          Math.abs(other.x - label.x) <
            (labelWidth + other.text.length * VALUE_CHAR_WIDTH) / 2 + 4,
      );
      if (!overlaps) valueLabels.push(label);
    });

  /** Отрезки линии между соседними точками. К неполному периоду отрезок идет точками. */
  const segments = (seriesValues: Array<number | null>) =>
    seriesValues.flatMap((value, index) => {
      const next = seriesValues[index + 1];
      if (value === null || next === null || next === undefined) return [];
      return [
        {
          index,
          x1: center(index),
          y1: y(value),
          x2: center(index + 1),
          y2: y(next),
          isIncomplete: incomplete[index] || incomplete[index + 1],
        },
      ];
    });

  return (
    <div ref={containerRef}>
      <svg
        viewBox={`0 0 ${width} ${HEIGHT}`}
        width={width}
        height={HEIGHT}
        className='block max-w-full'
        role='img'
        aria-label={`${title}: ${series.map((item) => item.label).join(', ')}`}
        onMouseLeave={() => onHover(null)}
      >
        <line
          x1={PADDING.left}
          x2={width - PADDING.right}
          y1={baseline}
          y2={baseline}
          stroke='#d3dcec'
        />
        {hoveredIndex !== null ? (
          chartType === 'line' ? (
            <line
              x1={center(hoveredIndex)}
              x2={center(hoveredIndex)}
              y1={PADDING.top - PIN_OFFSET}
              y2={baseline}
              stroke='#c3cee3'
              strokeDasharray='3 3'
            />
          ) : (
            <rect
              x={center(hoveredIndex) - slot / 2}
              y={PADDING.top - PIN_OFFSET}
              width={slot}
              height={innerHeight + PIN_OFFSET}
              fill='#eef3fc'
            />
          )
        ) : null}

        {chartType === 'line'
          ? series.map((item, seriesIndex) => (
              <g key={item.key}>
                {segments(values[seriesIndex]).map((segment) => (
                  <line
                    key={segment.index}
                    x1={segment.x1}
                    y1={segment.y1}
                    x2={segment.x2}
                    y2={segment.y2}
                    stroke={item.color}
                    strokeWidth={2}
                    strokeLinecap='round'
                    strokeDasharray={
                      segment.isIncomplete ? '1 5' : item.dashed ? '6 4' : undefined
                    }
                    opacity={segment.isIncomplete ? 0.7 : 1}
                  />
                ))}
                {values[seriesIndex].map((value, index) =>
                  value === null ? null : (
                    <circle
                      key={buckets[index].key}
                      cx={center(index)}
                      cy={y(value)}
                      r={hoveredIndex === index ? 5 : 4}
                      // Неполный период - полая точка.
                      fill={incomplete[index] ? '#ffffff' : item.color}
                      stroke={incomplete[index] ? item.color : '#ffffff'}
                      strokeWidth={2}
                    />
                  ),
                )}
              </g>
            ))
          : buckets.map((bucket, index) => (
              <g key={bucket.key}>
                {series.map((item, seriesIndex) => {
                  const value = values[seriesIndex][index] ?? 0;
                  const height = baseline - y(value);
                  if (height <= 0) return null;
                  const x = center(index) - groupWidth / 2 + seriesIndex * (barWidth + 2);
                  const isDimmed = hoveredIndex !== null && hoveredIndex !== index;
                  return (
                    <path
                      key={item.key}
                      d={barPath(x, baseline - height, barWidth, height)}
                      fill={item.color}
                      // Неполный период - светлый столбец с пунктирным контуром.
                      fillOpacity={incomplete[index] ? 0.3 : 1}
                      stroke={incomplete[index] ? item.color : undefined}
                      strokeDasharray={incomplete[index] ? '3 3' : undefined}
                      opacity={isDimmed ? 0.55 : 1}
                    />
                  );
                })}
              </g>
            ))}

        {/* Над столбцами стоят подписи значений, линия компании их перечеркивала бы. */}
        {reference && chartType === 'line' ? (
          <g>
            {segments(reference).map((segment) => (
              <line
                key={segment.index}
                x1={segment.x1}
                y1={segment.y1}
                x2={segment.x2}
                y2={segment.y2}
                stroke={REFERENCE_COLOR}
                strokeWidth={1.5}
                strokeLinecap='round'
                strokeDasharray={segment.isIncomplete ? '1 5' : undefined}
              />
            ))}
          </g>
        ) : null}

        {valueLabels.map((label, index) => (
          <text
            key={`${label.key}-${index}`}
            x={label.x}
            y={label.y}
            textAnchor='middle'
            className='fill-[#3b4a68] text-[11px] font-medium'
            paintOrder='stroke'
            stroke='#ffffff'
            strokeWidth={4}
          >
            {label.text}
          </text>
        ))}

        {buckets.map((bucket, index) => (
          <g key={bucket.key}>
            {index % labelStep === 0 ? (
              <text
                x={center(index)}
                y={HEIGHT - 6}
                textAnchor='middle'
                className='fill-[#7e8fb4] text-[11px]'
              >
                {labels[index]}
              </text>
            ) : null}
            {/* Зона наведения - весь период, чтобы попадать в пустые периоды. */}
            <rect
              x={center(index) - slot / 2}
              y={0}
              width={slot}
              height={HEIGHT}
              fill='transparent'
              onMouseEnter={() => onHover(index)}
            />
          </g>
        ))}
      </svg>
    </div>
  );
});

function Swatch({ color, dashed = false }: { color: string; dashed?: boolean }) {
  return (
    <span
      className='inline-block h-0.5 w-3 shrink-0 rounded-full'
      style={{
        background: dashed
          ? `repeating-linear-gradient(90deg, ${color} 0 4px, transparent 4px 6px)`
          : color,
      }}
      aria-hidden='true'
    />
  );
}

function coverageNote(coverage: Coverage): string {
  if (coverage.days === 0) return 'Период еще не начался';
  return coverage.isOngoing
    ? 'Период еще не закончился'
    : `Неполный период: ${coverage.days} дн. из ${coverage.fullDays}`;
}

function Tooltip({
  bucket,
  coverage,
  point,
  companyPoint,
  isCompany,
  canViewFinance,
}: {
  bucket: ManagerReportBucket;
  coverage: Coverage | null;
  point: ManagerReportSeriesPoint | undefined;
  companyPoint: ManagerReportSeriesPoint | undefined;
  isCompany: boolean;
  canViewFinance: boolean;
}) {
  const row = (label: string, value: string, series?: Series) => (
    <div className='flex items-center gap-1.5'>
      {series ? (
        <Swatch color={series.color} dashed={series.dashed} />
      ) : (
        <span className='w-3 shrink-0' />
      )}
      <span>
        {label}: {value}
      </span>
    </div>
  );
  const hourCost = (series: Series) => {
    const key = series.key as
      | 'supervised_hour_cost'
      | 'total_hour_cost'
      | 'developer_hour_cost';
    const value = formatReportMoney(point?.[key]);
    return row(
      series.label,
      isCompany ? value : `${value} (компания ${formatReportMoney(companyPoint?.[key])})`,
      series,
    );
  };

  return (
    <div className='grid gap-0.5 rounded-lg border border-[#d3dcec] bg-white px-3 py-2 text-xs text-[#53617c] shadow-lg'>
      <div className='font-semibold text-[#1f3565]'>
        {bucket.label}{' '}
        <span className='font-normal text-[#7e8fb4]'>
          ({formatReportDate(bucket.from)} - {formatReportDate(bucket.to)})
        </span>
      </div>
      {coverage ? <div className='text-[#b45309]'>{coverageNote(coverage)}</div> : null}
      {row('Часы под контролем', formatReportHours(point?.supervised_seconds), SERIES[0])}
      {row('Часы разработчиков', formatReportHours(point?.developer_seconds), SERIES[1])}
      {row('Все часы проектов', formatReportHours(point?.total_seconds))}
      {canViewFinance ? (
        <>
          {row(
            isCompany ? 'Выплачено менеджерам' : 'Выплачено менеджеру',
            formatReportMoney(point?.manager_cost ?? 0),
          )}
          {hourCost(SERIES[2])}
          {hourCost(SERIES[3])}
          {hourCost(SERIES[4])}
        </>
      ) : null}
    </div>
  );
}

/** Шапка панели: значение показателя за весь период и то же по компании. */
function PanelHeader({
  panel,
  totals,
  companyTotals,
}: {
  panel: Panel;
  totals: ManagerReportMetrics;
  companyTotals?: ManagerReportMetrics;
}) {
  return (
    <div className='flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs'>
      <span className='font-semibold text-[#53617c]'>{panel.title}</span>
      <span className='flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[#7e8fb4]'>
        {panel.series.map((item) => (
          <span key={item.key} className='inline-flex items-center gap-1.5'>
            <Swatch color={item.color} dashed={item.dashed} />
            {panel.kind === 'hours' ? item.shortLabel : null}
            <span className='font-semibold text-[#1f3565]'>
              {formatValue(panel.kind, totals[item.key] ?? 0)}
            </span>
          </span>
        ))}
        {companyTotals && panel.kind === 'money' ? (
          <span className='inline-flex items-center gap-1.5'>
            <Swatch color={REFERENCE_COLOR} />
            компания {formatReportMoney(companyTotals[panel.series[0].key])}
          </span>
        ) : null}
      </span>
    </div>
  );
}

function ChartCard({
  title,
  totals,
  seriesPoints,
  company,
  buckets,
  coverage,
  granularity,
  chartType,
  series,
  canViewFinance,
}: {
  title: string;
  totals: ManagerReportMetrics;
  seriesPoints: ManagerReportSeriesPoint[];
  /** Показатели всей компании для сравнения. Не передаются в карточку самой компании. */
  company?: ManagerReportCompany;
  buckets: ManagerReportBucket[];
  coverage: Array<Coverage | null>;
  granularity: ManagerReportGranularity;
  chartType: ManagerReportChartType;
  series: Series[];
  canViewFinance: boolean;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [pointer, setPointer] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const isCompany = company === undefined;
  const points = useMemo(() => {
    const pointMap = new Map(seriesPoints.map((point) => [point.key, point]));
    // Период, который еще не начался, не рисуется: его нули выглядели бы провалом.
    return buckets.map((bucket, index) =>
      coverage[index]?.days === 0 ? undefined : pointMap.get(bucket.key),
    );
  }, [seriesPoints, buckets, coverage]);
  const companyPoints = useMemo(() => {
    const pointMap = new Map((company?.series ?? []).map((point) => [point.key, point]));
    return buckets.map((bucket, index) =>
      coverage[index]?.days === 0 ? undefined : pointMap.get(bucket.key),
    );
  }, [company, buckets, coverage]);
  const incomplete = useMemo(() => coverage.map((item) => item !== null), [coverage]);
  const panels = useMemo(
    () =>
      panelsOf(series).map((panel) => ({
        ...panel,
        reference:
          company && panel.kind === 'money'
            ? companyPoints.map((point) => point?.[panel.series[0].key] ?? null)
            : undefined,
      })),
    [series, company, companyPoints],
  );
  const hoveredBucket = hoveredIndex === null ? null : buckets[hoveredIndex];

  return (
    <article
      className={`@container relative grid content-start gap-3 rounded-xl border p-3 ${
        isCompany ? 'border-[#c9d7f3] bg-[#f8faff]' : 'border-[#e3e9f3] bg-white'
      }`}
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setPointer({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          width: rect.width,
          height: rect.height,
        });
      }}
    >
      <h3 className='truncate text-sm font-semibold text-[#1f3565]'>{title}</h3>
      {panels.length === 0 ? (
        <p className='text-xs text-[#7e8fb4]'>Включите хотя бы один показатель.</p>
      ) : (
        <div
          className={`grid gap-x-6 gap-y-4 ${panels.length > 1 ? '@3xl:grid-cols-2' : ''}`}
        >
          {panels.map((panel) => (
            <div key={panel.key} className='grid min-w-0 content-start gap-1'>
              <PanelHeader
                panel={panel}
                totals={totals}
                companyTotals={isCompany ? undefined : company}
              />
              <ReportChart
                title={panel.title}
                kind={panel.kind}
                series={panel.series}
                points={points}
                reference={panel.reference}
                buckets={buckets}
                incomplete={incomplete}
                granularity={granularity}
                chartType={chartType}
                hoveredIndex={hoveredIndex}
                onHover={setHoveredIndex}
              />
            </div>
          ))}
        </div>
      )}
      {/* Подсказка идет за курсором и не занимает места в карточке. У правого и нижнего
          края она переворачивается, чтобы не уходить под прокрутку отчёта. */}
      {hoveredBucket && hoveredIndex !== null && pointer ? (
        <div
          className='pointer-events-none absolute z-10'
          style={{
            width: Math.min(TOOLTIP_WIDTH, pointer.width - 16),
            left: Math.max(
              8,
              pointer.x + TOOLTIP_OFFSET + TOOLTIP_WIDTH > pointer.width - 8
                ? pointer.x - TOOLTIP_OFFSET - TOOLTIP_WIDTH
                : pointer.x + TOOLTIP_OFFSET,
            ),
            ...(pointer.y > pointer.height * 0.55
              ? { bottom: pointer.height - pointer.y + TOOLTIP_OFFSET }
              : { top: pointer.y + TOOLTIP_OFFSET }),
          }}
        >
          <Tooltip
            bucket={hoveredBucket}
            coverage={coverage[hoveredIndex]}
            point={points[hoveredIndex]}
            companyPoint={companyPoints[hoveredIndex]}
            isCompany={isCompany}
            canViewFinance={canViewFinance}
          />
        </div>
      ) : null}
    </article>
  );
}

const segmentButton = (isActive: boolean) =>
  `px-3 py-1.5 text-xs font-semibold transition-colors ${
    isActive ? 'bg-[#2d6ff7] text-white' : 'text-[#53617c] hover:bg-[#eef3fc]'
  }`;

/** Графическое представление: карточка на менеджера в строку и итоговая строка "Компания". */
export default function ManagerReportCharts({
  managers,
  company,
  buckets,
  granularity,
  canViewFinance,
}: {
  managers: ManagerReportManagerRow[];
  company: ManagerReportCompany;
  buckets: ManagerReportBucket[];
  granularity: ManagerReportGranularity;
  canViewFinance: boolean;
}) {
  // Столбцы оставлены для сравнения с ломаной.
  const [chartType, setChartType] = useState<ManagerReportChartType>('line');
  const [hiddenKeys, setHiddenKeys] = useState<Set<SeriesKey>>(() => new Set());
  const visible = useMemo(
    () =>
      SERIES.filter(
        (item) => (canViewFinance || item.kind === 'hours') && !hiddenKeys.has(item.key),
      ),
    [canViewFinance, hiddenKeys],
  );
  const available = SERIES.filter((item) => canViewFinance || item.kind === 'hours');
  const coverage = useMemo(() => {
    const today = parseDay(formatInputDate(new Date()));
    return buckets.map((bucket) => bucketCoverage(bucket, granularity, today));
  }, [buckets, granularity]);
  const hasIncomplete = coverage.some((item) => item !== null);

  const toggleSeries = (key: SeriesKey) =>
    setHiddenKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (buckets.length === 0) return null;

  return (
    <div className='grid gap-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div
          className='flex flex-wrap gap-1.5'
          role='group'
          aria-label='Показатели на графиках'
        >
          {available.map((item) => {
            const isOn = !hiddenKeys.has(item.key);
            return (
              <button
                key={item.key}
                type='button'
                aria-pressed={isOn}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  isOn
                    ? 'border-[#c9d7f3] bg-white text-[#1f3565]'
                    : 'border-[#e3e9f3] bg-[#f5f7fb] text-[#9aa8c4] line-through'
                }`}
                onClick={() => toggleSeries(item.key)}
              >
                <Swatch color={isOn ? item.color : '#c3cee3'} dashed={item.dashed} />
                {item.label}
              </button>
            );
          })}
        </div>
        <div
          className='flex overflow-hidden rounded-lg border border-[#d3dcec] bg-white'
          role='group'
          aria-label='Вид графика'
        >
          <button
            type='button'
            aria-pressed={chartType === 'line'}
            className={segmentButton(chartType === 'line')}
            onClick={() => setChartType('line')}
          >
            Линия
          </button>
          <button
            type='button'
            aria-pressed={chartType === 'bar'}
            className={segmentButton(chartType === 'bar')}
            onClick={() => setChartType('bar')}
          >
            Столбцы
          </button>
        </div>
      </div>
      {hasIncomplete ? (
        <p className='flex items-center gap-1.5 text-xs text-[#7e8fb4]'>
          <span
            className='inline-block size-2 shrink-0 rounded-full border-2 border-[#7e8fb4] bg-white'
            aria-hidden='true'
          />
          Неполный период: обрезан границей отчёта или еще идет. На масштаб графика не
          влияет.
        </p>
      ) : null}

      {managers.length === 0 ? (
        <div className='py-8 text-center text-sm text-[#7e8fb4]'>
          Нет данных за выбранный период
        </div>
      ) : (
        managers.map((row) => (
          <ChartCard
            key={row.manager.id}
            title={row.manager.name}
            totals={row}
            seriesPoints={row.series}
            company={company}
            buckets={buckets}
            coverage={coverage}
            granularity={granularity}
            chartType={chartType}
            series={visible}
            canViewFinance={canViewFinance}
          />
        ))
      )}
      <ChartCard
        title='Компания'
        totals={company}
        seriesPoints={company.series}
        buckets={buckets}
        coverage={coverage}
        granularity={granularity}
        chartType={chartType}
        series={visible}
        canViewFinance={canViewFinance}
      />
    </div>
  );
}
