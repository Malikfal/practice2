import type { EmployeeRate, EmployeeRateType } from '../../../../../../../types/app';
import { HintToolTip } from '../../../../../../ui/HintTooltip';

import { formatMoney, getRateSetting, pluralProjects } from './payrollUtils';

/** Подпись "+ N проект отдельно" под ставкой; по наведению или нажатию показывает проекты и ставки. */
export function ProjectRatesNote({
  rate,
  rateType,
  className,
}: {
  rate: EmployeeRate | null | undefined;
  rateType: EmployeeRateType;
  className?: string;
}) {
  const projectRates =
    rateType === 'WEEKLY_SALARY'
      ? []
      : (getRateSetting(rate, rateType)?.project_rates ?? []);

  if (!projectRates.length) return null;

  return (
    <HintToolTip
      className={className}
      trigger={`+ ${pluralProjects(projectRates.length)} отдельно`}
      triggerClassName='text-left text-[11px] font-semibold text-[#2d6ff7] underline decoration-dotted underline-offset-2 transition-colors hover:text-[#245fd8] sm:text-[12px]'
      content={
        <div className='grid gap-1'>
          <p className='text-[11px] text-[#7e8fb4]'>Отдельная ставка по проектам</p>
          {projectRates.map((projectRate) => (
            <div key={projectRate.project_id} className='flex justify-between gap-4'>
              <span className='min-w-0 break-words'>
                {projectRate.project_name || 'Проект не найден'}
              </span>
              <span className='shrink-0 text-[#10275a]'>
                {formatMoney(projectRate.rate)}
              </span>
            </div>
          ))}
        </div>
      }
    />
  );
}
