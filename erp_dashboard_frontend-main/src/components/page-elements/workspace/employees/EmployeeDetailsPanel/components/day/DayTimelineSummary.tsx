import type { TimelineSegment } from '../../../../../../../types/app';
import {
  formatDurationHms,
  formatTimeLocal,
} from '../../../../../../../utils/formatters';

type Props = {
  totalSeconds: number;
  segments: TimelineSegment[];
  dayStartIso: string;
  dayEndIso: string;
};

export default function DayTimelineSummary({
  totalSeconds,
  segments,
  dayStartIso,
  dayEndIso,
}: Props) {
  return (
    <div className='grid content-start gap-3 sm:grid-cols-3'>
      <div className='rounded-xl border border-[#e3e9f3] bg-[#fbfcff] px-3 py-2'>
        <p className='text-[12px] font-semibold tracking-[0.04em] text-[#1f3565] uppercase'>
          Отработано
        </p>
        <p className='mt-0.5 text-[18px] leading-tight font-semibold text-[#10275a]'>
          {formatDurationHms(totalSeconds)}
        </p>
      </div>
      <div className='rounded-xl border border-[#e3e9f3] bg-[#fbfcff] px-3 py-2'>
        <p className='text-[12px] font-semibold tracking-[0.04em] text-[#1f3565] uppercase'>
          Сегментов
        </p>
        <p className='mt-0.5 text-[18px] leading-tight font-semibold text-[#10275a]'>
          {segments.length}
        </p>
      </div>
      <div className='rounded-xl border border-[#e3e9f3] bg-[#fbfcff] px-3 py-2'>
        <p className='text-[12px] font-semibold tracking-[0.04em] text-[#1f3565] uppercase'>
          Период дня
        </p>
        <p className='mt-0.5 text-[18px] leading-tight font-semibold text-[#10275a]'>
          {formatTimeLocal(dayStartIso)} - {formatTimeLocal(dayEndIso)}
        </p>
      </div>
    </div>
  );
}
