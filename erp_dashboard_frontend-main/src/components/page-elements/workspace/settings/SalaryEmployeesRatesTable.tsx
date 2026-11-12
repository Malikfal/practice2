import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';

import { api } from '../../../../api/api';
import { ApiRequestError } from '../../../../api/core/error';
import type {
  EmployeeRate,
  EmployeeRateEmployeeRow,
  EmployeeRateForm,
  EmployeeRateType,
  FinanceSettings,
  User,
} from '../../../../types/app';
import { formatName, formatDateLocal } from '../../../../utils/formatters';
import ConfirmDialog from '../../../modals/ConfirmDialog';
import TablePagination from '../../../ui/TablePagination';
import {
  Table,
  TableActionButton,
  TableActions,
  TableContainer,
  TableEmptyRow,
  TableLoadingRow,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  useTableSort,
} from '../../../ui/table';
import Icon from '../employees/components/Icon';
import { EmployeeRateDetailsModal } from '../employees/EmployeeDetailsPanel/components/payroll/EmployeeRateDetailsModal';
import {
  RateChangeModal,
  type RateFieldErrors,
} from '../employees/EmployeeDetailsPanel/components/payroll/RateChangeModal';
import { RateHistoryModal } from '../employees/EmployeeDetailsPanel/components/payroll/RateHistoryModal';
import {
  formatProjectRatesNote,
  formatRateValue,
  isAdvancedRateSetting,
  nextRateEffectiveFromInputValue,
  rateFormFromRate,
  validateRateForm,
} from '../employees/EmployeeDetailsPanel/components/payroll/payrollUtils';
import { SalaryFinanceArticleSelect } from '../employees/EmployeeDetailsPanel/components/payroll/SalaryFinanceArticleSelect';
import { useEmployeePayrollSettings } from '../employees/EmployeeDetailsPanel/components/payroll/payrollSettingsHooks';

type Props = {
  canManageRates: boolean;
  financeSettings: FinanceSettings | null;
  refreshVersion?: number;
};

type LoadingAction = 'history' | 'create';

const DEFAULT_PAGE_SIZE = 100;
const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100, 1000];

type EmployeeRateSortKey =
  | 'employee'
  | 'role'
  | 'position'
  | 'effective_from'
  | 'salary'
  | 'hourly_rate'
  | 'supervised_hourly_rate'
  | 'company_hourly_rate'
  | 'finance_article';

// Ширины колонок в сумме ~1300px: таблица помещается в карточку от ~1830px экрана,
// уже — прокручивается, а колонка «Сотрудник» остаётся закреплённой слева.
const SORTABLE_COLUMNS: Array<{
  key: EmployeeRateSortKey;
  label: string;
  width: string;
  numeric?: boolean;
}> = [
  { key: 'employee', label: 'Сотрудник', width: 'w-[140px]' },
  { key: 'role', label: 'Роль', width: 'w-[108px]' },
  { key: 'position', label: 'Должность', width: 'w-[120px]' },
  { key: 'effective_from', label: 'Действует с', width: 'w-[132px]' },
  { key: 'salary', label: 'Оклад', width: 'w-[116px]', numeric: true },
  { key: 'hourly_rate', label: 'Час', width: 'w-[116px]', numeric: true },
  {
    key: 'supervised_hourly_rate',
    label: 'Под контролем',
    width: 'w-[124px]',
    numeric: true,
  },
  { key: 'company_hourly_rate', label: 'Компания', width: 'w-[116px]', numeric: true },
  { key: 'finance_article', label: 'Финансовая статья', width: 'w-[220px]' },
];

const RATE_CELL_BUTTON_CLASS =
  'w-full rounded-lg px-2 py-1 text-right tabular-nums transition-colors hover:bg-[#edf3ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2d6ff7]';

function extractRateFieldErrors(error: ApiRequestError): RateFieldErrors {
  const allowedFields = new Set<keyof EmployeeRateForm>([
    'salary',
    'salary_distribution_scope',
    'hourly_rate',
    'supervised_hourly_rate',
    'company_hourly_rate',
    'exclude_from_supervised_hours',
    'effective_from',
    'rate_settings',
  ]);
  const fieldErrors: RateFieldErrors = {};

  for (const [field, messages] of Object.entries(error.body.errors ?? {})) {
    if (field === 'rate' && messages[0]) {
      fieldErrors.rate = messages[0];
      continue;
    }

    const normalizedField = field.split('.')[0] as keyof EmployeeRateForm;
    const firstMessage = messages[0];

    if (allowedFields.has(normalizedField) && firstMessage) {
      fieldErrors[normalizedField] = firstMessage;
    }
  }

  return fieldErrors;
}

function getEmployeeDisplayName(employee: User) {
  return formatName(employee) || employee.email || 'Сотрудник';
}

function emptyText(value?: string | null) {
  const normalized = value?.trim();

  return normalized && normalized !== 'Не указано' ? normalized : '—';
}

function HistoryIcon() {
  return (
    <svg
      viewBox='0 0 24 24'
      className='size-5 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]'
      aria-hidden='true'
    >
      <path d='M3 12a9 9 0 1 0 3-6.7' />
      <path d='M3 4v5h5' />
      <path d='M12 7v5l3 2' />
    </svg>
  );
}

function RateCell({
  rate,
  rateType,
  noRateText = '—',
}: {
  rate: EmployeeRate | null;
  rateType: EmployeeRateType;
  noRateText?: string;
}) {
  if (!rate) return <span>{noRateText}</span>;

  if (isAdvancedRateSetting(rate, rateType)) {
    const projectRatesNote = formatProjectRatesNote(rate, rateType);

    return (
      <span className='grid gap-0.5' title='Нажмите, чтобы открыть ставку'>
        <span className='font-semibold text-[#2d6ff7]'>Продвинутая ставка</span>
        {projectRatesNote ? (
          <span className='text-[11px] font-semibold text-[#2d6ff7]'>
            {projectRatesNote}
          </span>
        ) : null}
      </span>
    );
  }

  const value = formatRateValue(rate, rateType);
  const projectRatesNote = formatProjectRatesNote(rate, rateType);

  return (
    <span className='grid gap-0.5'>
      <span>{value === 'Не указано' ? '—' : value}</span>
      {projectRatesNote ? (
        <span className='text-[11px] font-semibold text-[#2d6ff7]'>
          {projectRatesNote}
        </span>
      ) : null}
    </span>
  );
}

function EmployeeFinanceArticleCell({
  employee,
  financeSettings,
  canManage,
  onSaved,
}: {
  employee: User;
  financeSettings: FinanceSettings | null;
  canManage: boolean;
  onSaved: (_employeeId: string, _articleId: string | null) => void;
}) {
  const { articleId, isSaving, fieldError, updateArticle } = useEmployeePayrollSettings(
    employee.id,
    {
      initialArticleId: employee.salary_finance_article_id ?? null,
      load: false,
    },
  );

  return (
    <div className='w-full min-w-0'>
      <SalaryFinanceArticleSelect
        value={articleId}
        settings={financeSettings}
        isSaving={isSaving}
        error={fieldError}
        disabled={!canManage}
        compact
        onChange={async (nextArticleId) => {
          const saved = await updateArticle(nextArticleId);
          if (saved) onSaved(employee.id, saved.salary_finance_article_id);
        }}
      />
    </div>
  );
}

export default function SalaryEmployeesRatesTable({
  canManageRates,
  financeSettings,
  refreshVersion = 0,
}: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [rows, setRows] = useState<EmployeeRateEmployeeRow[]>([]);
  const [isLoadingRows, setIsLoadingRows] = useState(false);
  const [tableMeta, setTableMeta] = useState({
    current_page: 1,
    last_page: 1,
    per_page: DEFAULT_PAGE_SIZE,
    total: 0,
  });
  const [rateHistory, setRateHistory] = useState<EmployeeRate[]>([]);
  const [historyEmployee, setHistoryEmployee] = useState<User | null>(null);
  const [selectedRateDetails, setSelectedRateDetails] = useState<EmployeeRate | null>(
    null,
  );
  const [editingEmployee, setEditingEmployee] = useState<User | null>(null);
  const [editingRate, setEditingRate] = useState<EmployeeRate | null>(null);
  const [minRateEffectiveFrom, setMinRateEffectiveFrom] = useState<string>();
  const [rateForm, setRateForm] = useState<EmployeeRateForm>(() =>
    rateFormFromRate(null),
  );
  const [rateErrors, setRateErrors] = useState<RateFieldErrors>({});
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [rateModalInitialType, setRateModalInitialType] =
    useState<EmployeeRateType>('WEEKLY_SALARY');
  const [isRateWarningOpen, setIsRateWarningOpen] = useState(false);
  const [loadingAction, setLoadingAction] = useState<{
    employeeId: string;
    action: LoadingAction;
  } | null>(null);
  const [isSavingRate, setIsSavingRate] = useState(false);
  const [deleteRateCandidate, setDeleteRateCandidate] = useState<EmployeeRate | null>(
    null,
  );
  const [deletingRateId, setDeletingRateId] = useState<string | null>(null);
  const { sort, toggleSort, directionOf } = useTableSort<EmployeeRateSortKey>();
  const employeeById = useMemo(() => {
    const map = new Map<string, User>();

    for (const row of rows) {
      map.set(row.employee.id, row.employee);
    }

    return map;
  }, [rows]);

  const loadEmployeeRateRows = useCallback(async () => {
    setIsLoadingRows(true);

    try {
      const response = await api.workspace.employeeRates.getMany({
        search: debouncedSearchQuery.trim(),
        page: currentPage,
        per_page: pageSize,
        ...(sort.key ? { sort_by: sort.key, sort_direction: sort.direction } : {}),
      });

      setRows(response.data ?? []);
      setTableMeta({
        current_page: response.meta?.current_page ?? currentPage,
        last_page: response.meta?.last_page ?? 1,
        per_page: response.meta?.per_page ?? pageSize,
        total: response.meta?.total ?? response.data?.length ?? 0,
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось загрузить ставки.',
      );
      setRows([]);
      setTableMeta({
        current_page: currentPage,
        last_page: 1,
        per_page: pageSize,
        total: 0,
      });
    } finally {
      setIsLoadingRows(false);
    }
  }, [currentPage, debouncedSearchQuery, pageSize, sort.key, sort.direction]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setCurrentPage(1);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    void loadEmployeeRateRows();
  }, [loadEmployeeRateRows, refreshVersion]);

  const openRateModal = async (
    employee: User,
    initialRateType: EmployeeRateType = 'WEEKLY_SALARY',
  ) => {
    if (!canManageRates) {
      toast.error('Недостаточно прав для изменения ставки.');
      return;
    }

    setLoadingAction({ employeeId: employee.id, action: 'create' });

    try {
      const rates = await api.workspace.employeeRates.getForEmployee(employee.id);
      const latestRate = rates[0] ?? null;
      const minEffectiveFrom = nextRateEffectiveFromInputValue(latestRate);

      setRateHistory(rates);
      setEditingEmployee(employee);
      setEditingRate(null);
      setMinRateEffectiveFrom(minEffectiveFrom);
      setRateModalInitialType(initialRateType);
      setRateErrors({});
      setRateForm({
        ...rateFormFromRate(latestRate),
        ...(minEffectiveFrom ? { effective_from: minEffectiveFrom } : {}),
      });
      setIsRateModalOpen(true);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось загрузить историю ставок.',
      );
    } finally {
      setLoadingAction(null);
    }
  };

  const openCurrentRateDetails = (rate: EmployeeRate | null) => {
    if (!rate) {
      toast.info('Текущая ставка не настроена.');
      return;
    }

    setSelectedRateDetails(rate);
  };

  const openRateHistory = async (employee: User) => {
    setLoadingAction({ employeeId: employee.id, action: 'history' });

    try {
      const rates = await api.workspace.employeeRates.getForEmployee(employee.id);
      setRateHistory(rates);
      setHistoryEmployee(employee);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось загрузить историю ставок.',
      );
    } finally {
      setLoadingAction(null);
    }
  };

  const openRateEditFromHistory = (rate: EmployeeRate) => {
    const employee = historyEmployee ?? employeeById.get(rate.employee_id) ?? null;

    if (!employee) {
      toast.error('Сотрудник не найден.');
      return;
    }

    if (rateHistory[0]?.id !== rate.id) {
      toast.error('Можно изменять или удалять только последнюю ставку сотрудника.');
      return;
    }

    setEditingEmployee(employee);
    setEditingRate(rate);
    setMinRateEffectiveFrom(undefined);
    setRateModalInitialType('WEEKLY_SALARY');
    setRateErrors({});
    setRateForm(rateFormFromRate(rate, { preserveEffectiveFrom: true }));
    setHistoryEmployee(null);
    setIsRateModalOpen(true);
  };

  const submitRate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRateErrors({});

    if (!canManageRates) {
      toast.error('Недостаточно прав для изменения ставки.');
      return;
    }

    const validationError = validateRateForm(rateForm);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsRateWarningOpen(true);
  };

  const saveRate = async () => {
    if (!editingEmployee) return;

    const validationError = validateRateForm(rateForm);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsSavingRate(true);
    setRateErrors({});

    try {
      if (editingRate) {
        await api.workspace.employeeRates.update(editingRate.id, rateForm);
      } else {
        await api.workspace.employeeRates.createForEmployee(editingEmployee.id, rateForm);
      }

      const rates = await api.workspace.employeeRates.getForEmployee(editingEmployee.id);
      setRateHistory(rates);
      await loadEmployeeRateRows();
      setIsRateModalOpen(false);
      setIsRateWarningOpen(false);
      setEditingEmployee(null);
      setEditingRate(null);
      toast.success('Ставка сохранена.');
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 422) {
        setRateErrors(extractRateFieldErrors(error));
        setIsRateWarningOpen(false);
      }

      toast.error(
        error instanceof Error ? error.message : 'Не удалось сохранить ставку.',
      );
    } finally {
      setIsSavingRate(false);
    }
  };

  const deleteRate = async () => {
    if (!deleteRateCandidate) return;

    if (rateHistory[0]?.id !== deleteRateCandidate.id) {
      toast.error('Можно изменять или удалять только последнюю ставку сотрудника.');
      setDeleteRateCandidate(null);
      return;
    }

    if (rateHistory.length <= 1) {
      toast.error('Нельзя удалить единственную ставку сотрудника.');
      setDeleteRateCandidate(null);
      return;
    }

    setDeletingRateId(deleteRateCandidate.id);

    try {
      await api.workspace.employeeRates.delete(deleteRateCandidate.id);
      const rates = await api.workspace.employeeRates.getForEmployee(
        deleteRateCandidate.employee_id,
      );
      setRateHistory(rates);
      await loadEmployeeRateRows();
      setDeleteRateCandidate(null);
      toast.success('Ставка удалена.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось удалить ставку.');
    } finally {
      setDeletingRateId(null);
    }
  };

  const closeRateModal = () => {
    if (isSavingRate) return;

    setIsRateModalOpen(false);
    setIsRateWarningOpen(false);
    setEditingEmployee(null);
    setEditingRate(null);
    setMinRateEffectiveFrom(undefined);
    setRateErrors({});
  };

  const handleSearchQueryChange = (value: string) => {
    setSearchQuery(value);
  };

  const handlePageSizeChange = (nextPageSize: number) => {
    setPageSize(nextPageSize);
    setCurrentPage(1);
  };

  const totalPages = Math.max(tableMeta.last_page || 1, 1);
  const safeCurrentPage = Math.min(tableMeta.current_page || currentPage, totalPages);

  const isActionLoading = (employee: User, action: LoadingAction) =>
    loadingAction?.employeeId === employee.id && loadingAction.action === action;

  return (
    <section className='grid gap-4 rounded-xl border border-[#e3e9f3] bg-[#fbfcff] p-3 md:p-4'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div className='grid gap-1'>
          <h2 className='text-[18px] leading-tight font-semibold text-[#10275a] md:text-[20px] md:leading-none'>
            Свод по оплате труда
          </h2>
          <p className='text-[13px] leading-6 text-[#7082a8]'>
            Выберите действие по сотруднику: изменить ставку, открыть историю или
            посмотреть текущую ставку.
          </p>
        </div>

        <label className='flex h-11 w-full max-w-[360px] items-center gap-2 rounded-xl border border-[#dce7ff] bg-white px-3 text-[14px] text-[#7e8fb4] md:h-10'>
          <Icon name='search' />
          <input
            value={searchQuery}
            onChange={(event) => handleSearchQueryChange(event.target.value)}
            placeholder='Поиск по сотрудникам'
            className='min-w-0 flex-1 border-0 bg-transparent p-0 text-base text-[#1f3565] outline-none placeholder:text-[#7e8fb4] md:text-[14px]'
          />
        </label>
      </div>

      <TableContainer className='min-h-[220px]'>
        <Table fixed className='[&_td]:[overflow-wrap:break-word]'>
          <THead sticky>
            <tr>
              {SORTABLE_COLUMNS.map((column) => (
                <Th
                  key={column.key}
                  numeric={column.numeric}
                  pin={column.key === 'employee' ? 'left' : undefined}
                  className={column.width}
                  sortDirection={directionOf(column.key)}
                  onSort={() => {
                    toggleSort(column.key);
                    setCurrentPage(1);
                  }}
                >
                  {column.label}
                </Th>
              ))}
              <Th align='center' className='w-[120px]'>
                Действия
              </Th>
            </tr>
          </THead>
          <TBody>
            {isLoadingRows ? (
              <TableLoadingRow />
            ) : rows.length ? (
              rows.map(({ employee, current_rate: currentRate }) => {
                return (
                  <Tr key={employee.id}>
                    <Td pin='left' className='font-semibold text-[#10275a]'>
                      {getEmployeeDisplayName(employee)}
                    </Td>
                    <Td>{emptyText(employee.role_label || employee.role)}</Td>
                    <Td>{emptyText(employee.position)}</Td>
                    <Td className='whitespace-nowrap'>
                      {formatDateLocal(
                        currentRate?.effective_from ||
                          currentRate?.updated_at ||
                          currentRate?.created_at,
                      )}
                    </Td>
                    <Td align='right' className='px-1!'>
                      <button
                        type='button'
                        className={RATE_CELL_BUTTON_CLASS}
                        onClick={() => void openRateModal(employee, 'WEEKLY_SALARY')}
                      >
                        <RateCell rate={currentRate} rateType='WEEKLY_SALARY' />
                      </button>
                    </Td>
                    <Td align='right' className='px-1!'>
                      <button
                        type='button'
                        className={RATE_CELL_BUTTON_CLASS}
                        onClick={() => void openRateModal(employee, 'HOURLY')}
                      >
                        <RateCell rate={currentRate} rateType='HOURLY' />
                      </button>
                    </Td>
                    <Td align='right' className='px-1!'>
                      <button
                        type='button'
                        className={RATE_CELL_BUTTON_CLASS}
                        onClick={() => void openRateModal(employee, 'SUPERVISED_HOURLY')}
                      >
                        <RateCell rate={currentRate} rateType='SUPERVISED_HOURLY' />
                      </button>
                    </Td>
                    <Td align='right' className='px-1!'>
                      <button
                        type='button'
                        className={RATE_CELL_BUTTON_CLASS}
                        onClick={() => void openRateModal(employee, 'COMPANY_HOURLY')}
                      >
                        <RateCell rate={currentRate} rateType='COMPANY_HOURLY' />
                      </button>
                    </Td>
                    <Td>
                      <EmployeeFinanceArticleCell
                        employee={employee}
                        financeSettings={financeSettings}
                        canManage={canManageRates}
                        onSaved={(employeeId, articleId) =>
                          setRows((current) =>
                            current.map((row) =>
                              row.employee.id === employeeId
                                ? {
                                    ...row,
                                    employee: {
                                      ...row.employee,
                                      salary_finance_article_id: articleId,
                                    },
                                  }
                                : row,
                            ),
                          )
                        }
                      />
                    </Td>
                    <Td align='center' className='px-2!'>
                      <TableActions>
                        <TableActionButton
                          label='Добавить ставку'
                          disabled={!canManageRates || Boolean(loadingAction)}
                          onClick={() => void openRateModal(employee)}
                        >
                          <Icon name='edit' />
                        </TableActionButton>
                        <TableActionButton
                          label={
                            isActionLoading(employee, 'history')
                              ? 'Загрузка истории...'
                              : 'История изменений ставки'
                          }
                          disabled={Boolean(loadingAction)}
                          onClick={() => void openRateHistory(employee)}
                        >
                          <HistoryIcon />
                        </TableActionButton>
                        <TableActionButton
                          label='Текущая ставка'
                          disabled={!currentRate || Boolean(loadingAction)}
                          onClick={() => openCurrentRateDetails(currentRate)}
                        >
                          <Icon name='search' />
                        </TableActionButton>
                      </TableActions>
                    </Td>
                  </Tr>
                );
              })
            ) : (
              <TableEmptyRow>Сотрудники не найдены</TableEmptyRow>
            )}
          </TBody>
        </Table>
      </TableContainer>

      <TablePagination
        currentPage={safeCurrentPage}
        totalPages={totalPages}
        pageSize={tableMeta.per_page || pageSize}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        onPageChange={setCurrentPage}
        onPageSizeChange={handlePageSizeChange}
      />

      <RateChangeModal
        key={isRateModalOpen ? 'open' : 'closed'}
        isOpen={isRateModalOpen}
        form={rateForm}
        initialRateType={rateModalInitialType}
        isSaving={isSavingRate}
        errors={rateErrors}
        isEditing={Boolean(editingRate)}
        minEffectiveFrom={editingRate ? undefined : minRateEffectiveFrom}
        onFormChange={(nextForm) => {
          setRateForm(nextForm);
          setRateErrors({});
        }}
        onSubmit={submitRate}
        onClose={closeRateModal}
      />
      <ConfirmDialog
        isOpen={isRateWarningOpen}
        isProcessing={isSavingRate}
        title='Изменение ставок'
        message={
          <div className='grid gap-2'>
            <p>
              {editingRate
                ? 'Сохранить изменения последней ставки?'
                : 'Создать новую ставку с выбранной даты?'}
            </p>
            <p>
              Проверьте, что вы изменили все ставки и расширенные формулы, которые должны
              действовать с выбранной даты.
            </p>
          </div>
        }
        confirmLabel='Сохранить ставки'
        cancelLabel='Отмена'
        processingLabel='Сохранение...'
        danger={false}
        onClose={() => {
          if (!isSavingRate) setIsRateWarningOpen(false);
        }}
        onConfirm={() => void saveRate()}
      />
      <RateHistoryModal
        isOpen={Boolean(historyEmployee)}
        rates={rateHistory}
        isLoading={false}
        canManageRates={canManageRates}
        deletingRateId={deletingRateId}
        onEditRate={openRateEditFromHistory}
        onDeleteRate={setDeleteRateCandidate}
        onClose={() => setHistoryEmployee(null)}
      />
      <ConfirmDialog
        isOpen={Boolean(deleteRateCandidate)}
        isProcessing={Boolean(deletingRateId)}
        title='Удаление ставки'
        message={
          <div className='grid gap-2'>
            <p>
              Удалить ставку с датой начала действия{' '}
              <strong>{deleteRateCandidate?.effective_from ?? 'не указано'}</strong>?
            </p>
            <p>
              Удалить можно только последнюю ставку, если у сотрудника останется хотя бы
              одна ставка.
            </p>
          </div>
        }
        confirmLabel='Удалить ставку'
        cancelLabel='Отмена'
        processingLabel='Удаление...'
        onClose={() => {
          if (!deletingRateId) setDeleteRateCandidate(null);
        }}
        onConfirm={() => void deleteRate()}
      />
      <EmployeeRateDetailsModal
        rate={selectedRateDetails}
        title='Текущая ставка'
        onClose={() => setSelectedRateDetails(null)}
      />
    </section>
  );
}
