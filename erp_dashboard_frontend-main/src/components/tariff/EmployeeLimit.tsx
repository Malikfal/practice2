import { Link } from 'react-router';

import { BILLING_SETTINGS_PATH, FREE_PLAN_USERS_LABEL } from '../../constants/tariffs';
import { useTariffAccess } from '../../hooks/useTariffAccess';

type Limits = { maxEmployees: number | null; totalEmployees: number };

export function isEmployeeLimitReached({ maxEmployees, totalEmployees }: Limits) {
  return maxEmployees !== null && totalEmployees >= maxEmployees;
}

/** Счётчик активных пользователей против лимита тарифа: «6 из 6 · лимит ФРИ 5 + 1». */
export function EmployeeLimitChip({ maxEmployees, totalEmployees }: Limits) {
  const { isFreePlan } = useTariffAccess();
  if (maxEmployees === null) return null;
  const isReached = totalEmployees >= maxEmployees;

  return (
    <span
      className={`w-fit rounded-xl border px-3 py-1.5 ${
        isReached
          ? 'border-[#f5d7a8] bg-[#fff8ec] text-[#8a4b0c]'
          : 'border-[#e3e9f3] bg-white'
      }`}
    >
      Пользователи: {totalEmployees} из {maxEmployees}
      {isFreePlan ? ` · лимит ФРИ ${FREE_PLAN_USERS_LABEL}` : ''}
    </span>
  );
}

/** Почему «Добавить» недоступна и что сделать: перейти на ПРО или сменить тариф. */
export function EmployeeLimitNotice({
  maxEmployees,
  totalEmployees,
  className = '',
}: Limits & { className?: string }) {
  const { isFreePlan, canChangeTariff } = useTariffAccess();
  if (!isEmployeeLimitReached({ maxEmployees, totalEmployees })) return null;

  return (
    <p
      role='status'
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-[#f5d7a8] bg-[#fff8ec] px-3 py-2 text-[13px] leading-5 text-[#8a4b0c] ${className}`}
    >
      <span>
        {isFreePlan
          ? `Достигнут лимит ФРИ: до ${FREE_PLAN_USERS_LABEL} активных пользователей. Чтобы добавить сотрудника, перейдите на ПРО или отправьте кого-то в архив.`
          : 'Достигнут лимит тарифа. Чтобы добавить сотрудника, смените тариф или отправьте кого-то в архив.'}
      </span>
      {canChangeTariff ? (
        <Link
          to={BILLING_SETTINGS_PATH}
          className='font-semibold text-[#2d6ff7] hover:underline'
        >
          {isFreePlan ? 'Перейти на ПРО' : 'Сменить тариф'}
        </Link>
      ) : (
        <span>Обратитесь к администратору компании.</span>
      )}
    </p>
  );
}

/** Подсказка (title) для недоступной кнопки «Добавить». */
export function useEmployeeLimitHint(limits: Limits) {
  const { isFreePlan } = useTariffAccess();
  if (!isEmployeeLimitReached(limits)) return undefined;
  return isFreePlan
    ? `Достигнут лимит ФРИ (${FREE_PLAN_USERS_LABEL}). Перейдите на ПРО в настройках подписки.`
    : 'Достигнут лимит тарифа. Смените тариф в настройках подписки.';
}
