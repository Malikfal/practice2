import { lazy, Suspense, type JSX } from 'react';

import AppLayout from './components/layout/AppLayout';
import Preloader from './components/ui/Preloader';
import { AppControllerProvider } from './context/AppControllerContext';
import { getExtraAllowedPathsForRole, getMenuItemsForRole } from './constants/app';
import { useAppController } from './hooks/useAppController';
import { getMenuPermissions } from './hooks/useTariffAccess';
import LoginPage from './pages/LoginPage';
import type { User } from './types/app';

// Страницы грузятся отдельными чанками: на входе не нужен код разделов.
const EmployeesPage = lazy(() => import('./pages/workspace/EmployeesPage'));
const ClientsPage = lazy(() => import('./pages/workspace/ClientsPage'));
const HomePage = lazy(() => import('./pages/workspace/HomePage'));
const FinancesPage = lazy(() => import('./pages/workspace/FinancesPage'));
const KnowledgeBasePage = lazy(() => import('./pages/workspace/KnowledgeBasePage'));
const PayrollPage = lazy(() => import('./pages/workspace/PayrollPage'));
const ProjectsPage = lazy(() => import('./pages/workspace/ProjectsPage'));
const ClientProjectsPage = lazy(() => import('./pages/ClientProjectsPage'));
const ReportsPage = lazy(() => import('./pages/workspace/ReportsPage'));
const SettingsPage = lazy(() => import('./pages/workspace/Settings'));
const TemplatesPage = lazy(() => import('./pages/workspace/TemplatesPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const DirectTaskPage = lazy(() => import('./pages/workspace/DirectTaskPage'));
const PublicTaskPage = lazy(() => import('./pages/PublicTaskPage'));
const ClientSetPasswordPage = lazy(() => import('./pages/ClientSetPasswordPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));

const APP_PAGE_NODES: Record<string, JSX.Element> = {
  '/home': <HomePage />,
  '/employees': <EmployeesPage />,
  '/projects': <ProjectsPage />,
  '/projects/templates': <TemplatesPage />,
  '/reports': <ReportsPage />,
  '/finances': <FinancesPage />,
  '/payroll': <PayrollPage />,
  '/clients': <ClientsPage />,
  '/knowledge-base': <KnowledgeBasePage />,
  '/settings': <SettingsPage />,
  '/tasks/direct/:taskId': <DirectTaskPage />,
};

function basePagePath(path: string) {
  if (path.startsWith('/settings/')) return '/settings';
  if (path.startsWith('/tasks/direct/')) return '/tasks/direct/:taskId';
  return path;
}

function resolvePage({ user, currentPath }: { user: User | null; currentPath: string }) {
  if (currentPath === '/register-company') {
    return { label: 'Регистрация компании', node: <RegisterPage /> };
  }

  if (currentPath === '/verify-email') {
    return { label: 'Подтверждение почты', node: <VerifyEmailPage /> };
  }

  if (currentPath === '/forgot-password') {
    return { label: 'Восстановление пароля', node: <ForgotPasswordPage /> };
  }

  if (currentPath === '/reset-password') {
    return { label: 'Новый пароль', node: <ResetPasswordPage /> };
  }

  if (currentPath.startsWith('/public/task/')) {
    return { label: 'Согласование задачи', node: <PublicTaskPage /> };
  }

  if (currentPath.startsWith('/client/set-password')) {
    return { label: 'Установка пароля', node: <ClientSetPasswordPage /> };
  }

  if (!user) return { label: 'Вход', node: <LoginPage /> };

  const pagePath = basePagePath(currentPath);
  const menuPermissions = getMenuPermissions(user);
  const page = getMenuItemsForRole(user.role, menuPermissions).find(
    (entry) => entry.path === pagePath,
  );

  if (page) {
    const node =
      user.role === 'CLIENT' && page.path === '/projects' ? (
        <ClientProjectsPage />
      ) : (
        (APP_PAGE_NODES[page.path] ?? null)
      );
    return { label: page.label, node };
  }

  const isExtraAllowedPath = getExtraAllowedPathsForRole(user.role, menuPermissions).some(
    (allowed) => {
      if (allowed.includes(':')) {
        const baseAllowed = allowed.split('/:')[0];
        return currentPath === baseAllowed || currentPath.startsWith(`${baseAllowed}/`);
      }
      return allowed === currentPath;
    },
  );

  if (isExtraAllowedPath) {
    const label = currentPath.startsWith('/tasks/direct/') ? 'Задача' : 'Раздел';
    return { label, node: APP_PAGE_NODES[pagePath] ?? null };
  }

  return { label: 'Раздел', node: null };
}

export default function App() {
  const controller = useAppController();

  if (controller.isAuthInitializing) {
    return (
      <div className='flex min-h-screen items-center justify-center'>
        <div className='h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500' />
      </div>
    );
  }

  const resolved = resolvePage({
    user: controller.user,
    currentPath: controller.currentPath,
  });
  // Пока старый адрес не заменён новым, страницу не монтируем: у неё свои редиректы.
  const { label, node } =
    controller.user && controller.legacyRedirectPath
      ? { label: resolved.label, node: null }
      : resolved;

  if (
    controller.currentPath.startsWith('/public/task/') ||
    controller.currentPath.startsWith('/client/set-password')
  ) {
    return (
      <AppControllerProvider value={controller}>
        <Suspense
          fallback={
            <div className='flex min-h-screen items-center justify-center bg-slate-50'>
              <Preloader size='lg' />
            </div>
          }
        >
          {node}
        </Suspense>
      </AppControllerProvider>
    );
  }

  return (
    <AppControllerProvider value={controller}>
      <AppLayout pageLabel={label}>{node}</AppLayout>
    </AppControllerProvider>
  );
}
