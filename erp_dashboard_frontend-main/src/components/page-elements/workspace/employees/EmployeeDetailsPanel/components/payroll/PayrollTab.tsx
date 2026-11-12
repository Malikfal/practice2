import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';

import { api } from '../../../../../../../api/api';
import { ApiRequestError } from '../../../../../../../api/core/error';
import { useAppControllerContext } from '../../../../../../../context/AppControllerContext';
import type {
  EmployeePayrollCalculationRow,
  EmployeeRate,
  EmployeeRateForm,
  User,
} from '../../../../../../../types/app';
import ConfirmDialog from '../../../../../../modals/ConfirmDialog';

import { PAYROLL_ROWS_PER_PAGE } from './constants';
import { EmployeeRateDetailsModal } from './EmployeeRateDetailsModal';
import { PayrollCalculationDetailsModal } from './PayrollCalculationDetailsModal';
import {
  BankDetailsSection,
  CurrentRatesSection,
  PayrollCalculationsSection,
  PayrollHeader,
  SalaryFinanceArticleSection,
} from './PayrollSections';
import { ProjectRatesNote } from './ProjectRatesNote';
import { RateChangeModal, type RateFieldErrors } from './RateChangeModal';
import { RateHistoryModal } from './RateHistoryModal';
import {
  useEmployeePayrollSettings,
  useSalaryFinanceSettings,
} from './payrollSettingsHooks';
import { payrollPeriodKey, usePayrollRecalculations } from './usePayrollRecalculations';
import {
  advancedRateSettingsCount,
  formatPeriod,
  formatRateValue,
  rateFormFromRate,
  isAdvancedRateSetting,
  projectRatesCount,
  nextRateEffectiveFromInputValue,
  validateRateForm,
} from './payrollUtils';

type Props = {
  employee: User;
  canChangeRate?: boolean;
  canEditBankDetails?: boolean;
};

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

export default function PayrollTab({
  employee,
  canChangeRate = true,
  canEditBankDetails = true,
}: Props) {
  const { user } = useAppControllerContext();
  const permissionNames = user?.permissions ?? [];
  const canManageRate = permissionNames.includes('employees.tabs.salary.view');
  const canManageRecalculation = permissionNames.includes('finance.manage');
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [isRateWarningOpen, setIsRateWarningOpen] = useState(false);
  const [isRateHistoryModalOpen, setIsRateHistoryModalOpen] = useState(false);
  const [currentRate, setCurrentRate] = useState<EmployeeRate | null>(null);
  const [rateHistory, setRateHistory] = useState<EmployeeRate[]>([]);
  const [selectedRateDetails, setSelectedRateDetails] = useState<EmployeeRate | null>(
    null,
  );
  const [editingRate, setEditingRate] = useState<EmployeeRate | null>(null);
  const [minRateEffectiveFrom, setMinRateEffectiveFrom] = useState<string>();
  const [deleteRateCandidate, setDeleteRateCandidate] = useState<EmployeeRate | null>(
    null,
  );
  const [payrollRows, setPayrollRows] = useState<EmployeePayrollCalculationRow[]>([]);
  const [selectedPayrollDetails, setSelectedPayrollDetails] =
    useState<EmployeePayrollCalculationRow | null>(null);
  const [recalculationCandidate, setRecalculationCandidate] =
    useState<EmployeePayrollCalculationRow | null>(null);
  const [payrollQuery, setPayrollQuery] = useState(() => ({
    employeeId: employee.id,
    page: 1,
  }));
  const [payrollMeta, setPayrollMeta] = useState({
    current_page: 1,
    last_page: 1,
    per_page: PAYROLL_ROWS_PER_PAGE,
    total: 0,
  });
  const [rateForm, setRateForm] = useState<EmployeeRateForm>(() =>
    rateFormFromRate(null),
  );
  const [rateErrors, setRateErrors] = useState<RateFieldErrors>({});
  const [bankDetails, setBankDetails] = useState('');
  const [isLoadingRates, setIsLoadingRates] = useState(false);
  const [isLoadingBankDetails, setIsLoadingBankDetails] = useState(false);
  const [isLoadingPayrollRows, setIsLoadingPayrollRows] = useState(false);
  const [isSavingRate, setIsSavingRate] = useState(false);
  const [deletingRateId, setDeletingRateId] = useState<string | null>(null);
  const [isSavingBankDetails, setIsSavingBankDetails] = useState(false);
  const { settings: financeSettings, isLoading: isLoadingFinanceSettings } =
    useSalaryFinanceSettings(canManageRate);
  const {
    articleId: salaryFinanceArticleId,
    isLoading: isLoadingPayrollSettings,
    isSaving: isSavingPayrollSettings,
    fieldError: payrollSettingsFieldError,
    updateArticle: updateSalaryFinanceArticle,
  } = useEmployeePayrollSettings(employee.id, { load: canManageRate });

  const refreshRatesAndPayroll = useCallback(async () => {
    const [current, history, payroll] = await Promise.all([
      api.workspace.employeeRates.getCurrentForEmployee(employee.id),
      api.workspace.employeeRates.getForEmployee(employee.id),
      api.workspace.employeePayrollCalculations.getForEmployee(employee.id, {
        page: payrollQuery.page,
        per_page: PAYROLL_ROWS_PER_PAGE,
      }),
    ]);

    setCurrentRate(current);
    setRateHistory(history);
    setPayrollRows(payroll.data ?? []);
    setPayrollMeta({
      current_page: payroll.meta?.current_page ?? payrollQuery.page,
      last_page: payroll.meta?.last_page ?? 1,
      per_page: payroll.meta?.per_page ?? PAYROLL_ROWS_PER_PAGE,
      total: payroll.meta?.total ?? payroll.data?.length ?? 0,
    });
    setRateForm(rateFormFromRate(current));
  }, [employee.id, payrollQuery.page]);

  useEffect(() => {
    setPayrollQuery((current) =>
      current.employeeId === employee.id ? current : { employeeId: employee.id, page: 1 },
    );
  }, [employee.id]);

  useEffect(() => {
    let ignore = false;

    const loadRates = async () => {
      setIsLoadingRates(true);

      try {
        const [current, history] = await Promise.all([
          api.workspace.employeeRates.getCurrentForEmployee(employee.id),
          api.workspace.employeeRates.getForEmployee(employee.id),
        ]);

        if (!ignore) {
          setCurrentRate(current);
          setRateHistory(history);
          setRateForm(rateFormFromRate(current));
        }
      } catch (error) {
        if (!ignore) {
          toast.error(
            error instanceof Error ? error.message : 'Не удалось загрузить ставки.',
          );
        }
      } finally {
        if (!ignore) setIsLoadingRates(false);
      }
    };

    void loadRates();

    return () => {
      ignore = true;
    };
  }, [employee.id]);

  const loadPayrollRows = useCallback(async () => {
    if (payrollQuery.employeeId !== employee.id) return;

    setIsLoadingPayrollRows(true);

    try {
      const payroll = await api.workspace.employeePayrollCalculations.getForEmployee(
        employee.id,
        {
          page: payrollQuery.page,
          per_page: PAYROLL_ROWS_PER_PAGE,
        },
      );
      const nextRows = payroll.data ?? [];

      setPayrollRows(nextRows);
      setSelectedPayrollDetails((current) =>
        current
          ? (nextRows.find(
              (row) =>
                row.period_from === current.period_from &&
                row.period_to === current.period_to,
            ) ?? null)
          : null,
      );
      setPayrollMeta({
        current_page: payroll.meta?.current_page ?? payrollQuery.page,
        last_page: payroll.meta?.last_page ?? 1,
        per_page: payroll.meta?.per_page ?? PAYROLL_ROWS_PER_PAGE,
        total: payroll.meta?.total ?? nextRows.length,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Не удалось загрузить расчеты по оплате.',
      );
    } finally {
      setIsLoadingPayrollRows(false);
    }
  }, [employee.id, payrollQuery]);

  useEffect(() => {
    void loadPayrollRows();
  }, [loadPayrollRows]);

  const {
    states: recalculationStates,
    startingPeriods,
    start: startRecalculation,
  } = usePayrollRecalculations({
    rows: payrollRows,
    enabled: canManageRecalculation,
    onCompleted: loadPayrollRows,
  });

  useEffect(() => {
    let ignore = false;

    const loadBankDetails = async () => {
      setIsLoadingBankDetails(true);

      try {
        const loadedBankDetails = await api.workspace.employeeBankDetails.getForEmployee(
          employee.id,
        );

        if (!ignore) {
          setBankDetails(loadedBankDetails?.details ?? '');
        }
      } catch (error) {
        if (!ignore) {
          toast.error(
            error instanceof Error ? error.message : 'Не удалось загрузить реквизиты.',
          );
        }
      } finally {
        if (!ignore) setIsLoadingBankDetails(false);
      }
    };

    void loadBankDetails();

    return () => {
      ignore = true;
    };
  }, [employee.id]);

  const openRateModal = async () => {
    if (!canManageRate) {
      toast.error('Недостаточно прав для изменения ставки.');
      return;
    }

    setIsLoadingRates(true);

    try {
      const rates = await api.workspace.employeeRates.getForEmployee(employee.id);
      const latestRate = rates[0] ?? null;
      const minEffectiveFrom = nextRateEffectiveFromInputValue(latestRate);

      setRateHistory(rates);
      setEditingRate(null);
      setMinRateEffectiveFrom(minEffectiveFrom);
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
      setIsLoadingRates(false);
    }
  };

  const openRateEditModal = (rate: EmployeeRate) => {
    if (!canManageRate || !canChangeRate) {
      toast.error('Недостаточно прав для изменения ставки.');
      return;
    }

    if (rateHistory[0]?.id !== rate.id) {
      toast.error('Можно изменять или удалять только последнюю ставку сотрудника.');
      return;
    }

    setEditingRate(rate);
    setMinRateEffectiveFrom(undefined);
    setRateErrors({});
    setRateForm(rateFormFromRate(rate, { preserveEffectiveFrom: true }));
    setIsRateHistoryModalOpen(false);
    setIsRateModalOpen(true);
  };

  const submitRate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRateErrors({});

    if (!canManageRate) {
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
    if (!canManageRate) {
      toast.error('Недостаточно прав для изменения ставки.');
      return;
    }

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
        await api.workspace.employeeRates.createForEmployee(employee.id, rateForm);
      }
      await refreshRatesAndPayroll();
      setIsRateModalOpen(false);
      setIsRateWarningOpen(false);
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

    if (!canManageRate || !canChangeRate) {
      toast.error('Недостаточно прав для изменения ставки.');
      return;
    }

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
      await refreshRatesAndPayroll();
      setDeleteRateCandidate(null);
      toast.success('Ставка удалена.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось удалить ставку.');
    } finally {
      setDeletingRateId(null);
    }
  };

  const saveBankDetails = async () => {
    setIsSavingBankDetails(true);

    try {
      const savedBankDetails = await api.workspace.employeeBankDetails.saveForEmployee(
        employee.id,
        bankDetails,
      );

      setBankDetails(savedBankDetails.details);
      toast.success('Реквизиты сохранены.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось сохранить реквизиты.',
      );
    } finally {
      setIsSavingBankDetails(false);
    }
  };

  const rateCards = [
    {
      label: 'Оклад (неделя)',
      value: isLoadingRates
        ? 'Загрузка...'
        : formatRateValue(currentRate, 'WEEKLY_SALARY'),
      isAdvanced: isAdvancedRateSetting(currentRate, 'WEEKLY_SALARY'),
      note: isLoadingRates ? null : (
        <ProjectRatesNote rate={currentRate} rateType='WEEKLY_SALARY' />
      ),
    },
    {
      label: 'Ставка за час',
      value: isLoadingRates ? 'Загрузка...' : formatRateValue(currentRate, 'HOURLY'),
      isAdvanced: isAdvancedRateSetting(currentRate, 'HOURLY'),
      note: isLoadingRates ? null : (
        <ProjectRatesNote rate={currentRate} rateType='HOURLY' />
      ),
    },
    {
      label: 'Ставка за часы под контролем',
      value: isLoadingRates
        ? 'Загрузка...'
        : formatRateValue(currentRate, 'SUPERVISED_HOURLY'),
      isAdvanced: isAdvancedRateSetting(currentRate, 'SUPERVISED_HOURLY'),
      note: isLoadingRates ? null : (
        <ProjectRatesNote rate={currentRate} rateType='SUPERVISED_HOURLY' />
      ),
    },
    {
      label: 'Ставка за часы всей компании',
      value: isLoadingRates
        ? 'Загрузка...'
        : formatRateValue(currentRate, 'COMPANY_HOURLY'),
      isAdvanced: isAdvancedRateSetting(currentRate, 'COMPANY_HOURLY'),
      note: isLoadingRates ? null : (
        <ProjectRatesNote rate={currentRate} rateType='COMPANY_HOURLY' />
      ),
    },
  ];
  const advancedSettingsCount = advancedRateSettingsCount(currentRate);

  return (
    <>
      <section className='grid min-w-0 gap-4'>
        <PayrollHeader employee={employee} />
        <CurrentRatesSection
          employee={employee}
          rateCards={rateCards}
          currentRate={currentRate}
          advancedSettingsCount={advancedSettingsCount}
          projectRatesCount={projectRatesCount(currentRate)}
          canChangeRate={canChangeRate}
          canManageRate={canManageRate}
          onOpenRateHistory={() => setIsRateHistoryModalOpen(true)}
          onOpenRateModal={() => void openRateModal()}
          onOpenRateDetails={() => setSelectedRateDetails(currentRate)}
        />
        {canManageRate ? (
          <SalaryFinanceArticleSection
            value={salaryFinanceArticleId}
            settings={financeSettings}
            isLoading={isLoadingFinanceSettings || isLoadingPayrollSettings}
            isSaving={isSavingPayrollSettings}
            error={payrollSettingsFieldError}
            onChange={(nextValue) => void updateSalaryFinanceArticle(nextValue)}
          />
        ) : null}
        <BankDetailsSection
          bankDetails={bankDetails}
          canEditBankDetails={canEditBankDetails}
          isLoadingBankDetails={isLoadingBankDetails}
          isSavingBankDetails={isSavingBankDetails}
          onBankDetailsChange={setBankDetails}
          onSaveBankDetails={() => void saveBankDetails()}
        />
        <PayrollCalculationsSection
          payrollRows={payrollRows}
          payrollMeta={payrollMeta}
          isLoadingPayrollRows={isLoadingPayrollRows}
          onOpenDetails={setSelectedPayrollDetails}
          canManageRecalculation={canManageRecalculation}
          recalculationStates={recalculationStates}
          startingPeriods={startingPeriods}
          onRequestRecalculation={setRecalculationCandidate}
          onPageChange={(page) =>
            setPayrollQuery((current) => ({
              ...current,
              page,
            }))
          }
        />
      </section>

      <PayrollCalculationDetailsModal
        row={selectedPayrollDetails}
        onClose={() => setSelectedPayrollDetails(null)}
      />
      <ConfirmDialog
        isOpen={canManageRecalculation && Boolean(recalculationCandidate)}
        isProcessing={
          recalculationCandidate
            ? startingPeriods.has(
                payrollPeriodKey(
                  recalculationCandidate.period_from,
                  recalculationCandidate.period_to,
                ),
              )
            : false
        }
        title='Пересчёт начислений компании'
        message={
          recalculationCandidate
            ? `Будут пересчитаны начисления всей компании за период ${formatPeriod(
                recalculationCandidate.period_from,
                recalculationCandidate.period_to,
              )}. Продолжить?`
            : ''
        }
        confirmLabel='Пересчитать'
        cancelLabel='Отмена'
        processingLabel='Запуск...'
        danger={false}
        onClose={() => setRecalculationCandidate(null)}
        onConfirm={() => {
          if (!canManageRecalculation || !recalculationCandidate) return;
          const periodFrom = recalculationCandidate.period_from.slice(0, 10);
          const periodTo = recalculationCandidate.period_to.slice(0, 10);
          setRecalculationCandidate(null);
          void startRecalculation(periodFrom, periodTo);
        }}
      />
      <RateChangeModal
        key={isRateModalOpen ? 'open' : 'closed'}
        isOpen={isRateModalOpen}
        form={rateForm}
        isSaving={isSavingRate}
        errors={rateErrors}
        isEditing={Boolean(editingRate)}
        minEffectiveFrom={editingRate ? undefined : minRateEffectiveFrom}
        onFormChange={(nextForm) => {
          setRateForm(nextForm);
          setRateErrors({});
        }}
        onSubmit={submitRate}
        onClose={() => {
          setIsRateModalOpen(false);
          setIsRateWarningOpen(false);
          setEditingRate(null);
          setMinRateEffectiveFrom(undefined);
          setRateErrors({});
        }}
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
        isOpen={isRateHistoryModalOpen}
        rates={rateHistory}
        isLoading={isLoadingRates}
        canManageRates={canManageRate && canChangeRate}
        deletingRateId={deletingRateId}
        onEditRate={openRateEditModal}
        onDeleteRate={setDeleteRateCandidate}
        onClose={() => setIsRateHistoryModalOpen(false)}
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
    </>
  );
}
