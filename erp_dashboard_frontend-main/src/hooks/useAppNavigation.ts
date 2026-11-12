import { useEffect, useMemo } from 'react';

import {
  getDefaultPathForRole,
  getExtraAllowedPathsForRole,
  getMenuItemsForRole,
} from '../constants/app';
import type { RouterLike, User } from '../types/app';
import { getLegacyRedirectPath } from '../utils/legacyRoutes';
import { getMenuPermissions } from './useTariffAccess';

export function useAppNavigation({
  user,
  router,
  isAuthInitializing,
}: {
  user: User | null;
  router: RouterLike;
  isAuthInitializing: boolean;
}) {
  const permissionNames = useMemo(() => getMenuPermissions(user), [user]);

  const menuItems = useMemo(
    () => getMenuItemsForRole(user?.role, permissionNames),
    [permissionNames, user?.role],
  );

  const allowedPaths = useMemo(() => {
    if (!user) return [];

    return [
      ...getMenuItemsForRole(user.role, permissionNames).map((item) => item.path),
      ...getExtraAllowedPathsForRole(user.role, permissionNames),
    ];
  }, [permissionNames, user]);

  const currentPath = useMemo(() => {
    const path = router.asPath || router.pathname || '/';
    return path.split('?')[0] || '/';
  }, [router.asPath, router.pathname]);

  const legacyRedirectPath = useMemo(
    () => getLegacyRedirectPath(router.asPath || router.pathname || '/'),
    [router.asPath, router.pathname],
  );

  const currentPageId = useMemo(() => {
    const item = menuItems.find(
      (entry) => currentPath === entry.path || currentPath.startsWith(`${entry.path}/`),
    );
    return item?.id ?? null;
  }, [currentPath, menuItems]);

  const currentPageLabel = useMemo(() => {
    const item = menuItems.find((entry) => entry.id === currentPageId);
    return item?.label ?? 'Раздел';
  }, [currentPageId, menuItems]);

  useEffect(() => {
    if (isAuthInitializing) return;
    if (!user) return;

    const fallbackPath = getDefaultPathForRole(user.role, permissionNames);

    // Старые ссылки ведут на новое место раздела, доступ проверится уже по новому адресу.
    if (legacyRedirectPath) {
      router.replace(legacyRedirectPath);
      return;
    }

    if (currentPath === '/') {
      router.replace(fallbackPath);
      return;
    }

    const isAllowed = allowedPaths.some((allowed) => {
      if (allowed.includes(':')) {
        const baseAllowed = allowed.split('/:')[0];
        return currentPath === baseAllowed || currentPath.startsWith(`${baseAllowed}/`);
      }
      return allowed === currentPath;
    });

    if (!isAllowed) {
      router.replace(fallbackPath);
    }
  }, [
    allowedPaths,
    currentPath,
    isAuthInitializing,
    legacyRedirectPath,
    permissionNames,
    router,
    user,
  ]);

  const openMenuPage = (path: string) => router.push(path);

  return {
    currentPath,
    legacyRedirectPath,
    menuItems,
    currentPageId,
    currentPageLabel,
    openMenuPage,
  };
}
