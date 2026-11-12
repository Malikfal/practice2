import { createContext, useContext, type ReactNode } from 'react';
import type { useAppController } from '../hooks/useAppController';

type AppController = ReturnType<typeof useAppController>;

const AppControllerContext = createContext<AppController | null>(null);

export function AppControllerProvider({
  value,
  children,
}: {
  value: AppController;
  children: ReactNode;
}) {
  return (
    <AppControllerContext.Provider value={value}>
      {children}
    </AppControllerContext.Provider>
  );
}

export function useAppControllerContext(): AppController {
  const context = useContext(AppControllerContext);
  if (!context) {
    throw new Error('useAppControllerContext must be used inside AppControllerProvider');
  }
  return context;
}
