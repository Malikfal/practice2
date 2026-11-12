import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useAuthController } from './useAuthController';
import { useAppNavigation } from './useAppNavigation';
import { useWebSocketSubscription } from '../websocket/useWebSocketSubscription';
import { useNotificationsLifecycle } from '../notifications/useNotificationsLifecycle';

export function useAppController() {
  const location = useLocation();
  const navigate = useNavigate();
  const router = useMemo(() => {
    const asPath = `${location.pathname}${location.search}` || '/';
    const push = (path: string) => navigate(path);
    const replace = (path: string) => navigate(path, { replace: true });
    return {
      asPath,
      pathname: location.pathname || '/',
      push,
      replace,
    };
  }, [location.pathname, location.search, navigate]);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const auth = useAuthController({ router });

  const isClient = auth.user?.role === 'CLIENT';
  const socketData = useWebSocketSubscription(Boolean(auth.user), isClient);
  useNotificationsLifecycle(auth.user?.id ?? null, isClient);

  const navigation = useAppNavigation({
    user: auth.user,
    router,
    isAuthInitializing: auth.isAuthInitializing,
  });

  const onLogout = async () => {
    // Иначе после следующего входа меню пользователя окажется открытым.
    setIsUserMenuOpen(false);
    await auth.onLogout();
  };

  const openMenuPage = (path: string) => {
    navigation.openMenuPage(path);
    setIsUserMenuOpen(false);
  };

  return {
    ...auth,
    ...navigation,
    socketData,
    isUserMenuOpen,
    setIsUserMenuOpen,
    onLogout,
    openMenuPage,
  };
}
