import { useMemo } from 'react';

import { canViewSettings } from '../constants/app';
import { useAppControllerContext } from '../context/AppControllerContext';
import type { TariffFeature, User } from '../types/app';

export type TariffAccess = {
  isFreePlan: boolean;
  /** Раздел закрыт тарифом: показываем «Доступно на ПРО» вместо него. */
  isFeatureLocked: (_feature: TariffFeature) => boolean;
  /** Право есть у роли, но его отключил тариф ФРИ. */
  isPermissionLocked: (_permission: string) => boolean;
  /** Пользователь может сам открыть «Подписку и платежи» и сменить тариф. */
  canChangeTariff: boolean;
};

export function getTariffAccess(user: User | null | undefined): TariffAccess {
  const lockedFeatures = user?.locked_features ?? [];
  const lockedPermissions = user?.tariff_locked_permissions ?? [];

  return {
    isFreePlan: user?.tariff?.plan === 'free',
    isFeatureLocked: (feature) => lockedFeatures.includes(feature),
    isPermissionLocked: (permission) => lockedPermissions.includes(permission),
    canChangeTariff: canViewSettings(user?.role, user?.permissions ?? []),
  };
}

export function useTariffAccess(): TariffAccess {
  const { user } = useAppControllerContext();
  return useMemo(() => getTariffAccess(user), [user]);
}

/**
 * Права для меню и доступных адресов: к правам пользователя добавлены закрытые тарифом.
 * Раздел, открытый только такими правами (например, расширенные отчёты), остаётся в меню
 * и показывает «Доступно на тарифе ПРО». Сами экраны проверяют настоящие права.
 */
export function getMenuPermissions(user: User | null | undefined): string[] {
  const permissions = user?.permissions ?? [];
  const lockedPermissions = user?.tariff_locked_permissions ?? [];
  if (!lockedPermissions.length) return permissions;
  return [...new Set([...permissions, ...lockedPermissions])];
}
