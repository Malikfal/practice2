import type {
  EmployeeDayTimelineForm,
  TimelineSegment,
  User,
} from '../../../../../../../types/app';
import type { ReactNode } from 'react';

import DayTimelineFilters from './DayTimelineFilters';
import DayTimelineGraph from './DayTimelineGraph';
import DayTimelineSummary from './DayTimelineSummary';
import DayTimelineTables from './DayTimelineTables';

type Props = {
  form: EmployeeDayTimelineForm;
  employees: User[];
  totalSeconds: number;
  segments: TimelineSegment[];
  dayStartIso: string;
  dayEndIso: string;
  onFormChange: (_next: EmployeeDayTimelineForm) => void;
  isLoading?: boolean;
  canSelectEmployee?: boolean;
  canViewSegmentDetails?: boolean;
  rightAction?: ReactNode;
  onSegmentClick?: (_segment: TimelineSegment) => void;
};

export default function EmployeeDayTimelineCard({
  form,
  employees,
  totalSeconds,
  segments,
  dayStartIso,
  dayEndIso,
  onFormChange,
  isLoading = false,
  canSelectEmployee = true,
  canViewSegmentDetails = false,
  rightAction,
  onSegmentClick,
}: Props) {
  return (
    <section className='grid h-full min-h-0 min-w-0 content-start gap-3 overflow-auto rounded-xl border border-[#e3e9f3] bg-white p-2 sm:p-3'>
      <DayTimelineFilters
        form={form}
        employees={employees}
        isLoading={isLoading}
        canSelectEmployee={canSelectEmployee}
        rightAction={rightAction}
        onFormChange={onFormChange}
      />

      <DayTimelineSummary
        totalSeconds={totalSeconds}
        segments={segments}
        dayStartIso={dayStartIso}
        dayEndIso={dayEndIso}
      />

      <section className='grid min-w-0 content-start gap-3 rounded-xl border border-[#e3e9f3] bg-[#fbfcff] p-2 sm:p-3'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <h2 className='text-[18px] font-semibold text-[#10275a]'>
            Рабочий день по часам
          </h2>
          <div className='grid justify-items-end gap-0.5'>
            <p className='text-[13px] text-[#7e8fb4]'>
              1 строка, 1 день, разметка по 24 часам
            </p>
            <p className='text-[12px] text-[#2d6ff7]'>
              Нажмите на сегмент, чтобы перенести часть времени.
            </p>
          </div>
        </div>

        <DayTimelineGraph
          segments={segments}
          dayStartIso={dayStartIso}
          dayEndIso={dayEndIso}
          canViewSegmentDetails={canViewSegmentDetails}
          onSegmentClick={onSegmentClick}
        />
      </section>

      <DayTimelineTables
        segments={segments}
        canViewSegmentDetails={canViewSegmentDetails}
        onSegmentClick={onSegmentClick}
      />
    </section>
  );
}
