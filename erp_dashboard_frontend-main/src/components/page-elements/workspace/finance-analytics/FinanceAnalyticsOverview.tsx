import { useMemo, useState } from 'react';

import type { FinanceAnalyticsOverview } from '../../../../types/financeAnalytics';
import {
  formatAnalyticsMoney,
  formatAnalyticsNumber,
  getProfitTone,
} from './financeAnalyticsUtils';

type HistogramSeries = {
  color: string;
  key: 'income' | 'actual_expenses' | 'planned_expenses' | 'profit';
  label: string;
};

const emptyHistogram: FinanceAnalyticsOverview['histogram'] = [];

function SummaryCard({
  label,
  value,
  color,
  details = [],
}: {
  label: string;
  value: number;
  color: string;
  details?: Array<{ label: string; value: number; color: string }>;
}) {
  return (
    <div className='min-w-0 rounded-xl border border-[#e3e9f3] bg-white p-4 shadow-sm shadow-slate-900/3'>
      <div className='flex min-w-0 items-start gap-2 text-xs text-[#7e8fb4]'>
        <span
          className='mt-0.5 size-2 shrink-0 rounded-sm'
          style={{ backgroundColor: color }}
        />
        <span className='min-w-0 [overflow-wrap:anywhere]'>{label}, ₽</span>
      </div>
      <div className='mt-2 min-w-0 text-xl font-semibold text-[#27324b] [overflow-wrap:anywhere]'>
        {formatAnalyticsNumber(value)}
      </div>
      {details.length > 0 ? (
        <div className='mt-2 grid gap-1 border-t border-[#edf1f6] pt-2'>
          {details.map((detail) => (
            <div
              key={detail.label}
              className='flex min-w-0 flex-wrap items-start justify-between gap-x-2 gap-y-0.5 text-[10px] text-[#7e8fb4]'
            >
              <span className='flex min-w-0 flex-1 basis-20 items-start gap-1.5'>
                <span
                  className='mt-0.5 size-1.5 shrink-0 rounded-full'
                  style={{ backgroundColor: detail.color }}
                />
                <span className='min-w-0 [overflow-wrap:anywhere]'>{detail.label}</span>
              </span>
              <span className='ml-auto max-w-full text-right font-medium text-[#53617c] [overflow-wrap:anywhere]'>
                {formatAnalyticsNumber(detail.value)}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Histogram({
  data,
  series,
}: {
  data: FinanceAnalyticsOverview['histogram'];
  series: HistogramSeries[];
}) {
  const histogram = Array.isArray(data) ? data : emptyHistogram;
  const chart = useMemo(() => {
    const width = 900;
    const height = 260;
    const left = 70;
    const right = 24;
    const top = 24;
    const bottom = 54;
    const innerWidth = width - left - right;
    const innerHeight = height - top - bottom;
    const values = histogram.flatMap((item) =>
      series.map((itemSeries) => item[itemSeries.key]),
    );
    const min = Math.min(0, ...values);
    const max = Math.max(0, ...values);
    const span = max - min || 1;
    const y = (value: number) => top + ((max - value) / span) * innerHeight;
    const baseline = y(0);
    const groupWidth = innerWidth / Math.max(histogram.length, 1);
    const barWidth = Math.min(14, Math.max(4, groupWidth / 6));

    return { width, height, left, right, top, bottom, y, baseline, groupWidth, barWidth };
  }, [histogram, series]);

  if (histogram.length === 0) {
    return (
      <div className='grid h-64 place-items-center text-sm text-[#7e8fb4]'>
        Нет данных за выбранный период
      </div>
    );
  }

  const tickValues = [0, 0.5, 1].map((ratio) => {
    const values = histogram.flatMap((item) =>
      series.map((itemSeries) => item[itemSeries.key]),
    );
    const min = Math.min(0, ...values);
    const max = Math.max(0, ...values);
    return max - (max - min) * ratio;
  });
  const labelStep = Math.max(1, Math.ceil(histogram.length / 7));

  return (
    <div className='overflow-x-auto'>
      <svg
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        className='min-w-160 w-full'
        role='img'
        aria-label='Финансовая статистика по дням'
      >
        {tickValues.map((tick, index) => (
          <g key={`tick-${index}-${tick}`}>
            <line
              x1={chart.left}
              x2={chart.width - chart.right}
              y1={chart.y(tick)}
              y2={chart.y(tick)}
              stroke='#e7ecf4'
            />
            <text
              x={chart.left - 10}
              y={chart.y(tick) + 4}
              textAnchor='end'
              className='fill-[#7e8fb4] text-[10px]'
            >
              {formatAnalyticsNumber(tick)}
            </text>
          </g>
        ))}

        {histogram.map((item, index) => {
          const center = chart.left + chart.groupWidth * index + chart.groupWidth / 2;
          return (
            <g key={item.date}>
              {series.map((itemSeries, seriesIndex) => {
                const value = item[itemSeries.key];
                const itemTone =
                  itemSeries.key === 'profit' ? getProfitTone(value) : itemSeries;
                const valueY = chart.y(value);
                const x =
                  center +
                  (seriesIndex - (series.length - 1) / 2) * (chart.barWidth + 2) -
                  chart.barWidth / 2;
                return (
                  <rect
                    key={itemSeries.key}
                    x={x}
                    y={Math.min(valueY, chart.baseline)}
                    width={chart.barWidth}
                    height={Math.max(1, Math.abs(chart.baseline - valueY))}
                    rx='3'
                    fill={itemTone.color}
                  >
                    <title>{`${item.label}: ${itemTone.label} ${formatAnalyticsMoney(value)}`}</title>
                  </rect>
                );
              })}
              {index % labelStep === 0 || index === histogram.length - 1 ? (
                <text
                  x={center}
                  y={chart.height - 22}
                  textAnchor='middle'
                  className='fill-[#7e8fb4] text-[10px]'
                >
                  {item.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function FinanceAnalyticsOverviewBlock({
  data,
  onOpenFinance,
  openingFinanceId,
}: {
  data: FinanceAnalyticsOverview;
  onOpenFinance?: (_financeId: string) => void;
  openingFinanceId?: string | null;
}) {
  const [areWarningsExpanded, setAreWarningsExpanded] = useState(false);
  const summary = data.summary ?? {
    income: 0,
    actual_expenses: 0,
    planned_expenses: 0,
    company_planned_expenses: 0,
    planned_expenses_included: true,
    expenses: 0,
    profit: 0,
  };
  const distributionWarnings = data.distribution_warnings ?? [];
  const visibleDistributionWarnings = areWarningsExpanded
    ? distributionWarnings
    : distributionWarnings.slice(0, 5);
  const plannedDetail = summary.planned_expenses_included
    ? {
        label: 'Планируемые',
        value: summary.planned_expenses,
        color: '#f3b347',
      }
    : {
        label: 'План компании (не включён)',
        value: summary.company_planned_expenses,
        color: '#f3b347',
      };
  const profitTone = getProfitTone(summary.profit);
  const series: HistogramSeries[] = useMemo(
    () => [
      { key: 'income', label: 'Поступления', color: '#8bb9f9' },
      { key: 'actual_expenses', label: 'Фактические расходы', color: '#ff9791' },
      { key: 'planned_expenses', label: 'Планируемые расходы', color: '#f3b347' },
      { key: 'profit', label: profitTone.label, color: profitTone.color },
    ],
    [profitTone],
  );

  return (
    <div className='grid min-w-0 gap-3 lg:grid-cols-[158px_minmax(0,1fr)]'>
      <div className='grid min-w-0 gap-3 sm:grid-cols-3 lg:grid-cols-1'>
        <SummaryCard label='Поступления' value={summary.income} color='#8bb9f9' />
        <SummaryCard
          label='Расходы'
          value={summary.expenses}
          color='#ef625b'
          details={[
            { label: 'Фактические', value: summary.actual_expenses, color: '#ef625b' },
            plannedDetail,
          ]}
        />
        <SummaryCard
          label={profitTone.label}
          value={summary.profit}
          color={profitTone.color}
        />
      </div>

      <section className='min-w-0 overflow-hidden rounded-xl border border-[#e3e9f3] bg-white p-3 shadow-sm shadow-slate-900/3 md:p-4'>
        <h2 className='text-sm font-semibold text-[#27324b]'>Финансовая статистика, ₽</h2>
        <p className='mt-1 text-[11px] text-[#7e8fb4]'>За выбранный период</p>
        <Histogram data={data.histogram ?? []} series={series} />
        <div className='flex flex-wrap gap-3 border-t border-[#edf1f6] pt-3 md:gap-6'>
          {series.map((item) => (
            <div
              key={item.key}
              className='flex items-center gap-2 text-xs text-[#66728d]'
            >
              <span
                className='size-2 rounded-full'
                style={{ backgroundColor: item.color }}
              />
              {item.label}
            </div>
          ))}
        </div>
        {!summary.planned_expenses_included && summary.company_planned_expenses > 0 ? (
          <div className='mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900'>
            План компании {formatAnalyticsMoney(summary.company_planned_expenses)} не
            включён в расходы и прибыль выбранного проекта, клиента или менеджера.
          </div>
        ) : null}
        {distributionWarnings.length > 0 ? (
          <div className='mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900'>
            <div className='font-semibold'>
              Для {distributionWarnings.length} платежей не найдена база распределения.
              Применено распределение по сроку.
            </div>
            <ul className='mt-1 grid gap-1'>
              {visibleDistributionWarnings.map((warning) => (
                <li
                  key={warning.finance_id}
                  className='flex items-start justify-between gap-3'
                >
                  <span className='min-w-0'>
                    {warning.article_name ?? 'Без статьи'}:{' '}
                    {warning.reason === 'NO_WORK_HOURS'
                      ? 'нет учтённых часов в периоде'
                      : 'нет подходящих расходов в периоде'}
                  </span>
                  {onOpenFinance ? (
                    <button
                      type='button'
                      className='shrink-0 font-medium text-[#2d6ff7] underline-offset-2 hover:underline disabled:cursor-wait disabled:opacity-60'
                      disabled={openingFinanceId === warning.finance_id}
                      onClick={() => onOpenFinance(warning.finance_id)}
                    >
                      {openingFinanceId === warning.finance_id
                        ? 'Загрузка...'
                        : 'Показать'}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
            {distributionWarnings.length > 5 ? (
              <button
                type='button'
                className='mt-1 font-medium text-amber-950 underline-offset-2 hover:underline'
                onClick={() => setAreWarningsExpanded((current) => !current)}
              >
                {areWarningsExpanded
                  ? 'Скрыть'
                  : `Показать все (${distributionWarnings.length})`}
              </button>
            ) : null}
            <p className='mt-1.5'>
              Добавьте базовые данные за период или выберите для статьи способ «По сроку».
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
