import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';

import { api } from '../../api/api';
import { ApiRequestError } from '../../api/core/error';
import FinanceModal from '../../components/modals/FinanceModal';
import ConfirmDialog from '../../components/modals/ConfirmDialog';
import ExportDataModal from '../../components/modals/ExportDataModal';
import ImportErrorsModal, {
  type ImportErrorDetail,
} from '../../components/modals/ImportErrorsModal';
import FinanceSidebar, {
  type FinanceView,
} from '../../components/page-elements/workspace/finances/FinanceSidebar';
import FinancesPaymentsPanel from '../../components/page-elements/workspace/finances/FinancesPaymentsPanel';
import {
  emptyFinanceSummary,
  type FinanceSummary,
} from '../../components/page-elements/workspace/finances/FinanceSummaryStrip';
import FinanceAnalyticsPanel from '../../components/page-elements/workspace/finance-analytics/FinanceAnalyticsPanel';
import FinancialResultsPanel from '../../components/page-elements/workspace/financial-results/FinancialResultsPanel';
import FinanceArticlesSettings from '../../components/page-elements/workspace/settings/FinanceArticlesSettings';
import FinanceSettings from '../../components/page-elements/workspace/settings/FinanceSettings';
import ProFeatureLock from '../../components/tariff/ProFeatureLock';
import {
  currentMonthRange,
  emptyFinanceForm,
  financeFormToPayload,
  financeToForm,
  FINANCE_TYPE_LABELS,
  FINANCE_TYPE_NEW_TITLES,
  parseFinanceAmountInput,
} from '../../components/page-elements/workspace/finances/financeUtils';
import type {
  FinanceFilterState,
  FinanceForm,
} from '../../components/page-elements/workspace/finances/types';
import Button from '../../components/ui/Button';
import { useServerPagination } from '../../components/ui/Pagination';
import { useAppControllerContext } from '../../context/AppControllerContext';
import { useTariffAccess } from '../../hooks/useTariffAccess';
import { formatName } from '../../utils/formatters';
import { downloadBlob } from '../../utils/exportFiles';
import { FINANCE_IMPORT_TEMPLATES, importFinanceRows } from '../../utils/financeImport';
import type {
  Client,
  Finance,
  FinanceArticle,
  FinanceFilters,
  PlannedExpensePayment,
  FinanceSource,
  FinanceType,
  Project,
  User,
} from '../../types/app';

import ImportDataModal from '../../components/modals/ImportDataModal';
import { parseCSV, parseXLSX } from '../../utils/importFiles';

type FinanceModalState = {
  mode: 'create' | 'edit';
  financeId?: string;
  form: FinanceForm;
};

type FinanceBulkAction = 'duplicate' | 'delete';

type FinanceArticlesManagerState = {
  defaultType: FinanceType;
};

type ImportReportState = {
  errors: ImportErrorDetail[];
  warnings: ImportErrorDetail[];
};

const initialFilters: Omit<FinanceFilterState, 'from' | 'to'> = {
  amount_from: '',
  amount_to: '',
  type: '',
  sources: [],
  finance_article_ids: [],
  project_ids: [],
  client_ids: [],
  employee_ids: [],
};

const financeSources = new Set<FinanceSource>([
  'PAYROLL_DAILY',
  'PAYROLL_RECALCULATION',
  'MANUAL',
  'IMPORT',
]);

function getFinanceSourcesFromSearch(search: string): FinanceSource[] {
  const params = new URLSearchParams(search);
  const values = [...params.getAll('sources[]'), ...params.getAll('sources')];

  return Array.from(
    new Set(
      values.filter((value): value is FinanceSource =>
        financeSources.has(value as FinanceSource),
      ),
    ),
  );
}

function financeFiltersToApiParams(filters: FinanceFilterState): FinanceFilters {
  return {
    from: filters.from,
    to: filters.to,
    type: filters.type as FinanceType | undefined,
    sources: filters.sources.length ? filters.sources : undefined,
    finance_article_ids: filters.finance_article_ids,
    project_ids: filters.project_ids,
    client_ids: filters.client_ids,
    employee_ids: filters.employee_ids,
    amount_from: filters.amount_from
      ? Math.round(parseFinanceAmountInput(filters.amount_from) * 100)
      : undefined,
    amount_to: filters.amount_to
      ? Math.round(parseFinanceAmountInput(filters.amount_to) * 100)
      : undefined,
  };
}

function getFinanceViewFromSearch(search: string): FinanceView {
  const view = new URLSearchParams(search).get('view');
  return view === 'financial-results' || view === 'analytics' || view === 'settings'
    ? view
    : 'payments';
}

export default function FinancesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAppControllerContext();
  const permissions = user?.permissions ?? [];
  const canView =
    permissions.includes('finance.view') || permissions.includes('finance.manage');
  const canManage = permissions.includes('finance.manage');
  const tariffAccess = useTariffAccess();
  // На ФРИ закрыты отчёт о финрезультатах (экономика проектов), аналитика и планируемые расходы.
  const isFinancialResultsLocked = tariffAccess.isFeatureLocked('project_economics');
  const isAnalyticsLocked = tariffAccess.isFeatureLocked('finance_analytics');
  const lockedFinanceViews = useMemo(() => {
    const views: FinanceView[] = [];
    if (isFinancialResultsLocked) views.push('financial-results');
    if (isAnalyticsLocked) views.push('analytics');
    return views;
  }, [isAnalyticsLocked, isFinancialResultsLocked]);

  const [finances, setFinances] = useState<Finance[]>([]);
  const [paymentSummary, setPaymentSummary] =
    useState<FinanceSummary>(emptyFinanceSummary);
  const [isLoadingPaymentSummary, setIsLoadingPaymentSummary] = useState(false);
  const [plannedExpensePayments, setPlannedExpensePayments] = useState<
    PlannedExpensePayment[]
  >([]);
  const [showPlannedExpenses, setShowPlannedExpenses] = useState(false);
  const [isLoadingPlannedExpenses, setIsLoadingPlannedExpenses] = useState(false);
  const [articles, setArticles] = useState<FinanceArticle[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [openingAnalyticsFinanceId, setOpeningAnalyticsFinanceId] = useState<
    string | null
  >(null);
  const [analyticsRefreshKey, setAnalyticsRefreshKey] = useState(0);
  const [modal, setModal] = useState<FinanceModalState | null>(null);
  const [articlesManager, setArticlesManager] =
    useState<FinanceArticlesManagerState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Finance | null>(null);
  const [bulkAction, setBulkAction] = useState<FinanceBulkAction | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImportingFinances, setIsImportingFinances] = useState<boolean>(false);
  const [importReport, setImportReport] = useState<ImportReportState>({
    errors: [],
    warnings: [],
  });
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedFinanceIds, setSelectedFinanceIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<FinanceFilterState>(() => ({
    ...initialFilters,
    ...currentMonthRange(),
    sources: getFinanceSourcesFromSearch(location.search),
  }));
  const [activeView, setActiveView] = useState<FinanceView>(() =>
    getFinanceViewFromSearch(location.search),
  );
  const {
    currentPage,
    pageSize,
    totalPages,
    setCurrentPage,
    resetPage,
    onPageSizeChange,
    applyMeta,
  } = useServerPagination(10);
  const projectsRequestRef = useRef<Promise<Project[]> | null>(null);
  const clientsRequestRef = useRef<Promise<Client[]> | null>(null);
  const employeesRequestRef = useRef<Promise<User[]> | null>(null);
  // Признак загрузки отдельно от длины списка: пустой ответ тоже считается загруженным,
  // иначе новый [] пересоздаёт загрузчик, эффект аналитики вызывает его снова — и так по кругу.
  const projectsLoadedRef = useRef(false);
  const clientsLoadedRef = useRef(false);
  const employeesLoadedRef = useRef(false);
  const paymentSummaryRequestIdRef = useRef(0);

  const handleError = useCallback((err: unknown) => {
    toast.error(err instanceof Error ? err.message : 'Произошла ошибка.');
  }, []);

  const projectOptions = useMemo(
    () => projects.map((project) => ({ value: project.id, label: project.name })),
    [projects],
  );
  const clientOptions = useMemo(
    () => clients.map((client) => ({ value: client.id, label: client.name })),
    [clients],
  );
  const employeeOptions = useMemo(
    () =>
      employees.map((employee) => ({ value: employee.id, label: formatName(employee) })),
    [employees],
  );
  const filteredArticles = useMemo(
    () => articles.filter((article) => !filters.type || article.type === filters.type),
    [articles, filters.type],
  );
  const selectedFinances = useMemo(
    () => finances.filter((finance) => selectedFinanceIds.includes(finance.id)),
    [finances, selectedFinanceIds],
  );
  const loadArticles = useCallback(async () => {
    const articleData = await api.workspace.financeArticles.getMany();
    setArticles(articleData);
    return articleData;
  }, []);

  const loadProjects = useCallback(async () => {
    if (projectsLoadedRef.current) {
      return projects;
    }

    if (projectsRequestRef.current) {
      return projectsRequestRef.current;
    }

    setIsLoadingProjects(true);
    const request = api.workspace.projects
      .getMany({ status: 'all' })
      .then((response) => {
        const nextProjects = response.data ?? [];
        projectsLoadedRef.current = true;
        setProjects(nextProjects);
        return nextProjects;
      })
      .finally(() => {
        projectsRequestRef.current = null;
        setIsLoadingProjects(false);
      });

    projectsRequestRef.current = request;

    return request;
  }, [projects]);

  const loadClients = useCallback(async () => {
    if (clientsLoadedRef.current) {
      return clients;
    }

    if (clientsRequestRef.current) {
      return clientsRequestRef.current;
    }

    setIsLoadingClients(true);
    const request = api.workspace.clients
      .getMany({ per_page: 1000 })
      .then((response) => {
        const nextClients = response.data ?? [];
        clientsLoadedRef.current = true;
        setClients(nextClients);
        return nextClients;
      })
      .finally(() => {
        clientsRequestRef.current = null;
        setIsLoadingClients(false);
      });

    clientsRequestRef.current = request;

    return request;
  }, [clients]);

  const loadEmployees = useCallback(async () => {
    if (employeesLoadedRef.current) {
      return employees;
    }

    if (employeesRequestRef.current) {
      return employeesRequestRef.current;
    }

    setIsLoadingEmployees(true);
    const request = api.workspace.employees
      .getMany({ status: 'all', per_page: 1000 })
      .then((response) => {
        const nextEmployees = response.data ?? [];
        employeesLoadedRef.current = true;
        setEmployees(nextEmployees);
        return nextEmployees;
      })
      .finally(() => {
        employeesRequestRef.current = null;
        setIsLoadingEmployees(false);
      });

    employeesRequestRef.current = request;

    return request;
  }, [employees]);

  const loadFinances = useCallback(async () => {
    if (!canView) return;

    try {
      setIsLoading(true);
      const params: FinanceFilters = {
        ...financeFiltersToApiParams(filters),
        page: currentPage,
        per_page: pageSize,
      };
      const response = await api.workspace.finances.getMany(params);
      const financeList = response.data ?? [];
      const visibleFinanceIds = new Set(financeList.map((finance) => finance.id));
      setFinances(financeList);
      setSelectedFinanceIds((current) =>
        current.filter((financeId) => visibleFinanceIds.has(financeId)),
      );
      applyMeta(response.meta);
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoading(false);
    }
  }, [applyMeta, canView, currentPage, filters, handleError, pageSize]);

  const loadPaymentSummary = useCallback(async () => {
    if (!canView || activeView !== 'payments') return;

    const requestId = paymentSummaryRequestIdRef.current + 1;
    paymentSummaryRequestIdRef.current = requestId;
    try {
      setIsLoadingPaymentSummary(true);
      const summary = await api.workspace.finances.getSummary(
        financeFiltersToApiParams(filters),
      );
      if (paymentSummaryRequestIdRef.current === requestId) {
        setPaymentSummary(summary ?? emptyFinanceSummary);
      }
    } catch (error) {
      if (paymentSummaryRequestIdRef.current === requestId) {
        handleError(error);
      }
    } finally {
      if (paymentSummaryRequestIdRef.current === requestId) {
        setIsLoadingPaymentSummary(false);
      }
    }
  }, [activeView, canView, filters, handleError]);

  const loadPlannedExpensePayments = useCallback(async () => {
    if (!canView) return;

    if (filters.sources.length > 0) {
      setPlannedExpensePayments([]);
      return;
    }

    try {
      setIsLoadingPlannedExpenses(true);
      const rows = await api.workspace.plannedExpenses.getPayments(
        financeFiltersToApiParams(filters),
      );
      setPlannedExpensePayments(rows);
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoadingPlannedExpenses(false);
    }
  }, [canView, filters, handleError]);

  useEffect(() => {
    void loadFinances();
  }, [loadFinances]);

  useEffect(() => {
    void loadPaymentSummary();
  }, [loadPaymentSummary]);

  // Планируемые расходы относятся к аналитике: на ФРИ их API закрыт.
  const isShowingPlannedExpenses = showPlannedExpenses && !isAnalyticsLocked;

  useEffect(() => {
    if (!isShowingPlannedExpenses) return;

    void loadPlannedExpensePayments();
  }, [loadPlannedExpensePayments, isShowingPlannedExpenses]);

  const refreshPaymentData = useCallback(async () => {
    await Promise.all([
      loadFinances(),
      loadPaymentSummary(),
      isShowingPlannedExpenses ? loadPlannedExpensePayments() : Promise.resolve(),
    ]);
  }, [
    loadFinances,
    loadPaymentSummary,
    loadPlannedExpensePayments,
    isShowingPlannedExpenses,
  ]);

  useEffect(() => {
    const handlePayrollFinancialDataUpdate = () => {
      void refreshPaymentData();
    };

    window.addEventListener(
      'payroll-financial-data-updated',
      handlePayrollFinancialDataUpdate,
    );
    return () =>
      window.removeEventListener(
        'payroll-financial-data-updated',
        handlePayrollFinancialDataUpdate,
      );
  }, [refreshPaymentData]);

  useEffect(() => {
    const nextView = getFinanceViewFromSearch(location.search);
    setActiveView((current) => (current === nextView ? current : nextView));
    const nextSources = getFinanceSourcesFromSearch(location.search);
    setFilters((current) =>
      current.sources.length === nextSources.length &&
      current.sources.every((source, index) => source === nextSources[index])
        ? current
        : { ...current, sources: nextSources },
    );
  }, [location.search]);

  useEffect(() => {
    if (!canView) return;

    void loadArticles().catch(handleError);
  }, [canView, handleError, loadArticles]);

  useEffect(() => {
    const isReportView =
      (activeView === 'financial-results' && !isFinancialResultsLocked) ||
      (activeView === 'analytics' && !isAnalyticsLocked);
    if (!isReportView) return;

    const loadAnalyticsOptions = async () => {
      try {
        setIsLoadingOptions(true);
        await Promise.all([loadProjects(), loadClients(), loadEmployees()]);
      } catch (err) {
        // Без прав на проекты или клиентов их фильтры остаются пустыми, отчёт это не ломает.
        if (!(err instanceof ApiRequestError && err.status === 403)) handleError(err);
      } finally {
        setIsLoadingOptions(false);
      }
    };

    void loadAnalyticsOptions();
  }, [
    activeView,
    handleError,
    isAnalyticsLocked,
    isFinancialResultsLocked,
    loadClients,
    loadEmployees,
    loadProjects,
  ]);

  const updateFilters = (next: Partial<FinanceFilterState>) => {
    setFilters((current) => ({ ...current, ...next }));
    setSelectedFinanceIds([]);
    resetPage();

    if (next.sources) {
      const params = new URLSearchParams(location.search);
      params.delete('sources');
      params.delete('sources[]');
      next.sources.forEach((source) => params.append('sources[]', source));
      const nextSearch = params.toString();
      navigate(`${location.pathname}${nextSearch ? `?${nextSearch}` : ''}`, {
        replace: true,
      });
    }
  };

  const financeViewHref = (view: FinanceView) => {
    const params = new URLSearchParams(location.search);

    if (view === 'payments') {
      params.delete('view');
    } else {
      params.set('view', view);
    }
    // Вкладка относится только к настройкам.
    params.delete('tab');

    const nextSearch = params.toString();
    return `${location.pathname}${nextSearch ? `?${nextSearch}` : ''}`;
  };

  const updateActiveView = (view: FinanceView) => {
    navigate(financeViewHref(view), { replace: true });
    setActiveView(view);
  };

  const importFinances = async (financesData: unknown[]) => {
    if (!canManage) {
      toast.error('У вас нет прав для импорта финансов.');
      return;
    }

    try {
      setIsImportingFinances(true);
      setImportReport({ errors: [], warnings: [] });

      if (!Array.isArray(financesData) || financesData.length === 0) {
        toast.error('Нет данных для импорта.');
        return;
      }

      const [loadedArticles, loadedProjects, loadedClients, loadedEmployees] =
        await Promise.all([
          articles.length > 0 ? Promise.resolve(articles) : loadArticles(),
          loadProjects(),
          loadClients(),
          loadEmployees(),
        ]);

      const result = await importFinanceRows({
        rows: financesData,
        api: api.workspace,
        articles: loadedArticles,
        projects: loadedProjects,
        clients: loadedClients,
        employees: loadedEmployees,
      });

      setArticles(result.articles);
      setProjects(result.projects);
      setClients(result.clients);

      if (result.successCount > 0) {
        toast.success(`Импортировано платежей: ${result.successCount}`);
        await refreshPaymentData();
        setIsImportModalOpen(false);
      }

      if (result.errorDetails.length > 0 || result.warningDetails.length > 0) {
        setImportReport({
          errors: result.errorDetails,
          warnings: result.warningDetails,
        });
        setIsImportModalOpen(false);
      }
    } catch (error) {
      console.error('Ошибка при импорте финансов', error);
      toast.error('Ошибка при импорте финансов');
    } finally {
      setIsImportingFinances(false);
    }
  };

  const exportFinancesXlsx = async () => {
    try {
      const blob = await api.workspace.finances.export(
        'xlsx',
        financeFiltersToApiParams(filters),
      );
      downloadBlob(blob, 'finances.xlsx');
      setIsExportModalOpen(false);
      toast.success('XLSX сохранен.');
    } catch (err) {
      handleError(err);
    }
  };

  const exportFinancesCsv = async () => {
    try {
      const blob = await api.workspace.finances.export(
        'csv',
        financeFiltersToApiParams(filters),
      );
      downloadBlob(blob, 'finances.csv');
      setIsExportModalOpen(false);
      toast.success('CSV сохранен.');
    } catch (err) {
      handleError(err);
    }
  };

  const saveFinance = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!modal) return;

    const amount = parseFinanceAmountInput(modal.form.amount);
    if (
      !modal.form.dateOfPayment ||
      !modal.form.distribution_from ||
      !modal.form.distribution_to ||
      modal.form.distribution_to < modal.form.distribution_from ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      toast.error(
        'Заполните дату, корректный диапазон распределения и положительную сумму.',
      );
      return;
    }

    try {
      setIsSaving(true);
      const payload = financeFormToPayload(modal.form);
      if (modal.mode === 'create') {
        await api.workspace.finances.create(payload);
        toast.success('Платеж добавлен.');
      } else if (modal.financeId) {
        await api.workspace.finances.update(modal.financeId, payload);
        toast.success('Платёж обновлён.');
      }
      setModal(null);
      setAnalyticsRefreshKey((current) => current + 1);
      await refreshPaymentData();
    } catch (err) {
      handleError(err);
    } finally {
      setIsSaving(false);
    }
  };

  const openCreateFinanceModal = useCallback(
    async (type: FinanceType) => {
      try {
        setIsLoadingOptions(true);
        await Promise.all([
          articles.length > 0 ? Promise.resolve(articles) : loadArticles(),
          loadProjects(),
          loadEmployees(),
        ]);
        setModal({ mode: 'create', form: emptyFinanceForm(type) });
      } catch (err) {
        handleError(err);
      } finally {
        setIsLoadingOptions(false);
      }
    },
    [articles, handleError, loadArticles, loadEmployees, loadProjects],
  );

  const openEditFinanceModal = useCallback(
    async (financeId: string, form: FinanceForm) => {
      try {
        setIsLoadingOptions(true);
        await Promise.all([
          articles.length > 0 ? Promise.resolve(articles) : loadArticles(),
          loadProjects(),
          loadEmployees(),
        ]);
        setModal({ mode: 'edit', financeId, form });
      } catch (err) {
        handleError(err);
      } finally {
        setIsLoadingOptions(false);
      }
    },
    [articles, handleError, loadArticles, loadEmployees, loadProjects],
  );

  const openAnalyticsFinanceModal = useCallback(
    async (financeId: string) => {
      if (!canManage) return;

      try {
        setOpeningAnalyticsFinanceId(financeId);
        const finance = await api.workspace.finances.get(financeId);
        await openEditFinanceModal(financeId, financeToForm(finance));
      } catch (err) {
        handleError(err);
      } finally {
        setOpeningAnalyticsFinanceId(null);
      }
    },
    [canManage, handleError, openEditFinanceModal],
  );

  const deleteFinance = async () => {
    if (!deleteTarget) return;

    try {
      setIsSaving(true);
      await api.workspace.finances.delete(deleteTarget.id);
      toast.success('Платеж удален.');
      setDeleteTarget(null);
      setSelectedFinanceIds((current) =>
        current.filter((financeId) => financeId !== deleteTarget.id),
      );
      await refreshPaymentData();
    } catch (err) {
      handleError(err);
    } finally {
      setIsSaving(false);
    }
  };

  const confirmBulkAction = async () => {
    if (!bulkAction || selectedFinances.length === 0) return;

    try {
      setIsSaving(true);

      if (bulkAction === 'delete') {
        await Promise.all(
          selectedFinances.map((finance) => api.workspace.finances.delete(finance.id)),
        );
        toast.success('Выбранные платежи удалены.');
      } else {
        await Promise.all(
          selectedFinances.map((finance) =>
            api.workspace.finances.create(financeFormToPayload(financeToForm(finance))),
          ),
        );
        toast.success('Выбранные платежи продублированы.');
      }

      setBulkAction(null);
      setSelectedFinanceIds([]);
      await refreshPaymentData();
    } catch (err) {
      handleError(err);
    } finally {
      setIsSaving(false);
    }
  };

  const onLoadImportFile = async (ext: string, file: File) => {
    if (ext === 'xlsx' || ext === 'xls') {
      const res = await parseXLSX(file);
      return res;
    }

    if (ext === 'csv') {
      const res = await parseCSV(file);
      return res;
    }
    return '';
  };

  if (!canView) {
    return (
      <div className='rounded-xl border border-[#e3e9f3] bg-white p-4 text-sm text-[#7e8fb4]'>
        У вас нет доступа к финансам.
      </div>
    );
  }

  return (
    <>
      <div className='grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2 xl:grid-cols-[210px_minmax(0,1fr)] xl:grid-rows-1'>
        <FinanceSidebar
          activeView={activeView}
          viewHref={financeViewHref}
          onViewChange={updateActiveView}
          lockedViews={lockedFinanceViews}
        />
        {activeView === 'payments' ? (
          <FinancesPaymentsPanel
            finances={finances}
            plannedExpenses={plannedExpensePayments}
            filters={filters}
            summary={paymentSummary}
            articles={filteredArticles}
            projectOptions={projectOptions}
            clientOptions={clientOptions}
            employeeOptions={employeeOptions}
            isLoadingProjects={isLoadingProjects}
            isLoadingClients={isLoadingClients}
            isLoadingEmployees={isLoadingEmployees}
            isLoading={isLoading}
            isLoadingSummary={isLoadingPaymentSummary}
            isLoadingPlannedExpenses={isLoadingPlannedExpenses}
            showPlannedExpenses={isShowingPlannedExpenses}
            canManage={canManage}
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            selectedFinanceIds={selectedFinanceIds}
            onCreateEntrance={() => openCreateFinanceModal('ENTRANCE')}
            onCreateExpenditure={() => openCreateFinanceModal('EXPENDITURE')}
            onImportFinances={() => setIsImportModalOpen(true)}
            onExportFinances={() => setIsExportModalOpen(true)}
            onTogglePlannedExpenses={
              isAnalyticsLocked
                ? undefined
                : () => setShowPlannedExpenses((current) => !current)
            }
            onFiltersChange={updateFilters}
            onOpenProjects={() => loadProjects().catch(handleError)}
            onOpenClients={() => loadClients().catch(handleError)}
            onOpenEmployees={() => loadEmployees().catch(handleError)}
            onSelectedFinanceIdsChange={setSelectedFinanceIds}
            onDuplicateSelected={() => setBulkAction('duplicate')}
            onDeleteSelected={() => setBulkAction('delete')}
            onEditFinance={(financeId, form) => openEditFinanceModal(financeId, form)}
            onDeleteFinance={setDeleteTarget}
            onPageChange={setCurrentPage}
            onPageSizeChange={onPageSizeChange}
          />
        ) : activeView === 'financial-results' && isFinancialResultsLocked ? (
          <ProFeatureLock feature='project_economics' screen='financial_results' />
        ) : activeView === 'analytics' && isAnalyticsLocked ? (
          <ProFeatureLock feature='finance_analytics' screen='finance_analytics' />
        ) : activeView === 'financial-results' ? (
          <FinancialResultsPanel
            projects={projects}
            clients={clients}
            articles={articles}
            employees={employees}
            isLoadingOptions={isLoadingOptions}
          />
        ) : activeView === 'analytics' ? (
          <FinanceAnalyticsPanel
            projects={projects}
            clients={clients}
            isLoadingOptions={isLoadingOptions}
            refreshKey={analyticsRefreshKey}
            openingFinanceId={openingAnalyticsFinanceId}
            onOpenFinance={canManage ? openAnalyticsFinanceModal : undefined}
          />
        ) : (
          <FinanceSettings canManageArticles={canManage} onArticlesChange={setArticles} />
        )}
      </div>

      {modal ? (
        <FinanceModal
          title={
            modal.mode === 'create'
              ? FINANCE_TYPE_NEW_TITLES[modal.form.type]
              : 'Редактировать платеж'
          }
          submitLabel={modal.mode === 'create' ? 'Добавить платеж' : 'Сохранить'}
          isSaving={isSaving}
          form={modal.form}
          articles={articles}
          projects={projects}
          employees={employees}
          onChange={(form) => setModal({ ...modal, form })}
          onManageArticles={(type) => setArticlesManager({ defaultType: type })}
          onClose={() => setModal(null)}
          onSubmit={saveFinance}
        />
      ) : null}

      <ImportDataModal
        isOpen={isImportModalOpen}
        title='Импорт финансов'
        importType='FINANCES'
        isImportDisabled={false}
        acceptedFormats={['.xlsx', '.xls', '.csv']}
        templateFiles={FINANCE_IMPORT_TEMPLATES}
        isLoading={isImportingFinances}
        onClose={() => setIsImportModalOpen(false)}
        onImport={importFinances}
        onLoadFile={onLoadImportFile}
      />

      <ExportDataModal
        isOpen={isExportModalOpen}
        title='Экспорт финансов'
        isExportDisabled={finances.length === 0}
        onClose={() => setIsExportModalOpen(false)}
        onExportXlsx={exportFinancesXlsx}
        onExportCsv={exportFinancesCsv}
      />

      <ImportErrorsModal
        isOpen={importReport.errors.length > 0 || importReport.warnings.length > 0}
        title='Отчёт импорта финансов'
        errors={importReport.errors}
        warnings={importReport.warnings}
        fileName='finances_import_errors.txt'
        onClose={() => setImportReport({ errors: [], warnings: [] })}
      />

      {articlesManager ? (
        <div className='fixed inset-0 z-1100 grid place-items-center bg-slate-900/45 p-2 text-[#1f3565] md:p-4'>
          <div className='flex max-h-[calc(100dvh-1rem)] w-full max-w-220 flex-col overflow-hidden rounded-xl border border-[#e3e9f3] bg-white p-3 shadow-2xl shadow-slate-900/25 md:max-h-[90vh] md:rounded-2xl md:p-4'>
            <div className='mb-4 flex items-center justify-between gap-3'>
              <h2 className='text-base font-semibold text-[#10275a]'>Настройка статей</h2>
              <Button
                type='button'
                variant='secondary'
                size='sm'
                onClick={() => setArticlesManager(null)}
              >
                Закрыть
              </Button>
            </div>
            <FinanceArticlesSettings
              key={`finance-articles-manager-${articlesManager.defaultType}`}
              canManage={canManage}
              embedded
              initialType={articlesManager.defaultType}
              onArticlesChange={setArticles}
            />
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        isProcessing={isSaving}
        title='Удалить платеж?'
        message='Платеж будет удален безвозвратно.'
        confirmLabel='Удалить'
        onClose={() => setDeleteTarget(null)}
        onConfirm={deleteFinance}
      />

      <ConfirmDialog
        isOpen={Boolean(bulkAction)}
        isProcessing={isSaving}
        danger={bulkAction === 'delete'}
        title={
          bulkAction === 'delete' ? 'Удалить выбранные платежи?' : 'Дублировать платежи?'
        }
        message={
          bulkAction === 'delete'
            ? `Выбранные платежи будут удалены безвозвратно. Количество: ${selectedFinances.length}.`
            : `Будут созданы копии выбранных платежей. Количество: ${selectedFinances.length}.`
        }
        confirmLabel={bulkAction === 'delete' ? 'Удалить' : 'Дублировать'}
        processingLabel={bulkAction === 'delete' ? 'Удаление...' : 'Дублирование...'}
        onClose={() => setBulkAction(null)}
        onConfirm={confirmBulkAction}
      />
    </>
  );
}
