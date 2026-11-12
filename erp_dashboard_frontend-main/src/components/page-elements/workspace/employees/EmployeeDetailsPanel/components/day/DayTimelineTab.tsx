import { useState } from 'react';

import Button from '../../../../../../ui/Button';
import { useAppControllerContext } from '../../../../../../../context/AppControllerContext';
import type { User } from '../../../../../../../types/app';
import { formatName } from '../../../../../../../utils/formatters';

import DailyTimelinePanel from './DailyTimelinePanel';
import ManualTimePanel from './ManualTimePanel';

type Props = {
  employee: User;
  initialDate?: string;
};

export default function DayTimelineTab({ employee, initialDate }: Props) {
  const { user } = useAppControllerContext();
  const permissionNames = user?.permissions ?? [];
  const canAddManualTime =
    permissionNames.includes('time.add_for_others') ||
    permissionNames.includes('time.add_for_project_users') ||
    permissionNames.includes('time.add_for_all');
  const [isManualTimeModalOpen, setIsManualTimeModalOpen] = useState(false);
  const [timelineRefreshToken, setTimelineRefreshToken] = useState(0);

  const handleManualTimeSuccess = () => {
    setIsManualTimeModalOpen(false);
    setTimelineRefreshToken((current) => current + 1);
  };

  return (
    <>
      <div className='grid h-full min-h-0 min-w-0 content-start gap-3'>
        <DailyTimelinePanel
          employee={employee}
          canSelectEmployee={false}
          refreshToken={timelineRefreshToken}
          initialDate={initialDate}
          rightAction={
            canAddManualTime ? (
              <Button
                type='button'
                variant='secondary'
                className='min-h-11 w-full rounded-xl border-transparent! bg-[#2d6ff7]! px-4 text-[13px] font-semibold text-white! shadow-sm shadow-[#2d6ff7]/25 hover:bg-[#245fd8]! sm:h-10 sm:min-h-0 sm:w-auto'
                onClick={() => setIsManualTimeModalOpen(true)}
              >
                + Добавить время вручную
              </Button>
            ) : null
          }
        />
      </div>

      {isManualTimeModalOpen && canAddManualTime ? (
        <div
          className='fixed inset-0 z-1000 grid place-items-center bg-slate-900/40 p-2 sm:p-4'
          onClick={() => setIsManualTimeModalOpen(false)}
        >
          <div
            className='max-h-[calc(100dvh-1rem)] w-full max-w-4xl overflow-auto rounded-xl border border-[#e3e9f3] bg-white p-3 shadow-2xl shadow-slate-900/20 sm:max-h-[90vh] sm:rounded-2xl sm:p-4'
            onClick={(event) => event.stopPropagation()}
          >
            <div className='mb-3 flex items-center justify-between gap-3 border-b border-[#e3e9f3] pb-3'>
              <div>
                <h2 className='text-[18px] font-semibold text-[#10275a]'>
                  Добавить время вручную
                </h2>
                <p className='mt-1 text-[13px] text-[#7e8fb4]'>{formatName(employee)}</p>
              </div>
              <Button
                type='button'
                variant='secondary'
                size='sm'
                className='h-9 rounded-xl border-[#e3e9f3] bg-white px-3 text-[12px] font-semibold text-[#1f3565] hover:bg-[#f3f7ff]'
                onClick={() => setIsManualTimeModalOpen(false)}
              >
                Закрыть
              </Button>
            </div>
            <ManualTimePanel
              employee={employee}
              embedded
              onSuccess={handleManualTimeSuccess}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
