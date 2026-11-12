import type { AbsenceSummary } from './types';
import { SummaryCard } from './AbsenceSharedUi';

export function AbsencesSummary({ summary }: { summary: AbsenceSummary }) {
  return (
    <div className='grid grid-cols-2 gap-2 md:grid-cols-5 md:gap-3'>
      <SummaryCard label='Использовано' value={summary.total} />
      <SummaryCard label='Отпуск' value={summary.VACATION} markerClass='bg-[#2d6ff7]' />
      <SummaryCard label='Отгул' value={summary.DAY_OFF} markerClass='bg-[#f59f25]' />
      <SummaryCard
        label='Больничный'
        value={summary.SICK_LEAVE}
        markerClass='bg-[#42b85b]'
      />
      <SummaryCard label='Выходной' value={summary.WEEKEND} markerClass='bg-[#7e8fb4]' />
    </div>
  );
}
