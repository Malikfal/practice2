import { useLocation, useNavigate } from 'react-router';

import type { Client, Project } from '../../../../../types/app';
import SectionHeader from '../../../../ui/SectionHeader';
import PayrollAnalyticsPanel from './PayrollAnalyticsPanel';
import PayrollDebtPanel from './payouts/PayrollDebtPanel';
import PayrollPayoutsReportPanel from './payouts/PayrollPayoutsReportPanel';
import PayrollSheetPanel from './payouts/PayrollSheetPanel';
import PayrollSummaryPanel from './summary/PayrollSummaryPanel';

type PayrollTab = 'periods' | 'employees' | 'analytics' | 'sheet' | 'debt' | 'payouts';
export type PayrollGroup = 'calculation' | 'payout';

// Параметры расчёта по периодам, общие для вкладок по периодам и по сотрудникам.
const SUMMARY_PARAMS = ['payroll_from', 'payroll_to', 'payroll_group'];
// Сотрудник, чью строку ведомости нужно раскрыть после перехода из задолженности или выплат.
const FOCUS_EMPLOYEE_PARAM = 'payroll_employee';

// Пункты меню «Оплаты труда» и их вкладки. Первая вкладка открывается по умолчанию.
const PAYROLL_GROUPS: Record<
  PayrollGroup,
  { title: string; description: string; tabs: Array<[PayrollTab, string]> }
> = {
  calculation: {
    title: 'Расчёт ФОТ',
    description:
      'Сколько начислено сотрудникам: общий расчёт за период, по периодам и по сотрудникам.',
    tabs: [
      ['analytics', 'Общий расчёт'],
      ['periods', 'Расчёт по периодам'],
      ['employees', 'Расчёт по сотрудникам'],
    ],
  },
  payout: {
    title: 'Выплата ФОТ',
    description: 'Ведомость за месяц, задолженность перед сотрудниками и история выплат.',
    tabs: [
      ['sheet', 'Ведомость'],
      ['debt', 'Задолженность'],
      ['payouts', 'Выплаты'],
    ],
  },
};

export default function CompanyPayrollPanel({
  group,
  projects,
  clients,
  isLoadingOptions,
  canManagePayouts,
}: {
  group: PayrollGroup;
  projects: Project[];
  clients: Client[];
  isLoadingOptions: boolean;
  canManagePayouts: boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { title, description, tabs } = PAYROLL_GROUPS[group];
  const defaultTab = tabs[0][0];
  const searchParams = new URLSearchParams(location.search);
  const tabParam = searchParams.get('tab');
  const activeTab: PayrollTab =
    tabs.find(([value]) => value === tabParam)?.[0] ?? defaultTab;
  const monthParam = searchParams.get('payroll_month');
  const sheetMonth =
    monthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam) ? monthParam : null;
  const focusEmployeeId = searchParams.get(FOCUS_EMPLOYEE_PARAM);

  // Адрес вкладки: ссылки открываются и обычным кликом, и в новой вкладке.
  const tabHref = (tab: PayrollTab, month?: string, employeeId?: string) => {
    const nextParams = new URLSearchParams(location.search);
    if (group === 'calculation') nextParams.delete('view');
    else nextParams.set('view', group);
    if (tab === defaultTab) nextParams.delete('tab');
    else nextParams.set('tab', tab);
    if (tab === 'sheet' && month) nextParams.set('payroll_month', month);
    else if (tab !== 'sheet') nextParams.delete('payroll_month');
    if (employeeId) nextParams.set(FOCUS_EMPLOYEE_PARAM, employeeId);
    else nextParams.delete(FOCUS_EMPLOYEE_PARAM);
    if (tab !== 'periods' && tab !== 'employees') {
      SUMMARY_PARAMS.forEach((param) => nextParams.delete(param));
    }
    const nextSearch = nextParams.toString();
    return `${location.pathname}${nextSearch ? `?${nextSearch}` : ''}`;
  };

  const monthHref = (month: string, employeeId: string) =>
    tabHref('sheet', month, employeeId);

  return (
    <section className='flex min-h-0 min-w-0 flex-col overflow-visible rounded-xl border border-[#e3e9f3] bg-white text-[#1f3565] lg:h-full lg:overflow-hidden'>
      <SectionHeader
        overline='Оплата труда'
        title={title}
        description={description}
        tabs={tabs.map(([value, label]) => ({ key: value, label, to: tabHref(value) }))}
        activeTab={activeTab}
        replace
      />

      <div className='min-h-0 flex-1 overflow-visible bg-[#f3f6fb] p-2 md:p-3 lg:overflow-auto'>
        <div className='mx-auto grid min-w-0 max-w-380 gap-3'>
          {activeTab === 'periods' || activeTab === 'employees' ? (
            // Один экземпляр на обе вкладки: при переключении данные не перезагружаются.
            <PayrollSummaryPanel mode={activeTab} />
          ) : activeTab === 'sheet' ? (
            <PayrollSheetPanel
              canManage={canManagePayouts}
              month={sheetMonth}
              focusEmployeeId={focusEmployeeId}
              onMonthChange={(month) =>
                navigate(tabHref('sheet', month), { replace: true })
              }
            />
          ) : activeTab === 'debt' ? (
            <PayrollDebtPanel canManage={canManagePayouts} monthHref={monthHref} />
          ) : activeTab === 'payouts' ? (
            <PayrollPayoutsReportPanel
              canManage={canManagePayouts}
              monthHref={monthHref}
            />
          ) : (
            <PayrollAnalyticsPanel
              projects={projects}
              clients={clients}
              isLoadingOptions={isLoadingOptions}
            />
          )}
        </div>
      </div>
    </section>
  );
}
