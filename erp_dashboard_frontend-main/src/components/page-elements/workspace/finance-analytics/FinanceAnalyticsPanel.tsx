import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';

import { api } from '../../../../api/api';
import type { Client, Project } from '../../../../types/app';
import type {
  FinanceAnalyticsClientRow,
  FinanceAnalyticsFilters,
  FinanceAnalyticsManagerRow,
  FinanceAnalyticsOverview,
  FinanceAnalyticsProjectRow,
} from '../../../../types/financeAnalytics';
import FinanceAnalyticsFiltersPanel from './FinanceAnalyticsFilters';
import FinanceAnalyticsOverviewBlock from './FinanceAnalyticsOverview';
import FinanceArticlesDonut from './FinanceArticlesDonut';
import FinanceAnalyticsTables from './FinanceAnalyticsTables';
import UnaccountedPaymentsAnalytics from './UnaccountedPaymentsAnalytics';
import {
  formatAnalyticsPeriod,
  formatAnalyticsPerson,
  parseAnalyticsFiltersFromSearch,
  writeAnalyticsFiltersToSearch,
} from './financeAnalyticsUtils';
import { extractAnalyticsRows } from './financeAnalyticsNormalizers';

type Props = {
  projects: Project[];
  clients: Client[];
  isLoadingOptions: boolean;
  refreshKey?: number;
  openingFinanceId?: string | null;
  onOpenFinance?: (_financeId: string) => void;
};

type UnaccountedPaymentKind = 'income' | 'expense';
type UnaccountedPages = Record<UnaccountedPaymentKind, number>;

const UNACCOUNTED_PAGE_SIZE = 10;
const FIRST_UNACCOUNTED_PAGES: UnaccountedPages = { income: 1, expense: 1 };

function areFiltersEqual(
  left: FinanceAnalyticsFilters,
  right: FinanceAnalyticsFilters,
): boolean {
  return (
    left.from === right.from &&
    left.to === right.to &&
    left.granularity === right.granularity &&
    left.project_ids.join('|') === right.project_ids.join('|') &&
    left.client_ids.join('|') === right.client_ids.join('|') &&
    left.manager_ids.join('|') === right.manager_ids.join('|')
  );
}

function overviewQuery(filters: FinanceAnalyticsFilters, pages: UnaccountedPages) {
  return {
    ...filters,
    unaccounted_income_page: pages.income,
    unaccounted_expenses_page: pages.expense,
    unaccounted_per_page: UNACCOUNTED_PAGE_SIZE,
  };
}

export default function FinanceAnalyticsPanel({
  projects,
  clients,
  isLoadingOptions,
  refreshKey = 0,
  openingFinanceId,
  onOpenFinance,
}: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const [draftFilters, setDraftFilters] = useState<FinanceAnalyticsFilters>(() =>
    parseAnalyticsFiltersFromSearch(new URLSearchParams(location.search)),
  );
  const [appliedFilters, setAppliedFilters] = useState<FinanceAnalyticsFilters>(() =>
    parseAnalyticsFiltersFromSearch(new URLSearchParams(location.search)),
  );
  const [overview, setOverview] = useState<FinanceAnalyticsOverview | null>(null);
  const [projectRows, setProjectRows] = useState<FinanceAnalyticsProjectRow[]>([]);
  const [managerRows, setManagerRows] = useState<FinanceAnalyticsManagerRow[]>([]);
  const [clientRows, setClientRows] = useState<FinanceAnalyticsClientRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUnaccountedLoading, setIsUnaccountedLoading] = useState(false);
  const [unaccountedPages, setUnaccountedPages] = useState<UnaccountedPages>(
    FIRST_UNACCOUNTED_PAGES,
  );

  const projectOptions = useMemo(
    () => projects.map((project) => ({ value: project.id, label: project.name })),
    [projects],
  );
  const clientOptions = useMemo(
    () => clients.map((client) => ({ value: client.id, label: client.name })),
    [clients],
  );
  const managerOptions = useMemo(() => {
    const managers = new Map<string, { value: string; label: string }>();
    projects.forEach((project) => {
      (project.members ?? []).forEach((member) => {
        if (member.is_pm) {
          managers.set(member.user.id, {
            value: member.user.id,
            label: formatAnalyticsPerson(member.user),
          });
        }
      });
    });
    return [...managers.values()].sort((left, right) =>
      left.label.localeCompare(right.label, 'ru'),
    );
  }, [projects]);
  const periodLabel = useMemo(
    () => formatAnalyticsPeriod(appliedFilters.from, appliedFilters.to),
    [appliedFilters.from, appliedFilters.to],
  );

  const loadAnalytics = useCallback(async () => {
    try {
      setIsLoading(true);
      setUnaccountedPages(FIRST_UNACCOUNTED_PAGES);
      const [overviewData, projectsData, managersData, clientsData] = await Promise.all([
        api.workspace.financeAnalytics.getOverview(
          overviewQuery(appliedFilters, FIRST_UNACCOUNTED_PAGES),
        ),
        api.workspace.financeAnalytics.getProjects(appliedFilters),
        api.workspace.financeAnalytics.getManagers(appliedFilters),
        api.workspace.financeAnalytics.getClients(appliedFilters),
      ]);

      setOverview(overviewData);
      setProjectRows(
        extractAnalyticsRows<FinanceAnalyticsProjectRow>(projectsData, [
          'projects',
          'items',
        ]),
      );
      setManagerRows(
        extractAnalyticsRows<FinanceAnalyticsManagerRow>(managersData, [
          'managers',
          'items',
        ]),
      );
      setClientRows(
        extractAnalyticsRows<FinanceAnalyticsClientRow>(clientsData, [
          'clients',
          'items',
        ]),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Не удалось загрузить финансовую аналитику.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [appliedFilters]);

  const loadUnaccountedPage = useCallback(
    async (kind: UnaccountedPaymentKind, page: number) => {
      const nextPages = { ...unaccountedPages, [kind]: page };

      try {
        setUnaccountedPages(nextPages);
        setIsUnaccountedLoading(true);
        const overviewData = await api.workspace.financeAnalytics.getOverview(
          overviewQuery(appliedFilters, nextPages),
        );

        setOverview(overviewData);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Не удалось загрузить неучтённые платежи.',
        );
      } finally {
        setIsUnaccountedLoading(false);
      }
    },
    [appliedFilters, unaccountedPages],
  );

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics, refreshKey]);

  useEffect(() => {
    const nextFilters = parseAnalyticsFiltersFromSearch(
      new URLSearchParams(location.search),
    );

    setDraftFilters((current) =>
      areFiltersEqual(current, nextFilters) ? current : nextFilters,
    );
    setAppliedFilters((current) =>
      areFiltersEqual(current, nextFilters) ? current : nextFilters,
    );
  }, [location.search]);

  const syncFiltersToSearch = useCallback(
    (nextFilters: FinanceAnalyticsFilters) => {
      const searchParams = writeAnalyticsFiltersToSearch(
        new URLSearchParams(location.search),
        nextFilters,
      );
      searchParams.set('view', 'analytics');

      const nextSearch = searchParams.toString();
      const nextUrl = `${location.pathname}${nextSearch ? `?${nextSearch}` : ''}`;
      const currentUrl = `${location.pathname}${location.search}`;

      if (nextUrl !== currentUrl) {
        navigate(nextUrl, { replace: true });
      }
    },
    [location.pathname, location.search, navigate],
  );

  const applyFilters = useCallback(() => {
    const nextFilters = { ...draftFilters };
    syncFiltersToSearch(nextFilters);
    setAppliedFilters(nextFilters);
  }, [draftFilters, syncFiltersToSearch]);

  return (
    <section className='h-full min-h-0 min-w-0 overflow-auto rounded-xl border border-[#e3e9f3] bg-[#f3f6fb] p-2 text-[#1f3565] md:p-3'>
      <div className='mx-auto grid min-w-0 max-w-380 gap-3'>
        <div>
          <h1 className='text-xl leading-tight font-semibold text-[#10275a] md:text-[22px]'>
            Финансы - аналитика
          </h1>
          <p className='mt-1 text-xs text-[#7e8fb4]'>
            Доходы, расходы, прибыль и детализация по компании
          </p>
        </div>

        <FinanceAnalyticsFiltersPanel
          filters={draftFilters}
          projectOptions={projectOptions}
          clientOptions={clientOptions}
          managerOptions={managerOptions}
          isLoading={isLoading || isLoadingOptions}
          onChange={setDraftFilters}
          onApply={applyFilters}
        />

        {isLoading && !overview ? (
          <div className='grid min-h-96 place-items-center rounded-xl border border-[#e3e9f3] bg-white text-sm text-[#7e8fb4]'>
            Загрузка аналитики...
          </div>
        ) : overview ? (
          <>
            <FinanceAnalyticsOverviewBlock
              data={overview}
              openingFinanceId={openingFinanceId}
              onOpenFinance={onOpenFinance}
            />

            <div className='grid min-w-0 gap-3 xl:grid-cols-2'>
              <FinanceArticlesDonut
                title='Поступления'
                periodLabel={periodLabel}
                total={overview.summary?.income ?? 0}
                articles={overview.income_articles ?? []}
                tone='income'
              />
              <FinanceArticlesDonut
                title='Расходы'
                periodLabel={periodLabel}
                total={overview.summary?.expenses ?? 0}
                articles={overview.expense_articles ?? []}
                tone='expense'
              />
              {(overview.summary?.company_planned_expenses ?? 0) > 0 ? (
                <FinanceArticlesDonut
                  title={
                    overview.summary.planned_expenses_included
                      ? 'Планируемые расходы'
                      : 'План компании (не включён)'
                  }
                  periodLabel={periodLabel}
                  total={overview.summary.company_planned_expenses}
                  articles={overview.planned_expense_articles ?? []}
                  tone='planned'
                />
              ) : null}
            </div>

            <FinanceAnalyticsTables
              projects={projectRows}
              managers={managerRows}
              clients={clientRows}
            />
            <UnaccountedPaymentsAnalytics
              periodLabel={periodLabel}
              income={overview.unaccounted_income ?? { items: [], total: 0 }}
              expenses={overview.unaccounted_expenses ?? { items: [], total: 0 }}
              isLoading={isUnaccountedLoading}
              onPageChange={loadUnaccountedPage}
            />
          </>
        ) : (
          <div className='grid min-h-80 place-items-center rounded-xl border border-[#e3e9f3] bg-white text-sm text-[#7e8fb4]'>
            Данные аналитики недоступны
          </div>
        )}
      </div>
    </section>
  );
}
