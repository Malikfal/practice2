import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ApiRequestError } from '../api/core/error';
import { clearTokens } from '../api/core/tokens';
import { toast } from 'sonner';

import { getDefaultPathForRole } from '../constants/app';
import { TARIFF_FEATURE_LOCKED_EVENT } from '../constants/tariffs';
import { api } from '../api/api';
import type {
  LoginForm,
  PasswordForm,
  ProfileForm,
  RouterLike,
  TariffFeature,
  User,
} from '../types/app';

// Клиенту эндпоинт профиля сотрудника отвечает 403, поэтому сначала запрашиваем профиль того, кто входил в прошлый раз.
const AUTH_KIND_STORAGE_KEY = 'flow_auth_kind';

// Страницы без входа: регистрация, подтверждение почты и восстановление пароля.
export const PUBLIC_AUTH_PATHS = [
  '/register-company',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
];

function isClientLastAuth(): boolean {
  try {
    return window.localStorage.getItem(AUTH_KIND_STORAGE_KEY) === 'client';
  } catch {
    return false;
  }
}

function rememberAuthKind(role?: string | null): void {
  try {
    window.localStorage.setItem(
      AUTH_KIND_STORAGE_KEY,
      role === 'CLIENT' ? 'client' : 'employee',
    );
  } catch {
    // Без хранилища просто останется прежний порядок запросов.
  }
}

function createProfileFormFromUser(user: User): ProfileForm {
  return {
    first_name: user.first_name ?? '',
    last_name: user.last_name ?? '',
    position: user.position ?? null,
    birthday: user.birthday ?? null,
    phone: user.phone ?? null,
    socials: {
      additional_email: user.socials?.additional_email ?? '',
      additional_phone: user.socials?.additional_phone ?? '',
      max_url: user.socials?.max_url ?? '',
      vk_url: user.socials?.vk_url ?? '',
      telegram_url: user.socials?.telegram_url ?? '',
    },
    skills: user.skills ?? null,
  };
}

export function useAuthController({ router }: { router: RouterLike }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isAuthInitializing, setIsAuthInitializing] = useState(true);
  const [loginForm, setLoginForm] = useState<LoginForm>({ email: '', password: '' });
  // Почта владельца, который ещё не подтвердил регистрацию: форма входа предложит письмо заново.
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    first_name: '',
    last_name: '',
    position: null,
    birthday: null,
    phone: null,
    socials: {
      additional_email: '',
      additional_phone: '',
      max_url: '',
      vk_url: '',
      telegram_url: '',
    },
    skills: null,
  });
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    current_password: '',
    password: '',
    password_confirmation: '',
  });

  const displayName = useMemo(() => {
    if (!user) return '';
    return (
      `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() ||
      user.name?.trim() ||
      'Пользователь'
    );
  }, [user]);

  const avatarFallback = useMemo(() => {
    if (!user) return 'U';
    const letters = (
      `${user.first_name?.trim()?.[0] ?? ''}${user.last_name?.trim()?.[0] ?? ''}` ||
      `${user.name?.trim()?.[0] ?? ''}`
    ).toUpperCase();
    return letters || 'U';
  }, [user]);

  const handleError = useCallback((err: unknown) => {
    toast.error(err instanceof Error ? err.message : 'Произошла ошибка.');
  }, []);

  const clearAuthState = useCallback(() => {
    setUser(null);
  }, []);

  const applyAuth = useCallback(
    (authUser: User) => {
      setUser(authUser);
      setProfileForm(createProfileFormFromUser(authUser));
      router.replace(getDefaultPathForRole(authUser?.role, authUser?.permissions ?? []));
    },
    [router],
  );

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const data = isClientLastAuth()
        ? await api.client.profile().catch(() => api.getProfile())
        : await api.getProfile().catch(() => api.client.profile());
      rememberAuthKind(data.role);
      setUser(data);
      setProfileForm(createProfileFormFromUser(data));
    } catch {
      clearAuthState();
    } finally {
      setLoading(false);
      setIsAuthInitializing(false);
    }
  }, [clearAuthState]);

  useEffect(() => {
    const path = (router.pathname || '').split('?')[0];
    if (path !== '/auth/accept') return;

    let ignore = false;

    const acceptAuth = async () => {
      try {
        setLoading(true);
        const data = await api.getProfile();

        if (ignore) return;

        setUser(data);
        setProfileForm(createProfileFormFromUser(data));
        router.replace(getDefaultPathForRole(data.role, data.permissions ?? []));
      } catch {
        if (!ignore) {
          clearAuthState();
          router.replace('/');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
          setIsAuthInitializing(false);
        }
      }
    };

    void acceptAuth();

    return () => {
      ignore = true;
    };
  }, [clearAuthState, router]);

  useEffect(() => {
    const path = (router.pathname || '').split('?')[0];
    if (path === '/auth/accept') return;
    if (PUBLIC_AUTH_PATHS.includes(path)) {
      setIsAuthInitializing(false);
      return;
    }

    if (path.startsWith('/public/')) {
      setIsAuthInitializing(false);
      return;
    }

    if (path.startsWith('/client/set-password')) {
      setIsAuthInitializing(false);
      return;
    }

    fetchProfile();
  }, [fetchProfile, router.pathname]);

  // Общий шаг после входа и после подтверждения почты: сервер уже поставил cookies сессии.
  const completeAuth = useCallback(
    async (authUser: User) => {
      clearTokens();
      const profile =
        authUser?.role === 'CLIENT'
          ? authUser
          : await api.getProfile().catch(() => authUser);
      rememberAuthKind(profile.role);
      applyAuth(profile);
      return profile;
    },
    [applyAuth],
  );

  const onLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setLoading(true);
      setUnverifiedEmail(null);
      const payload = await api.login(loginForm);
      await completeAuth(payload.user);
      toast.success('Вы вошли в систему.');
    } catch (err) {
      if (
        err instanceof ApiRequestError &&
        err.body?.error_code === 'EMAIL_NOT_VERIFIED'
      ) {
        // Ошибку показываем у формы вместе с кнопкой повторной отправки письма.
        setUnverifiedEmail(err.body.email || loginForm.email);
        return;
      }
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  // Тихо перечитывает профиль, например после смены тарифа: меняются права и закрытые разделы.
  const reloadProfile = useCallback(async () => {
    try {
      const data = await api.getProfile();
      setUser(data);
    } catch {
      // Профиль останется прежним до следующей загрузки страницы.
    }
  }, []);

  // Раздел закрылся тарифом, а профиль ещё старый (компанию перевели на ФРИ):
  // перечитываем профиль, и экран сам покажет «Доступно на тарифе ПРО».
  const lockedFeatures = user?.locked_features;
  useEffect(() => {
    const onTariffFeatureLocked = (event: Event) => {
      const feature = (event as CustomEvent<TariffFeature | undefined>).detail;
      if (feature && lockedFeatures?.includes(feature)) return;
      void reloadProfile();
    };

    window.addEventListener(TARIFF_FEATURE_LOCKED_EVENT, onTariffFeatureLocked);
    return () =>
      window.removeEventListener(TARIFF_FEATURE_LOCKED_EVENT, onTariffFeatureLocked);
  }, [lockedFeatures, reloadProfile]);

  const onUpdateProfile = async () => {
    try {
      setIsUpdatingProfile(true);
      const data = await api.updateProfile(profileForm);
      setUser(data);
      toast.success('Профиль обновлён.');
    } catch (err) {
      handleError(err);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const onChangePassword = async () => {
    try {
      setIsUpdatingPassword(true);
      await api.changePassword(passwordForm);
      setPasswordForm({
        current_password: '',
        password: '',
        password_confirmation: '',
      });
      toast.success('Пароль изменен.');
    } catch (err) {
      handleError(err);
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const onLogout = async () => {
    try {
      if (user) {
        if (user.role === 'CLIENT') await api.client.logout();
        else await api.logout();
      }
    } catch (err) {
      handleError(err);
    } finally {
      clearTokens();
      clearAuthState();
      router.replace('/');
    }
  };

  return {
    user,
    loading,
    loginForm,
    profileForm,
    passwordForm,
    displayName,
    avatarFallback,
    isUpdatingPassword,
    isUpdatingProfile,
    isAuthInitializing,
    unverifiedEmail,
    setLoginForm,
    setProfileForm,
    setPasswordForm,
    completeAuth,
    reloadProfile,
    onLogin,
    onUpdateProfile,
    onChangePassword,
    onLogout,
  };
}
