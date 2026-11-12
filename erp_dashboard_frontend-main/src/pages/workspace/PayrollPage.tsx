import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';

import { api } from '../../api/api';
import { ApiRequestError } from '../../api/core/error';
import CompanyPayrollPanel from '../../components/page-elements/workspace/finances/payroll/CompanyPayrollPanel';
import PayrollSidebar, {
  payrollViewPath,
  type PayrollView,
} from '../../components/page-elements/workspace/finances/payroll/PayrollSidebar';
import PayrollSettings from '../../components/page-elements/workspace/settings/PayrollSettings';
import ProFeatureLock from '../../components/tariff/ProFeatureLock';
import { useAppControllerContext } from '../../context/AppControllerContext';
import { useTariffAccess } from '../../hooks/useTariffAccess';
import type { Client, Project } from '../../types/app';

function getPayrollViewFromSearch(search: string): PayrollView {
  const view = new URLSearchParams(search).get('view');
  return view === 'payout' || view === 'settings' ? view : 'calculation';
}

// Оплата труда: расчёт и выплата ФОТ, настройки статей и ставок. Видна тем, кто видит финансы.
export default function PayrollPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAppControllerContext();
  const permissions = user?.permissions ?? [];
  const canView =
    permissions.includes('finance.view') || permissions.includes('finance.manage');
  const canManageFinance = permissions.includes('finance.manage');
  const activeView = getPayrollViewFromSearch(location.search);
  const isLockedByTariff = useTariffAccess().isFeatureLocked('payroll');

  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const optionsRequestedRef = useRef(false);

  // Проекты и клиенты нужны только фильтрам общего расчёта, загружаем их один раз.
  useEffect(() => {
    if (
      !canView ||
      isLockedByTariff ||
      activeView !== 'calculation' ||
      optionsRequestedRef.current
    )
      return;
    optionsRequestedRef.current = true;

    // Без прав на проекты или клиентов их фильтры остаются пустыми, отчёт это не ломает.
    const handleError = (err: unknown) => {
      if (err instanceof ApiRequestError && err.status === 403) return;
      toast.error(err instanceof Error ? err.message : 'Произошла ошибка.');
    };

    const loadOptions = async () => {
      setIsLoadingOptions(true);
      await Promise.all([
        api.workspace.projects
          .getMany({ status: 'all' })
          .then((response) => setProjects(response.data ?? []))
          .catch(handleError),
        api.workspace.clients
          .getMany({ per_page: 1000 })
          .then((response) => setClients(response.data ?? []))
          .catch(handleError),
      ]);
      setIsLoadingOptions(false);
    };

    void loadOptions();
  }, [activeView, canView, isLockedByTariff]);

  const changeView = (view: PayrollView) => {
    navigate(payrollViewPath(view), { replace: true });
  };

  if (!canView) {
    return (
      <div className='rounded-xl border border-[#e3e9f3] bg-white p-4 text-sm text-[#7e8fb4]'>
        У вас нет доступа к оплате труда.
      </div>
    );
  }

  if (isLockedByTariff) {
    return <ProFeatureLock feature='payroll' screen='payroll' />;
  }

  return (
    <div className='grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2 xl:grid-cols-[210px_minmax(0,1fr)] xl:grid-rows-1'>
      <PayrollSidebar activeView={activeView} onViewChange={changeView} />
      {activeView === 'settings' ? (
        <PayrollSettings
          canManageSalarySettings={permissions.includes('settings.manage')}
          canManagePayoutArticles={canManageFinance}
          canManageEmployeeRates={permissions.includes('employees.tabs.salary.view')}
        />
      ) : (
        <CompanyPayrollPanel
          key={activeView}
          group={activeView}
          projects={projects}
          clients={clients}
          isLoadingOptions={isLoadingOptions}
          canManagePayouts={
            canManageFinance && permissions.includes('employees.tabs.salary.view')
          }
        />
      )}
    </div>
  );
}
