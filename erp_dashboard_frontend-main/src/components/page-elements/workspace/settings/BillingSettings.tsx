import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

import { api } from '../../../../api/api';
import { useAppControllerContext } from '../../../../context/AppControllerContext';
import type { TariffPlan, CurrentSubscription } from '../../../../types/billing';
import { joinClassNames } from './settingsUtils';
import PaymentHistoryTab from './billing/PaymentHistoryTab';
import SubscriptionTab from './billing/SubscriptionTab';

export default function BillingSettings() {
  const [activeTab, setActiveTab] = useState<'subscription' | 'history'>('subscription');
  const [tariffs, setTariffs] = useState<TariffPlan[]>([]);
  const [subscription, setSubscription] = useState<CurrentSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { reloadProfile } = useAppControllerContext();

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const [tariffsData, subData] = await Promise.all([
        api.workspace.billing.getTariffs(),
        api.workspace.billing.getSubscription(),
      ]);
      setTariffs(tariffsData);
      setSubscription(subData);
    } catch {
      toast.error('Ошибка при загрузке данных биллинга');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return (
    <div className='flex h-full min-h-0 flex-col overflow-auto rounded-2xl border border-[#e3e9f3] bg-white p-3 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.55)] md:p-5'>
      <div className='mb-4'>
        <h2 className='text-lg font-semibold tracking-tight text-[#10275a] md:text-xl'>
          Тарифные планы
        </h2>
      </div>

      <div className='mb-4 grid grid-cols-2 border-b border-[#e3e9f3] md:mb-6 md:flex'>
        <button
          type='button'
          className={joinClassNames(
            'border-b-2 px-1 py-2.5 text-[13px] font-medium transition-colors md:mr-6 md:py-2 md:text-[15px]',
            activeTab === 'subscription'
              ? 'border-[#2d6ff7] text-[#2d6ff7]'
              : 'border-transparent text-[#5f73a3] hover:text-[#10275a]',
          )}
          onClick={() => setActiveTab('subscription')}
        >
          Подписка
        </button>
        <button
          type='button'
          className={joinClassNames(
            'border-b-2 px-1 py-2.5 text-[13px] font-medium transition-colors md:py-2 md:text-[15px]',
            activeTab === 'history'
              ? 'border-[#2d6ff7] text-[#2d6ff7]'
              : 'border-transparent text-[#5f73a3] hover:text-[#10275a]',
          )}
          onClick={() => setActiveTab('history')}
        >
          История платежей
        </button>
      </div>

      {isLoading ? (
        <div className='flex flex-1 items-center justify-center'>
          <div className='h-7 w-7 animate-spin rounded-full border-2 border-[#c9d8f8] border-t-[#2d6ff7]' />
        </div>
      ) : activeTab === 'subscription' ? (
        <SubscriptionTab
          tariffs={tariffs}
          subscription={subscription}
          onSubscriptionChange={(silent) => {
            void fetchData(silent);
            // Закрытые разделы и метки «ПРО» берутся из профиля: обновляем его вместе с тарифом.
            void reloadProfile();
          }}
        />
      ) : (
        <PaymentHistoryTab />
      )}
    </div>
  );
}
