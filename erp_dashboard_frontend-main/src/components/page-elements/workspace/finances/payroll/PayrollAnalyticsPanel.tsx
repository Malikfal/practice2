import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';

import { api } from '../../../../../api/api';
import type { Client, Project } from '../../../../../types/app';
import type {
  FinanceAnalyticsEmployees,
  FinanceAnalyticsFilters,
} from '../../../../../types/financeAnalytics';
import FinanceAnalyticsFiltersPanel from '../../finance-analytics/FinanceAnalyticsFilters';
import {
  formatAnalyticsPerson,
  parseAnalyticsFiltersFromSearch,
  writeAnalyticsFiltersToSearch,
} from '../../finance-analytics/financeAnalyticsUtils';
import { normalizeEmployeesResponse } from '../../finance-analytics/financeAnalyticsNormalizers';
import EmployeePaymentsAnalytics from './EmployeePaymentsAnalytics';

type Props = {
  projects: Project[];
  clients: Client[];
  isLoadingOptions: boolean;
};

export default function PayrollAnalyticsPanel({
  projects,
  clients,
  isLoadingOptions,
}: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const [draftFilters, setDraftFilters] = useState<FinanceAnalyticsFilters>(() =>
    parseAnalyticsFiltersFromSearch(new URLSearchParams(location.search)),
  );
  const [appliedFilters, setAppliedFilters] = useState<FinanceAnalyticsFilters>(() =>
    parseAnalyticsFiltersFromSearch(new URLSearchParams(location.search)),
  );
  const [data, setData] = useState<FinanceAnalyticsEmployees | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
        if (!member.is_pm) return;
        managers.set(member.user.id, {
          value: member.user.id,
          label: formatAnalyticsPerson(member.user),
        });
      });
    });
    return [...managers.values()].sort((left, right) =>
      left.label.localeCompare(right.label, 'ru'),
    );
  }, [projects]);

  const loadEmployees = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.workspace.financeAnalytics.getEmployees(appliedFilters);
      setData(normalizeEmployeesResponse(response, appliedFilters));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Не удалось загрузить аналитику по сотрудникам.',
      );
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [appliedFilters]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  const applyFilters = () => {
    const nextFilters = { ...draftFilters };
    const searchParams = writeAnalyticsFiltersToSearch(
      new URLSearchParams(location.search),
      nextFilters,
    );
    // «Общий расчёт» — вкладка по умолчанию в «Оплата труда → Расчёт ФОТ».
    searchParams.delete('tab');
    navigate(`${location.pathname}?${searchParams.toString()}`, { replace: true });
    setAppliedFilters(nextFilters);
  };

  return (
    <div className='grid min-w-0 gap-3'>
      <FinanceAnalyticsFiltersPanel
        filters={draftFilters}
        projectOptions={projectOptions}
        clientOptions={clientOptions}
        managerOptions={managerOptions}
        isLoading={isLoading || isLoadingOptions}
        onChange={setDraftFilters}
        onApply={applyFilters}
      />
      {isLoading && !data ? (
        <div className='grid min-h-72 place-items-center rounded-xl border border-[#e3e9f3] bg-white text-sm text-[#7e8fb4]'>
          Загрузка аналитики...
        </div>
      ) : data ? (
        <EmployeePaymentsAnalytics data={data} />
      ) : (
        <div className='grid min-h-72 place-items-center rounded-xl border border-[#e3e9f3] bg-white text-sm text-[#7e8fb4]'>
          Данные аналитики недоступны
        </div>
      )}
    </div>
  );
}
