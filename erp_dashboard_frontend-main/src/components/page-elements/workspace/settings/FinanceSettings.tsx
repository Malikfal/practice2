import { useLocation } from 'react-router';

import type { LockedScreen } from '../../../../constants/tariffs';
import { useTariffAccess } from '../../../../hooks/useTariffAccess';
import type { FinanceArticle, TariffFeature } from '../../../../types/app';
import ProBadge from '../../../tariff/ProBadge';
import ProFeatureLock from '../../../tariff/ProFeatureLock';
import SectionHeader from '../../../ui/SectionHeader';
import FinanceArticlesSettings from './FinanceArticlesSettings';
import PlannedExpensesSettings from './PlannedExpensesSettings';
import ProjectRatesTable from './ProjectRatesTable';

type FinanceSettingsTab = 'articles' | 'planned-expenses' | 'rates';

type Props = {
  canManageArticles: boolean;
  canManageProjectRates?: boolean;
  onArticlesChange?: (_articles: FinanceArticle[]) => void;
};

const tabs: Array<{
  key: FinanceSettingsTab;
  label: string;
  feature?: TariffFeature;
  lockedScreen?: LockedScreen;
}> = [
  { key: 'articles', label: 'Статьи' },
  {
    key: 'planned-expenses',
    label: 'Планируемые расходы',
    feature: 'finance_analytics',
    lockedScreen: 'planned_expenses',
  },
  {
    key: 'rates',
    label: 'Свод по ставкам',
    feature: 'project_economics',
    lockedScreen: 'project_rates',
  },
];

function financeSettingsTabPath(tab: FinanceSettingsTab) {
  return tab === 'articles'
    ? '/finances?view=settings'
    : `/finances?view=settings&tab=${tab}`;
}

// Финансы → Настройки: статьи поступлений и расходов, планируемые расходы, ставки проектов.
export default function FinanceSettings({
  canManageArticles,
  canManageProjectRates = true,
  onArticlesChange,
}: Props) {
  const location = useLocation();
  const tabParam = new URLSearchParams(location.search).get('tab');
  const activeTab = tabs.find((tab) => tab.key === tabParam) ?? tabs[0];
  const { isFeatureLocked } = useTariffAccess();
  const isTabLocked = (tab: (typeof tabs)[number]) =>
    Boolean(tab.feature && isFeatureLocked(tab.feature));

  return (
    <section className='flex min-h-0 flex-col overflow-visible rounded-xl border border-[#e3e9f3] bg-white text-[#1f3565] lg:h-full lg:overflow-hidden'>
      <SectionHeader
        overline='Финансы'
        title='Настройки финансов'
        description='Дерево статей поступлений и расходов, планируемые расходы и ставки проектов.'
        tabs={tabs.map((tab) => ({
          key: tab.key,
          label: tab.label,
          to: financeSettingsTabPath(tab.key),
          badge: isTabLocked(tab) ? <ProBadge /> : undefined,
        }))}
        activeTab={activeTab.key}
        replace
      />

      <div className='min-h-0 flex-1 overflow-visible p-2 md:p-5 lg:overflow-auto'>
        {activeTab.feature && isTabLocked(activeTab) ? (
          <ProFeatureLock
            feature={activeTab.feature}
            screen={activeTab.lockedScreen}
            variant='inline'
          />
        ) : activeTab.key === 'articles' ? (
          <FinanceArticlesSettings
            canManage={canManageArticles}
            embedded
            initialType='EXPENDITURE'
            onArticlesChange={onArticlesChange}
          />
        ) : activeTab.key === 'planned-expenses' ? (
          <PlannedExpensesSettings canManage={canManageArticles} />
        ) : (
          <ProjectRatesTable canManageRates={canManageProjectRates} />
        )}
      </div>
    </section>
  );
}
