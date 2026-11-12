import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { api } from '../../../../../../../api/api';
import { extractApiFieldError } from '../../../../../../../api/core/error';
import type {
  EmployeePayrollSettings,
  FinanceSettings,
} from '../../../../../../../types/app';

const PAYROLL_SETTINGS_UPDATED_EVENT = 'employee-payroll-settings-updated';
const payrollSettingsCache = new Map<string, EmployeePayrollSettings>();

export function clearEmployeePayrollSettingsCache() {
  payrollSettingsCache.clear();
}

type PayrollSettingsUpdatedDetail = EmployeePayrollSettings;

function publishPayrollSettingsUpdate(settings: EmployeePayrollSettings) {
  payrollSettingsCache.set(settings.employee_id, settings);
  window.dispatchEvent(
    new CustomEvent<PayrollSettingsUpdatedDetail>(PAYROLL_SETTINGS_UPDATED_EVENT, {
      detail: settings,
    }),
  );
}

export function useSalaryFinanceSettings(enabled = true) {
  const [settings, setSettings] = useState<FinanceSettings | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    let ignore = false;

    const load = async () => {
      setIsLoading(true);

      try {
        const response = await api.workspace.settings.getFinance();
        if (!ignore) setSettings(response);
      } catch (error) {
        if (!ignore) {
          toast.error(
            error instanceof Error
              ? error.message
              : 'Не удалось загрузить финансовые настройки.',
          );
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
    };

    void load();

    return () => {
      ignore = true;
    };
  }, [enabled]);

  return { settings, isLoading };
}

export function useEmployeePayrollSettings(
  employeeId: string,
  options: {
    initialArticleId?: string | null;
    load?: boolean;
  } = {},
) {
  const { initialArticleId = null, load = true } = options;
  const [articleId, setArticleId] = useState<string | null>(() =>
    load
      ? (payrollSettingsCache.get(employeeId)?.salary_finance_article_id ??
        initialArticleId)
      : initialArticleId,
  );
  const [isLoading, setIsLoading] = useState(load);
  const [isSaving, setIsSaving] = useState(false);
  const [fieldError, setFieldError] = useState<string>();

  useEffect(() => {
    const cachedSettings = payrollSettingsCache.get(employeeId);
    setFieldError(undefined);
    setArticleId(
      load
        ? (cachedSettings?.salary_finance_article_id ?? initialArticleId)
        : initialArticleId,
    );

    if (!load) {
      setIsLoading(false);
      return;
    }

    let ignore = false;
    setIsLoading(true);

    api.workspace.employeePayrollSettings
      .getForEmployee(employeeId)
      .then((response) => {
        payrollSettingsCache.set(employeeId, response);
        if (!ignore) setArticleId(response.salary_finance_article_id);
      })
      .catch((error: unknown) => {
        if (!ignore) {
          toast.error(
            error instanceof Error
              ? error.message
              : 'Не удалось загрузить зарплатную финансовую статью.',
          );
        }
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [employeeId, initialArticleId, load]);

  useEffect(() => {
    const handleUpdate = (event: Event) => {
      const settings = (event as CustomEvent<PayrollSettingsUpdatedDetail>).detail;
      if (settings.employee_id === employeeId) {
        setArticleId(settings.salary_finance_article_id);
      }
    };

    window.addEventListener(PAYROLL_SETTINGS_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(PAYROLL_SETTINGS_UPDATED_EVENT, handleUpdate);
  }, [employeeId]);

  const updateArticle = useCallback(
    async (nextArticleId: string | null) => {
      setIsSaving(true);
      setFieldError(undefined);

      try {
        const saved = await api.workspace.employeePayrollSettings.updateForEmployee(
          employeeId,
          nextArticleId,
        );
        setArticleId(saved.salary_finance_article_id);
        publishPayrollSettingsUpdate(saved);
        toast.success('Финансовая статья сотрудника сохранена.');
        return saved;
      } catch (error) {
        setFieldError(extractApiFieldError(error, 'salary_finance_article_id'));
        toast.error(
          error instanceof Error
            ? error.message
            : 'Не удалось сохранить финансовую статью сотрудника.',
        );
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [employeeId],
  );

  return { articleId, isLoading, isSaving, fieldError, updateArticle };
}
