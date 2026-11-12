import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { toast } from 'sonner';

import { api } from '../../../../api/api';
import type { FinanceSettings as FinanceSettingsData } from '../../../../types/app';
import SectionHeader from '../../../ui/SectionHeader';
import PayrollPayoutArticlesSettings from './PayrollPayoutArticlesSettings';
import SalaryArticleSettings from './SalaryArticleSettings';
import SalaryEmployeesRatesTable from './SalaryEmployeesRatesTable';

type PayrollSettingsTab = 'articles' | 'rates';

type Props = {
  // Читать настройки зарплат можно по праву на финансы, менять только по settings.manage.
  canManageSalarySettings: boolean;
  canManagePayoutArticles: boolean;
  canManageEmployeeRates: boolean;
};

const tabs: Array<{ key: PayrollSettingsTab; label: string }> = [
  { key: 'articles', label: 'Статьи' },
  { key: 'rates', label: 'Свод по оплате труда' },
];

const spinner = (
  <div className='grid min-h-60 place-items-center rounded-xl border border-[#e3e9f3] bg-[#fbfcff]'>
    <div className='h-7 w-7 animate-spin rounded-full border-2 border-[#c9d8f8] border-t-[#2d6ff7]' />
  </div>
);

// Оплата труда → Настройки: статьи начисления и выплаты ФОТ, свод ставок сотрудников.
export default function PayrollSettings({
  canManageSalarySettings,
  canManagePayoutArticles,
  canManageEmployeeRates,
}: Props) {
  const location = useLocation();
  const tabParam = new URLSearchParams(location.search).get('tab');
  const activeTab = tabs.find((tab) => tab.key === tabParam)?.key ?? 'articles';
  const [settings, setSettings] = useState<FinanceSettingsData | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  useEffect(() => {
    api.workspace.settings
      .getFinance()
      .then(setSettings)
      .catch((err: unknown) =>
        toast.error(err instanceof Error ? err.message : 'Произошла ошибка.'),
      )
      .finally(() => setIsLoadingSettings(false));
  }, []);

  return (
    <section className='flex min-h-0 flex-col overflow-visible rounded-xl border border-[#e3e9f3] bg-white text-[#1f3565] lg:h-full lg:overflow-hidden'>
      <SectionHeader
        overline='Оплата труда'
        title='Настройки оплаты труда'
        description='Статьи для начисления и выплаты ФОТ и ставки сотрудников.'
        tabs={tabs.map((tab) => ({
          ...tab,
          to:
            tab.key === 'articles'
              ? '/payroll?view=settings'
              : `/payroll?view=settings&tab=${tab.key}`,
        }))}
        activeTab={activeTab}
        replace
      />

      <div className='min-h-0 flex-1 overflow-visible p-2 md:p-5 lg:overflow-auto'>
        {activeTab === 'articles' ? (
          <div className='grid gap-5'>
            {isLoadingSettings ? (
              spinner
            ) : (
              <SalaryArticleSettings
                settings={settings}
                canManage={canManageSalarySettings}
                onSaved={setSettings}
              />
            )}

            <section className='grid gap-3 rounded-xl border border-[#e3e9f3] bg-[#fbfcff] p-3 md:p-4'>
              <h2 className='text-[18px] leading-tight font-semibold text-[#10275a] md:text-[20px] md:leading-none'>
                Статьи выплаты ФОТ
              </h2>
              <PayrollPayoutArticlesSettings canManage={canManagePayoutArticles} />
            </section>
          </div>
        ) : isLoadingSettings ? (
          spinner
        ) : (
          <SalaryEmployeesRatesTable
            canManageRates={canManageEmployeeRates}
            financeSettings={settings}
          />
        )}
      </div>
    </section>
  );
}
