import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';

import { api } from '../../../../../api/api';
import { extractApiFieldError } from '../../../../../api/core/error';
import {
  FREE_PLAN,
  FREE_PLAN_USERS_LABEL,
  PRO_PLAN,
  TARIFF_FEATURE_INFO,
} from '../../../../../constants/tariffs';
import type { TariffFeature } from '../../../../../types/app';
import type {
  CurrentSubscription,
  TariffPlan,
  CalculateTariffResponse,
  Invoice,
} from '../../../../../types/billing';
import {
  COMPANY_REQUISITES_MISSING_MESSAGE,
  COMPANY_REQUISITES_PATH,
  hasCompanyRequisites,
  joinClassNames,
  handleDownloadInvoice,
} from '../settingsUtils';
import ConfirmDialog from '../../../../modals/ConfirmDialog';
import IndividualTariffModal from '../../../../modals/IndividualTariffModal';
import Button from '../../../../ui/Button';

type Props = {
  tariffs: TariffPlan[];
  subscription: CurrentSubscription | null;
  onSubscriptionChange: (silent?: boolean) => void;
};

// label — для кнопок в узкой колонке, text — для фразы «К оплате за 3 месяца».
const PERIODS = [
  { value: 1, label: '1 мес.', text: '1 месяц' },
  { value: 3, label: '3 мес.', text: '3 месяца' },
  { value: 6, label: '6 мес.', text: '6 месяцев' },
  { value: 12, label: '12 мес.', text: '12 месяцев' },
];

// Самый большой тариф с фиксированной ценой — «50 + 1», то есть 51 пользователь;
// всё сверх него — по заявке.
const INDIVIDUAL_FROM_LABEL = '51';

// Что перестанет работать после перехода на ФРИ: показываем в подтверждении.
const FREE_LOCKED_FEATURES: TariffFeature[] = [
  'tracker',
  'finance_analytics',
  'payroll',
  'project_economics',
  'client_access',
  'advanced_reports',
];

// «Отправьте в архив 1 сотрудника / 3 сотрудников».
function employeesAccusative(count: number) {
  return count % 10 === 1 && count % 100 !== 11 ? 'сотрудника' : 'сотрудников';
}

function RequisitesNotice() {
  return (
    <p
      role='alert'
      className='rounded-lg border border-[#f5d7a8] bg-[#fff8ec] px-3 py-2 text-[13px] leading-5 text-[#8a4b0c]'
    >
      {COMPANY_REQUISITES_MISSING_MESSAGE}{' '}
      <Link
        to={COMPANY_REQUISITES_PATH}
        className='font-semibold text-[#2d6ff7] hover:underline'
      >
        Заполнить реквизиты
      </Link>
    </p>
  );
}

// «Осталось 1 день / 3 дня / 5 дней».
function daysLabel(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дня';
  return 'дней';
}

// «5 + 1» вместо «5 + 1 сотрудник»: в кнопках выбора подпись «Сотрудников» стоит рядом.
function employeesLabel(tariff: TariffPlan) {
  return tariff.max_employees !== null
    ? `${tariff.max_employees - 1} + 1`
    : `Больше ${INDIVIDUAL_FROM_LABEL}`;
}

function ChoiceButton({
  isSelected,
  onClick,
  children,
}: {
  isSelected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type='button'
      aria-pressed={isSelected}
      className={joinClassNames(
        'min-h-9 rounded-lg border px-2 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
        isSelected
          ? 'border-[#2d6ff7] bg-[#2d6ff7] text-white'
          : 'border-[#e3e9f3] bg-white text-[#1f3565] hover:border-[#c9d8f8] hover:bg-[#f4f7ff]',
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function PlanCard({
  title,
  tagline,
  price,
  priceNote,
  features,
  summary,
  isCurrent,
  isAccent = false,
  action,
}: {
  title: string;
  tagline: string;
  price: string;
  priceNote: string;
  features: string[];
  summary: string;
  isCurrent: boolean;
  isAccent?: boolean;
  action?: ReactNode;
}) {
  return (
    <section
      className={joinClassNames(
        'flex min-w-0 flex-col rounded-2xl border p-4 md:p-5',
        isCurrent
          ? 'border-[#2d6ff7] bg-[#f8fbff] shadow-[0_0_0_1px_#2d6ff7]'
          : 'border-[#e3e9f3] bg-white',
      )}
    >
      <div className='flex flex-wrap items-center gap-2'>
        <h3
          className={joinClassNames(
            'text-xl font-bold',
            isAccent ? 'text-[#b45309]' : 'text-[#10275a]',
          )}
        >
          {title}
        </h3>
        {isCurrent ? (
          <span className='rounded-md bg-[#e8f6eb] px-2 py-1 text-[11px] leading-none font-semibold text-[#3e8d59]'>
            Ваш тариф
          </span>
        ) : null}
      </div>
      <p className='mt-1 text-sm text-[#5f73a3]'>{tagline}</p>
      <div className='mt-3'>
        <span className='text-2xl font-bold text-[#10275a]'>{price}</span>
        <span className='ml-1.5 text-xs text-[#5f73a3]'>{priceNote}</span>
      </div>
      <ul className='mt-4 grid gap-2 border-t border-[#e3e9f3] pt-4 text-sm text-[#1f3565]'>
        {features.map((feature) => (
          <li key={feature} className='flex items-start gap-2'>
            <svg
              viewBox='0 0 24 24'
              className='mt-0.5 size-4 shrink-0 fill-none stroke-[#10b981] stroke-[2.2] [stroke-linecap:round] [stroke-linejoin:round]'
              aria-hidden='true'
            >
              <path d='m5 12 5 5 9-10' />
            </svg>
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <p className='mt-4 text-sm text-[#5f73a3]'>{summary}</p>
      {action ? <div className='mt-auto pt-5'>{action}</div> : null}
    </section>
  );
}

export default function SubscriptionTab({
  tariffs,
  subscription,
  onSubscriptionChange,
}: Props) {
  const [selectedPeriod, setSelectedPeriod] = useState<number>(1);
  const [selectedTariffId, setSelectedTariffId] = useState<string | null>(null);
  const [calculation, setCalculation] = useState<CalculateTariffResponse | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isIndividualModalOpen, setIsIndividualModalOpen] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
  const [successInvoice, setSuccessInvoice] = useState<Invoice | null>(null);

  const paymentRef = useRef<HTMLDivElement>(null);
  // null — ещё не проверяли или проверка не удалась: тогда кнопку не блокируем.
  const [hasRequisites, setHasRequisites] = useState<boolean | null>(null);
  const [isCheckingRequisites, setIsCheckingRequisites] = useState(false);
  const [isFreeConfirmOpen, setIsFreeConfirmOpen] = useState(false);
  const [isSwitchingToFree, setIsSwitchingToFree] = useState(false);
  const [freeSwitchError, setFreeSwitchError] = useState<string | null>(null);

  const freeTariff = useMemo(
    () => tariffs.find((tariff) => tariff.plan === 'free') ?? null,
    [tariffs],
  );
  // Платные тарифы ПРО отличаются только числом сотрудников, ФРИ выбирается отдельно.
  const proTariffs = useMemo(
    () =>
      tariffs
        .filter((tariff) => tariff.plan !== 'free')
        .sort(
          (left, right) =>
            (left.max_employees ?? Infinity) - (right.max_employees ?? Infinity) ||
            left.price - right.price,
        ),
    [tariffs],
  );

  const currentTariffId = subscription?.tariff?.id;
  const isOnFree =
    subscription?.tariff?.plan === 'free' ||
    Boolean(freeTariff && currentTariffId === freeTariff.id);
  const isOnPro = Boolean(subscription?.tariff) && !isOnFree;
  // Безлимитный тариф без цены бэкенд отдаёт, только если он уже назначен компании:
  // тогда он стоит последней кнопкой вместо заявки на индивидуальный тариф.
  const sizedProTariffs = proTariffs.filter((tariff) => tariff.max_employees !== null);
  const unlimitedProTariff =
    proTariffs.find((tariff) => tariff.max_employees === null) ?? null;
  // На ПРО по умолчанию предлагаем продлить текущий тариф, иначе показываем самый маленький.
  const activeTariffId =
    selectedTariffId ?? (isOnPro ? currentTariffId : sizedProTariffs[0]?.id);

  const selectedTariff = useMemo(
    () => tariffs.find((t) => t.id === activeTariffId),
    [tariffs, activeTariffId],
  );

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ru-RU').format(price);
  };

  const isExtending = Boolean(currentTariffId) && activeTariffId === currentTariffId;

  useEffect(() => {
    let active = true;
    if (!activeTariffId || activeTariffId === currentTariffId) {
      setCalculation(null);
      return;
    }
    const fetchCalculation = async () => {
      try {
        setIsCalculating(true);
        const data = await api.workspace.billing.calculateTariffChange(
          activeTariffId,
          selectedPeriod,
        );
        if (active) setCalculation(data);
      } catch {
        if (active) setCalculation(null);
        toast.error('Не удалось рассчитать стоимость');
      } finally {
        if (active) setIsCalculating(false);
      }
    };
    void fetchCalculation();
    return () => {
      active = false;
    };
  }, [activeTariffId, selectedPeriod, currentTariffId]);

  // Реквизиты проверяем до «Сформировать счет»: без них счёт не скачать, а неоплаченный
  // счёт мешает выбрать другой тариф.
  const showsInvoiceSummary = Boolean(selectedTariff) && !subscription?.pending_invoice;
  useEffect(() => {
    if (!showsInvoiceSummary || hasRequisites) return;
    let active = true;
    setIsCheckingRequisites(true);
    hasCompanyRequisites()
      .then((value) => {
        if (active) setHasRequisites(value);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setIsCheckingRequisites(false);
      });
    return () => {
      active = false;
      setIsCheckingRequisites(false);
    };
  }, [showsInvoiceSummary, hasRequisites]);

  // На узком экране блок оплаты стоит под карточками, поэтому к нему прокручиваем.
  const scrollToPayment = () =>
    paymentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  const startExtending = () => {
    setSelectedTariffId(null);
    scrollToPayment();
  };

  const handleCreateInvoiceClick = () => {
    if (!activeTariffId) return;
    setIsConfirmModalOpen(true);
  };

  const daysLeftExact = subscription?.days_left ?? 0;
  const oldPrice = subscription?.tariff?.price ?? 0;
  const newPrice = selectedTariff?.price ?? 0;

  const oldMoneyLeft = Math.round((daysLeftExact * oldPrice) / 30);
  const newTariffCostForDays = Math.round(selectedPeriod * newPrice);

  const confirmChangeTariff = async () => {
    if (!activeTariffId) return;
    try {
      setIsChanging(true);
      const response = await api.workspace.billing.changeTariff(
        activeTariffId,
        selectedPeriod,
      );
      const invoice =
        'id' in response && 'number' in response
          ? (response as unknown as Invoice)
          : response.invoice;

      if (invoice) {
        if (invoice.status === 'PAID' || invoice.amount === 0) {
          toast.success('Тариф успешно изменен');
          setIsConfirmModalOpen(false);
          setSelectedTariffId(null);
        } else {
          setSuccessInvoice(invoice);
        }
      } else {
        toast.success(response.message || 'Счет успешно сформирован');
        setIsConfirmModalOpen(false);
        setSelectedTariffId(null);
      }
      onSubscriptionChange(true);
    } catch (err) {
      console.error('--- changeTariff ERROR ---', err);
      toast.error(
        err instanceof Error ? err.message : 'Произошла ошибка при смене тарифа',
      );
    } finally {
      setIsChanging(false);
    }
  };

  const openFreeConfirm = () => {
    setFreeSwitchError(null);
    setIsFreeConfirmOpen(true);
  };

  const confirmSwitchToFree = async () => {
    if (!freeTariff) return;
    try {
      setIsSwitchingToFree(true);
      setFreeSwitchError(null);
      const response = await api.workspace.billing.switchToFreeTariff(freeTariff.id);
      toast.success(response.message || 'Компания переведена на тариф ФРИ.');
      setIsFreeConfirmOpen(false);
      setSelectedTariffId(null);
      onSubscriptionChange(true);
    } catch (err) {
      // Лимит пользователей бэкенд возвращает ошибкой поля tariff_id.
      setFreeSwitchError(
        extractApiFieldError(err, 'tariff_id') ??
          (err instanceof Error ? err.message : 'Не удалось перейти на ФРИ.'),
      );
    } finally {
      setIsSwitchingToFree(false);
    }
  };

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  const activeEmployeesCount = subscription?.active_employees_count;
  const currentMaxEmployees = subscription?.tariff?.max_employees ?? null;
  const freeMaxEmployees = freeTariff?.max_employees ?? null;
  const employeesOverFreeLimit =
    activeEmployeesCount !== undefined && freeMaxEmployees !== null
      ? Math.max(0, activeEmployeesCount - freeMaxEmployees)
      : 0;
  const freeLimitText =
    activeEmployeesCount !== undefined
      ? `На ФРИ можно до ${FREE_PLAN_USERS_LABEL} активных пользователей, сейчас ${activeEmployeesCount}.`
      : `На ФРИ можно до ${FREE_PLAN_USERS_LABEL} активных пользователей.`;

  const currentTariff = subscription?.tariff ?? null;
  const daysLeft = Math.ceil(subscription?.days_left ?? 0);
  const periodText =
    PERIODS.find((period) => period.value === selectedPeriod)?.text ??
    `${selectedPeriod} мес.`;
  const minProPrice = sizedProTariffs.length
    ? Math.min(...sizedProTariffs.map((tariff) => tariff.price))
    : null;
  const totalToPay = selectedTariff
    ? isExtending || !calculation
      ? selectedTariff.price * selectedPeriod
      : calculation.amount_to_pay
    : 0;
  const paymentTitle = isExtending
    ? 'Продление ПРО'
    : isOnPro
      ? 'Смена тарифа ПРО'
      : 'Подключение ПРО';

  return (
    <div className='max-w-[1240px] min-w-0'>
      {currentTariff ? (
        <section className='mb-4 flex flex-col gap-4 rounded-2xl border border-[#e3e9f3] bg-white p-4 sm:flex-row sm:items-center sm:justify-between md:px-5'>
          <div className='min-w-0'>
            <div className='flex flex-wrap items-baseline gap-x-2'>
              <span className='text-xs font-semibold tracking-wider text-[#10b981] uppercase'>
                Ваш тариф
              </span>
              <span className='text-base font-bold text-[#10275a]'>
                {isOnFree ? FREE_PLAN.title : `${PRO_PLAN.title}, ${currentTariff.name}`}
              </span>
              <span className='text-sm text-[#5f73a3]'>
                {isOnFree
                  ? 'бесплатно и бессрочно'
                  : `${formatPrice(currentTariff.price)} ₽ в месяц`}
              </span>
            </div>
            <div className='mt-1 flex flex-wrap gap-x-6 gap-y-1 text-sm text-[#5f73a3]'>
              {subscription?.ends_at ? (
                daysLeft > 0 ? (
                  <span>
                    Оплачен до{' '}
                    <span className='font-medium text-[#10275a]'>
                      {formatDate(subscription.ends_at)}
                    </span>
                    , осталось {daysLeft} {daysLabel(daysLeft)}
                  </span>
                ) : (
                  <span className='font-medium text-[#b91c1c]'>
                    Подписка закончилась {formatDate(subscription.ends_at)}
                  </span>
                )
              ) : null}
              {activeEmployeesCount !== undefined ? (
                <span>
                  Пользователи{' '}
                  <span className='font-medium text-[#10275a]'>
                    {currentMaxEmployees !== null
                      ? `${activeEmployeesCount} из ${currentMaxEmployees}`
                      : activeEmployeesCount}
                  </span>
                  {isOnFree ? ` (лимит ФРИ: ${FREE_PLAN_USERS_LABEL})` : null}
                </span>
              ) : null}
            </div>
          </div>
          {isOnPro && !subscription?.pending_invoice ? (
            <button
              type='button'
              className='shrink-0 rounded-lg bg-[#2d6ff7] px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#245fd8]'
              onClick={startExtending}
            >
              Продлить
            </button>
          ) : null}
        </section>
      ) : null}

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_340px]'>
        <PlanCard
          title={FREE_PLAN.title}
          tagline={FREE_PLAN.tagline}
          price={FREE_PLAN.price}
          priceNote='бессрочно'
          features={FREE_PLAN.features}
          summary={FREE_PLAN.summary}
          isCurrent={isOnFree}
          action={
            !isOnFree && freeTariff ? (
              <button
                type='button'
                className='w-full rounded-lg border border-[#c9d8f8] bg-white py-2.5 text-sm font-semibold text-[#1f3565] transition-colors hover:bg-[#f4f7ff]'
                onClick={openFreeConfirm}
              >
                Перейти на ФРИ
              </button>
            ) : null
          }
        />
        <PlanCard
          title={PRO_PLAN.title}
          tagline={PRO_PLAN.tagline}
          price={minProPrice !== null ? `от ${formatPrice(minProPrice)} ₽` : '—'}
          priceNote='в месяц'
          features={PRO_PLAN.features}
          summary={PRO_PLAN.summary}
          isCurrent={isOnPro}
          isAccent
        />

        <section
          ref={paymentRef}
          className='scroll-mt-4 self-start rounded-2xl border border-[#e3e9f3] bg-white p-4 md:col-span-2 md:p-5 2xl:sticky 2xl:top-0 2xl:col-span-1'
        >
          <h3 className='text-base font-bold text-[#10275a]'>{paymentTitle}</h3>
          <div className='mt-4 grid gap-5 md:grid-cols-2 md:gap-6 2xl:grid-cols-1 2xl:gap-5'>
            <div className='grid content-start gap-4'>
              <div>
                <div className='mb-2 text-sm text-[#5f73a3]'>Сотрудников</div>
                <div className='grid grid-cols-3 gap-2'>
                  {sizedProTariffs.map((tariff) => (
                    <ChoiceButton
                      key={tariff.id}
                      isSelected={activeTariffId === tariff.id}
                      onClick={() => setSelectedTariffId(tariff.id)}
                    >
                      {employeesLabel(tariff)}
                    </ChoiceButton>
                  ))}
                  {unlimitedProTariff ? (
                    <ChoiceButton
                      isSelected={activeTariffId === unlimitedProTariff.id}
                      onClick={() => setSelectedTariffId(unlimitedProTariff.id)}
                    >
                      {employeesLabel(unlimitedProTariff)}
                    </ChoiceButton>
                  ) : (
                    <ChoiceButton
                      isSelected={false}
                      onClick={() => setIsIndividualModalOpen(true)}
                    >
                      Больше {INDIVIDUAL_FROM_LABEL}
                    </ChoiceButton>
                  )}
                </div>
                {isOnPro && !isExtending && currentTariff ? (
                  <p className='mt-2 text-xs text-[#5f73a3]'>
                    Сейчас у вас «{currentTariff.name}».{' '}
                    <button
                      type='button'
                      className='font-semibold text-[#2d6ff7] hover:underline'
                      onClick={() => setSelectedTariffId(null)}
                    >
                      Оставить текущий
                    </button>
                  </p>
                ) : null}
              </div>

              <div>
                <div className='mb-2 text-sm text-[#5f73a3]'>Период оплаты</div>
                <div className='grid grid-cols-4 gap-2'>
                  {PERIODS.map((period) => (
                    <ChoiceButton
                      key={period.value}
                      isSelected={selectedPeriod === period.value}
                      onClick={() => setSelectedPeriod(period.value)}
                    >
                      {period.label}
                    </ChoiceButton>
                  ))}
                </div>
              </div>
            </div>

            {selectedTariff ? (
              <div className='rounded-xl bg-[#f4f7ff] p-4'>
                <div className='flex items-baseline justify-between gap-3 text-sm text-[#1f3565]'>
                  <span>Цена в месяц</span>
                  <span className='font-medium'>
                    {formatPrice(selectedTariff.price)} ₽
                  </span>
                </div>

                {subscription?.pending_invoice ? (
                  // Новый счёт не сформировать, пока не оплачен или не отменён прежний.
                  <p
                    role='status'
                    className='mt-3 rounded-lg border border-[#f5d7a8] bg-[#fff8ec] px-3 py-2 text-[13px] leading-5 text-[#8a4b0c]'
                  >
                    Уже есть неоплаченный счёт на тариф «
                    {subscription.pending_invoice.tariff.name}» на{' '}
                    {formatPrice(subscription.pending_invoice.amount)} ₽. Оплатите или
                    отмените его во вкладке «История платежей», чтобы сформировать новый.
                  </p>
                ) : (
                  <>
                    {isCalculating && !isExtending ? (
                      <div className='mt-2 animate-pulse text-sm text-[#5f73a3]'>
                        Расчет...
                      </div>
                    ) : (
                      <>
                        {!isExtending && calculation && calculation.discount > 0 && (
                          <div className='mt-2 flex justify-between text-sm text-[#10b981]'>
                            <span>Скидка за остаток дней</span>
                            <span>
                              -{' '}
                              {formatPrice(
                                Math.min(
                                  calculation.discount,
                                  selectedTariff.price * selectedPeriod,
                                ),
                              )}{' '}
                              ₽
                            </span>
                          </div>
                        )}
                        {!isExtending && calculation && calculation.bonus_days > 0 && (
                          <div className='mt-2'>
                            <div className='flex justify-between text-sm text-[#10b981]'>
                              <span>Бонусные дни (перерасчет)</span>
                              <span>+ {calculation.bonus_days} дн.</span>
                            </div>
                            <div className='mt-0.5 text-[10px] text-[#94a3b8]'>
                              Формула: (({formatPrice(oldMoneyLeft)} ₽ -{' '}
                              {formatPrice(newTariffCostForDays)} ₽) /{' '}
                              {formatPrice(newPrice)} ₽) × 30 дн
                            </div>
                          </div>
                        )}
                        <div className='mt-3 flex items-baseline justify-between gap-3 border-t border-[#dce7ff] pt-3'>
                          <span className='text-sm font-semibold text-[#10275a]'>
                            К оплате за {periodText}
                          </span>
                          <span className='text-xl font-bold text-[#10275a]'>
                            {formatPrice(totalToPay)} ₽
                          </span>
                        </div>
                      </>
                    )}

                    <div className='mt-4 space-y-2'>
                      {hasRequisites === false ? <RequisitesNotice /> : null}
                      <button
                        type='button'
                        disabled={
                          (isCalculating && !isExtending) ||
                          isCheckingRequisites ||
                          hasRequisites === false
                        }
                        className='w-full rounded-lg bg-[#2d6ff7] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#205ce4] disabled:opacity-50'
                        onClick={handleCreateInvoiceClick}
                      >
                        Сформировать счёт
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <ConfirmDialog
        isOpen={isConfirmModalOpen}
        isProcessing={isChanging}
        danger={false}
        maxWidth='max-w-[360px]'
        title={
          successInvoice
            ? 'Счет успешно сформирован'
            : isExtending
              ? 'Подтвердите продление тарифа'
              : 'Подтвердите смену тарифа'
        }
        message={
          successInvoice ? (
            <div className='flex flex-col'>
              <p className='text-sm mb-4'>
                Счет <strong>№{successInvoice.number}</strong> на оплату тарифа готов.
              </p>
              <p className='text-xs text-[#5f73a3]'>
                Он также будет всегда доступен во вкладке «История платежей».
              </p>
              {hasRequisites === false ? (
                <div className='mt-4'>
                  <RequisitesNotice />
                </div>
              ) : null}
            </div>
          ) : isExtending ? (
            <div className='flex flex-col'>
              <div className='mb-6'>
                <div className='text-[10px] font-semibold uppercase tracking-wider text-[#5f73a3] mb-1'>
                  ТАРИФ
                </div>
                <div className='font-bold text-[#10275a]'>"{selectedTariff?.name}"</div>
                <div className='text-xs text-[#5f73a3]'>
                  {formatPrice(selectedTariff?.price ?? 0)} ₽/месяц
                </div>
              </div>

              <div className='mb-6'>
                <div className='text-[10px] font-semibold uppercase tracking-wider text-[#5f73a3] mb-1'>
                  ПЕРИОД ПОДПИСКИ
                </div>
                <div className='font-bold text-[#10275a]'>{selectedPeriod} мес.</div>
              </div>

              <div className='pt-4 border-t border-[#e3e9f3] flex justify-between items-end'>
                <div className='text-[10px] font-bold uppercase tracking-wider text-[#10275a]'>
                  ИТОГО К ОПЛАТЕ
                </div>
                <div className='text-lg font-bold text-[#10275a]'>
                  {formatPrice((selectedTariff?.price ?? 0) * selectedPeriod)} ₽
                </div>
              </div>
            </div>
          ) : (
            <div className='flex flex-col'>
              <div className='mb-4'>
                <div className='text-[10px] font-semibold uppercase tracking-wider text-[#5f73a3] mb-1'>
                  ТЕКУЩИЙ ТАРИФ
                </div>
                <div className='font-bold text-[#10275a]'>
                  "{subscription?.tariff?.name ?? 'Нет активного плана'}"
                </div>
                <div className='text-xs text-[#5f73a3]'>
                  {formatPrice(subscription?.tariff?.price ?? 0)} ₽/месяц
                </div>
              </div>

              <div className='mb-4 flex justify-center text-[#5f73a3]'>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  width='16'
                  height='16'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                >
                  <path d='M12 5v14' />
                  <path d='m19 12-7 7-7-7' />
                </svg>
              </div>

              <div className='mb-6'>
                <div className='text-[10px] font-semibold uppercase tracking-wider text-[#5f73a3] mb-1'>
                  НОВЫЙ ТАРИФ
                </div>
                <div className='font-bold text-[#10275a]'>"{selectedTariff?.name}"</div>
                <div className='text-xs text-[#5f73a3]'>
                  {formatPrice(selectedTariff?.price ?? 0)} ₽/месяц
                </div>
              </div>

              <div className='pt-4 border-t border-[#e3e9f3]'>
                <div className='flex justify-between items-end mb-1'>
                  <div className='text-[10px] font-bold uppercase tracking-wider text-[#10275a]'>
                    ИТОГО К ОПЛАТЕ
                  </div>
                  <div className='text-lg font-bold text-[#10275a]'>
                    {formatPrice(calculation?.amount_to_pay ?? 0)} ₽
                  </div>
                </div>
                {calculation && calculation.bonus_days > 0 && (
                  <div className='flex justify-between items-end mt-2'>
                    <div className='text-[10px] font-bold uppercase tracking-wider text-[#10b981]'>
                      БОНУСНЫЕ ДНИ
                    </div>
                    <div className='text-sm font-bold text-[#10b981]'>
                      + {calculation.bonus_days} дн.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        }
        customActions={
          successInvoice ? (
            <>
              <Button
                type='button'
                variant='secondary'
                size='sm'
                onClick={() => {
                  setIsConfirmModalOpen(false);
                  setSuccessInvoice(null);
                  setSelectedTariffId(null);
                }}
              >
                Закрыть
              </Button>
              <Button
                type='button'
                variant='primary'
                size='sm'
                onClick={() =>
                  handleDownloadInvoice(successInvoice.id, successInvoice.number, () =>
                    setHasRequisites(false),
                  )
                }
              >
                Скачать счет
              </Button>
            </>
          ) : undefined
        }
        confirmLabel='Подтвердить'
        onClose={() => {
          setIsConfirmModalOpen(false);
          setSuccessInvoice(null);
        }}
        onConfirm={confirmChangeTariff}
      />
      <ConfirmDialog
        isOpen={isFreeConfirmOpen}
        isProcessing={isSwitchingToFree}
        danger
        maxWidth='max-w-[440px]'
        title='Перейти на тариф ФРИ?'
        message={
          <div className='grid gap-3 text-sm text-[#1f3565]'>
            <p>
              Компания перейдёт на ФРИ сразу.{' '}
              <strong>Оставшиеся оплаченные дни ПРО не сохраняются</strong> и не
              переносятся.
            </p>
            <p>{freeLimitText} Перестанут работать:</p>
            <ul className='grid gap-1 pl-4 text-[#5f73a3] [list-style:disc]'>
              {FREE_LOCKED_FEATURES.map((feature) => (
                <li key={feature}>{TARIFF_FEATURE_INFO[feature].title}</li>
              ))}
            </ul>
            <p className='text-xs text-[#5f73a3]'>
              Данные не удаляются: после возврата на ПРО всё снова будет доступно.
            </p>
            {employeesOverFreeLimit > 0 ? (
              <p
                role='alert'
                className='rounded-lg border border-[#f5d7a8] bg-[#fff8ec] px-3 py-2 text-[13px] leading-5 text-[#8a4b0c]'
              >
                Отправьте в архив {employeesOverFreeLimit}{' '}
                {employeesAccusative(employeesOverFreeLimit)}, чтобы перейти на ФРИ.{' '}
                <Link
                  to='/employees'
                  className='font-semibold text-[#2d6ff7] hover:underline'
                >
                  К сотрудникам
                </Link>
              </p>
            ) : freeSwitchError ? (
              <p
                role='alert'
                className='rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700'
              >
                {freeSwitchError}
              </p>
            ) : null}
          </div>
        }
        confirmLabel='Перейти на ФРИ'
        confirmDisabled={employeesOverFreeLimit > 0}
        processingLabel='Переводим...'
        onClose={() => {
          if (isSwitchingToFree) return;
          setIsFreeConfirmOpen(false);
        }}
        onConfirm={confirmSwitchToFree}
      />
      <IndividualTariffModal
        isOpen={isIndividualModalOpen}
        onClose={() => setIsIndividualModalOpen(false)}
      />
    </div>
  );
}
