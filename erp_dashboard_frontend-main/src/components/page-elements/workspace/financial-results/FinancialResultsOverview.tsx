import { useMemo } from 'react';

import type { FinancialResultsOverview as Overview } from '../../../../types/financialResults';
import {
  formatAnalyticsMoney,
  formatAnalyticsNumber,
  getProfitTone,
} from '../finance-analytics/financeAnalyticsUtils';

const series = [
  { key: 'income' as const, label: 'Поступления', color: '#5b9bf7' },
  { key: 'expenses' as const, label: 'Расходы', color: '#ef625b' },
  { key: 'profit' as const, label: 'Прибыль / убыток', color: '#20b85a' },
];
const emptyHistogram: Overview['histogram'] = [];

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
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
    </div>
  );
}

export default function FinancialResultsOverview({ data }: { data: Overview }) {
  const histogram = data.histogram ?? emptyHistogram;
  const summary = data.summary ?? { income: 0, expenses: 0, profit: 0 };
  const profitTone = getProfitTone(summary.profit);
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
    return {
      width,
      height,
      left,
      right,
      y,
      baseline: y(0),
      groupWidth: innerWidth / Math.max(histogram.length, 1),
      barWidth: Math.min(16, Math.max(4, innerWidth / Math.max(histogram.length, 1) / 5)),
      min,
      max,
    };
  }, [histogram]);
  const labelStep = Math.max(1, Math.ceil(histogram.length / 7));

  return (
    <div className='grid min-w-0 gap-3 lg:grid-cols-[158px_minmax(0,1fr)]'>
      <div className='grid gap-3 sm:grid-cols-3 lg:grid-cols-1'>
        <SummaryCard label='Поступления' value={summary.income} color='#5b9bf7' />
        <SummaryCard label='Расходы' value={summary.expenses} color='#ef625b' />
        <SummaryCard
          label={profitTone.label}
          value={summary.profit}
          color={profitTone.color}
        />
      </div>
      <section className='min-w-0 overflow-hidden rounded-xl border border-[#e3e9f3] bg-white p-3 shadow-sm shadow-slate-900/3 md:p-4'>
        <h2 className='text-sm font-semibold text-[#27324b]'>Финансовый результат, ₽</h2>
        <p className='mt-1 text-[11px] text-[#7e8fb4]'>
          По фактическим датам движения денег
        </p>
        {histogram.length === 0 ? (
          <div className='grid h-64 place-items-center text-sm text-[#7e8fb4]'>
            Нет данных за выбранный период
          </div>
        ) : (
          <div className='overflow-x-auto'>
            <svg
              viewBox={`0 0 ${chart.width} ${chart.height}`}
              className='min-w-160 w-full'
              role='img'
              aria-label='График финансовых результатов'
            >
              {[chart.max, (chart.max + chart.min) / 2, chart.min].map((tick, index) => (
                <g key={`${tick}-${index}`}>
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
                const center =
                  chart.left + chart.groupWidth * index + chart.groupWidth / 2;
                return (
                  <g key={`${item.date}-${index}`}>
                    {series.map((itemSeries, seriesIndex) => {
                      const value = item[itemSeries.key];
                      const color =
                        itemSeries.key === 'profit'
                          ? getProfitTone(value).color
                          : itemSeries.color;
                      const valueY = chart.y(value);
                      const x =
                        center +
                        (seriesIndex - 1) * (chart.barWidth + 2) -
                        chart.barWidth / 2;
                      return (
                        <rect
                          key={itemSeries.key}
                          x={x}
                          y={Math.min(valueY, chart.baseline)}
                          width={chart.barWidth}
                          height={Math.max(1, Math.abs(chart.baseline - valueY))}
                          rx='3'
                          fill={color}
                        >
                          <title>{`${item.label}: ${formatAnalyticsMoney(value)}`}</title>
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
        )}
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
      </section>
    </div>
  );
}
