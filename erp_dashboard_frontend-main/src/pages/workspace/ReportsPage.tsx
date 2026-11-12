import { useMemo, type JSX } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import HoursChartReportsView from '../../components/page-elements/workspace/reports/views/HoursChartReportsView';
import LimitReportsView from '../../components/page-elements/workspace/reports/views/LimitReportsView';
import ManagerReportsView from '../../components/page-elements/workspace/reports/views/ManagerReportsView';
import OverrunReportsView from '../../components/page-elements/workspace/reports/views/OverrunReportsView';
import StaleTasksReportsView from '../../components/page-elements/workspace/reports/views/StaleTasksReportsView';
import TaskReportsView from '../../components/page-elements/workspace/reports/views/TaskReportsView';
import TimeReportsView from '../../components/page-elements/workspace/reports/views/TimeReportsView';
import { SearchableSelect } from '../../components/ui/FormField';
import ProBadge from '../../components/tariff/ProBadge';
import ProFeatureLock from '../../components/tariff/ProFeatureLock';
import type { LockedScreen } from '../../constants/tariffs';
import { useAppControllerContext } from '../../context/AppControllerContext';

// Значение — часть адреса: /reports?report=stale-tasks. Менять только вместе со ссылками.
type ReportView =
  | 'time'
  | 'hours-chart'
  | 'tasks'
  | 'overrun'
  | 'stale-tasks'
  | 'limits'
  | 'managers';

const REPORT_QUERY_PARAM = 'report';

// В меню короткие названия: раздел уже «Отчёты», полное название — в шапке самого отчёта.
const REPORT_VIEWS: Array<{
  id: ReportView;
  permission: string;
  title: string;
  description: string;
  /** Заглушка, если отчёт закрыт тарифом ФРИ. */
  lockedScreen?: LockedScreen;
}> = [
  {
    id: 'time',
    permission: 'reports.view',
    title: 'По времени',
    description: 'Аналитика часов и периодов',
  },
  {
    id: 'hours-chart',
    permission: 'reports.hours_chart.view',
    lockedScreen: 'report_hours_chart',
    title: 'График часов',
    description: 'Выработка по дням, неделям, месяцам',
  },
  {
    id: 'tasks',
    permission: 'reports.tasks.view',
    title: 'По задачам',
    description: 'Срез по задачам и статусам',
  },
  {
    id: 'overrun',
    permission: 'reports.overrun.view',
    lockedScreen: 'report_overrun',
    title: 'Перерасход',
    description: 'Задачи сверх оценки',
  },
  {
    id: 'stale-tasks',
    permission: 'reports.stale_tasks.view',
    lockedScreen: 'report_stale_tasks',
    title: 'Задачи без движения',
    description: 'Ничего не происходит 3 дня и дольше',
  },
  {
    id: 'limits',
    permission: 'reports.limits.view',
    lockedScreen: 'report_limits',
    title: 'Лимитные проекты',
    description: 'Часы против недельного лимита',
  },
  {
    id: 'managers',
    permission: 'reports.managers.view',
    lockedScreen: 'report_managers',
    title: 'По менеджерам',
    description: 'Часы под контролем и их стоимость',
  },
];

const REPORT_VIEW_NODES: Record<ReportView, JSX.Element> = {
  time: <TimeReportsView />,
  'hours-chart': <HoursChartReportsView />,
  tasks: <TaskReportsView />,
  overrun: <OverrunReportsView />,
  'stale-tasks': <StaleTasksReportsView />,
  limits: <LimitReportsView />,
  managers: <ManagerReportsView />,
};

function reportHref(view: ReportView) {
  return `/reports?${REPORT_QUERY_PARAM}=${view}`;
}

export default function ReportsPage() {
  const { user } = useAppControllerContext();
  const permissions = user?.permissions;
  const tariffLockedPermissions = user?.tariff_locked_permissions;
  // Отчёты, закрытые тарифом ФРИ, остаются в меню с меткой «ПРО»; их API не вызываем.
  const reportViews = useMemo(
    () =>
      REPORT_VIEWS.filter(
        (view) =>
          (permissions ?? []).includes(view.permission) ||
          (tariffLockedPermissions ?? []).includes(view.permission),
      ).map((view) => ({
        ...view,
        isProLocked: !(permissions ?? []).includes(view.permission),
      })),
    [permissions, tariffLockedPermissions],
  );
  // Выбранный отчёт живёт в адресе: на него можно дать ссылку, «Назад» листает отчёты.
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const requestedView = searchParams.get(REPORT_QUERY_PARAM);
  const activeReport =
    reportViews.find((view) => view.id === requestedView) ??
    reportViews.find((view) => !view.isProLocked) ??
    reportViews[0] ??
    null;
  const activeView = activeReport?.id ?? null;

  return (
    <div className='grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-2 overflow-hidden xl:grid-cols-[210px_minmax(0,1fr)] xl:grid-rows-1'>
      {/* Меню второго уровня, как в «Финансах» и «Оплате труда».
          До xl — выпадающий список: таблицам отчётов нужна ширина. */}
      {activeView ? (
        <div className='rounded-xl border border-[#e3e9f3] bg-white p-2 text-[#1f3565] xl:hidden'>
          <SearchableSelect
            value={activeView}
            onValueChange={(value) => {
              if (value) navigate(reportHref(value as ReportView));
            }}
            options={reportViews.map((view) => ({
              value: view.id,
              label: view.isProLocked ? `${view.title} · ПРО` : view.title,
            }))}
            searchable={false}
            className='h-11 rounded-xl border-[#c9d8f8] bg-[#edf2fb] pr-11 text-base font-semibold text-[#10275a] hover:border-[#aebfe6] focus:border-[#2d6ff7] focus:ring-[#dce7ff]'
          />
        </div>
      ) : null}

      <nav
        aria-label='Отчёты'
        className='hidden h-full min-h-0 flex-col gap-2 overflow-x-hidden overflow-y-auto rounded-xl border border-[#e3e9f3] bg-white p-3 text-[#1f3565] xl:flex'
      >
        {reportViews.map((view) => {
          const isActive = activeView === view.id;

          return (
            <Link
              key={view.id}
              to={reportHref(view.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`grid shrink-0 gap-1 rounded-xl border px-3 py-3 text-left transition-colors ${
                isActive
                  ? 'border-[#c9d8f8] bg-[#edf2fb] text-[#10275a]'
                  : 'border-[#e3e9f3] bg-white text-[#1f3565] hover:border-[#c9d8f8] hover:bg-[#fbfcff]'
              }`}
            >
              <span className='flex items-start justify-between gap-2 text-[14px] leading-snug font-semibold'>
                <span className='min-w-0'>{view.title}</span>
                {view.isProLocked ? <ProBadge className='mt-0.5' /> : null}
              </span>
              <span className='text-[12px] leading-snug text-[#7e8fb4]'>
                {view.description}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className='min-h-0 min-w-0 overflow-hidden'>
        {activeReport?.isProLocked ? (
          <ProFeatureLock feature='advanced_reports' screen={activeReport.lockedScreen} />
        ) : activeView ? (
          REPORT_VIEW_NODES[activeView]
        ) : (
          <div className='rounded-xl border border-[#e3e9f3] bg-white p-4 text-sm text-[#7e8fb4]'>
            У вас нет доступа к отчётам.
          </div>
        )}
      </div>
    </div>
  );
}
