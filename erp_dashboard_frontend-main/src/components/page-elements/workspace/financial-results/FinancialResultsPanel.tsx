import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';

import { api } from '../../../../api/api';
import type { Client, FinanceArticle, Project, User } from '../../../../types/app';
import type {
  FinancialResultsClientRow,
  FinancialResultsFilters,
  FinancialResultsManagerRow,
  FinancialResultsOverview as Overview,
  FinancialResultsProjectRow,
} from '../../../../types/financialResults';
import { formatName } from '../../../../utils/formatters';
import FinanceArticlesDonut from '../finance-analytics/FinanceArticlesDonut';
import { extractAnalyticsRows } from '../finance-analytics/financeAnalyticsNormalizers';
import { formatAnalyticsPeriod } from '../finance-analytics/financeAnalyticsUtils';
import FinancialResultsFiltersPanel from './FinancialResultsFilters';
import FinancialResultsOverview from './FinancialResultsOverview';
import FinancialResultsTables from './FinancialResultsTables';
import {
  areFinancialResultsFiltersEqual,
  formatFinancialResultsPerson,
  parseFinancialResultsFilters,
  writeFinancialResultsFilters,
} from './financialResultsUtils';

type Props = {
  projects: Project[];
  clients: Client[];
  articles: FinanceArticle[];
  employees: User[];
  isLoadingOptions: boolean;
};

export default function FinancialResultsPanel({
  projects,
  clients,
  articles,
  employees,
  isLoadingOptions,
}: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const initialFilters = () =>
    parseFinancialResultsFilters(new URLSearchParams(location.search));
  const [draftFilters, setDraftFilters] =
    useState<FinancialResultsFilters>(initialFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<FinancialResultsFilters>(initialFilters);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [projectsData, setProjectsData] = useState<FinancialResultsProjectRow[]>([]);
  const [managersData, setManagersData] = useState<FinancialResultsManagerRow[]>([]);
  const [clientsData, setClientsData] = useState<FinancialResultsClientRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const projectOptions = useMemo(
    () => projects.map((item) => ({ value: item.id, label: item.name })),
    [projects],
  );
  const clientOptions = useMemo(
    () => clients.map((item) => ({ value: item.id, label: item.name })),
    [clients],
  );
  const employeeOptions = useMemo(
    () => employees.map((item) => ({ value: item.id, label: formatName(item) })),
    [employees],
  );
  const managerOptions = useMemo(() => {
    const managers = new Map<string, { value: string; label: string }>();
    projects.forEach((project) =>
      (project.members ?? []).forEach((member) => {
        if (member.is_pm)
          managers.set(member.user.id, {
            value: member.user.id,
            label: formatFinancialResultsPerson(member.user),
          });
      }),
    );
    return [...managers.values()].sort((left, right) =>
      left.label.localeCompare(right.label, 'ru'),
    );
  }, [projects]);

  const syncFilters = useCallback(
    (filters: FinancialResultsFilters) => {
      const params = writeFinancialResultsFilters(
        new URLSearchParams(location.search),
        filters,
      );
      params.set('view', 'financial-results');
      const search = params.toString();
      const nextUrl = `${location.pathname}${search ? `?${search}` : ''}`;
      if (nextUrl !== `${location.pathname}${location.search}`)
        navigate(nextUrl, { replace: true });
    },
    [location.pathname, location.search, navigate],
  );

  const loadResults = useCallback(async () => {
    try {
      setIsLoading(true);
      const [overviewResponse, projectsResponse, managersResponse, clientsResponse] =
        await Promise.all([
          api.workspace.financialResults.getOverview(appliedFilters),
          api.workspace.financialResults.getProjects(appliedFilters),
          api.workspace.financialResults.getManagers(appliedFilters),
          api.workspace.financialResults.getClients(appliedFilters),
        ]);
      setOverview(overviewResponse);
      setProjectsData(
        extractAnalyticsRows<FinancialResultsProjectRow>(projectsResponse, [
          'projects',
          'items',
        ]),
      );
      setManagersData(
        extractAnalyticsRows<FinancialResultsManagerRow>(managersResponse, [
          'managers',
          'items',
        ]),
      );
      setClientsData(
        extractAnalyticsRows<FinancialResultsClientRow>(clientsResponse, [
          'clients',
          'items',
        ]),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Не удалось загрузить отчёт о финансовых результатах.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [appliedFilters]);

  useEffect(() => {
    void loadResults();
  }, [loadResults]);
  useEffect(() => {
    const filters = parseFinancialResultsFilters(new URLSearchParams(location.search));
    setDraftFilters((current) =>
      areFinancialResultsFiltersEqual(current, filters) ? current : filters,
    );
    setAppliedFilters((current) =>
      areFinancialResultsFiltersEqual(current, filters) ? current : filters,
    );
  }, [location.search]);

  const periodLabel = formatAnalyticsPeriod(appliedFilters.from, appliedFilters.to);

  return (
    <section className='h-full min-h-0 min-w-0 overflow-auto rounded-xl border border-[#e3e9f3] bg-[#f3f6fb] p-2 text-[#1f3565] md:p-3'>
      <div className='mx-auto grid min-w-0 max-w-380 gap-3'>
        <div>
          <h1 className='text-xl leading-tight font-semibold text-[#10275a] md:text-[22px]'>
            Отчёт о финансовых результатах
          </h1>
          <p className='mt-1 text-xs text-[#7e8fb4]'>
            Фактические поступления и прямые расходы по датам движения денег
          </p>
        </div>
        <FinancialResultsFiltersPanel
          filters={draftFilters}
          projectOptions={projectOptions}
          clientOptions={clientOptions}
          managerOptions={managerOptions}
          articles={articles}
          employeeOptions={employeeOptions}
          isLoading={isLoading || isLoadingOptions}
          onChange={setDraftFilters}
          onApply={() => {
            const filters = { ...draftFilters };
            syncFilters(filters);
            setAppliedFilters(filters);
          }}
        />
        {isLoading && !overview ? (
          <div className='grid min-h-96 place-items-center rounded-xl border border-[#e3e9f3] bg-white text-sm text-[#7e8fb4]'>
            Загрузка отчёта...
          </div>
        ) : overview ? (
          <>
            <FinancialResultsOverview data={overview} />
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
            </div>
            <FinancialResultsTables
              projects={projectsData}
              managers={managersData}
              clients={clientsData}
            />
          </>
        ) : (
          <div className='grid min-h-80 place-items-center rounded-xl border border-[#e3e9f3] bg-white text-sm text-[#7e8fb4]'>
            Данные отчёта недоступны
          </div>
        )}
      </div>
    </section>
  );
}
