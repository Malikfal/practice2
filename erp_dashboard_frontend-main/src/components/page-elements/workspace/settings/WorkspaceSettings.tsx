import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';

import { api } from '../../../../api/api';
import type { TrackerSettings as TrackerSettingsData } from '../../../../types/app';
import CompanySettings from './CompanySettings';
import NotificationRulesPanel from './NotificationRulesPanel';
import TaskStatusSettingPanel from './TaskStatusSettingPanel';
import {
  WORKSPACE_SETTINGS_TAB_PATHS,
  type WorkspaceSettingsTab,
  joinClassNames,
  workspaceTabFromSettingsPath,
} from './settingsUtils';

const tabs: Array<{ key: WorkspaceSettingsTab; label: string }> = [
  { key: 'company', label: 'Настройка компании' },
  { key: 'tracker', label: 'Настройка трекера' },
  { key: 'client-tasks', label: 'Настройка статуса клиентских задач' },
  { key: 'notifications', label: 'Уведомления' },
];

export default function WorkspaceSettings({ canManage }: { canManage: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = useMemo(
    () => workspaceTabFromSettingsPath(location.pathname),
    [location.pathname],
  );
  const [settings, setSettings] = useState<TrackerSettingsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const tabsRef = useRef<HTMLDivElement | null>(null);

  // На узком экране полоса вкладок прокручивается: открытая по ссылке вкладка должна быть видна.
  useEffect(() => {
    const strip = tabsRef.current;
    const active = strip?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!strip || !active) return;
    strip.scrollLeft = active.offsetLeft - (strip.clientWidth - active.offsetWidth) / 2;
  }, [activeTab]);

  useEffect(() => {
    const expectedPath = WORKSPACE_SETTINGS_TAB_PATHS[activeTab];

    if (location.pathname !== expectedPath) {
      navigate(expectedPath, { replace: true });
    }
  }, [activeTab, location.pathname, navigate]);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setSettings(await api.workspace.settings.getTracker());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Произошла ошибка.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Настройки трекера нужны только вкладкам статусов задач.
    if (activeTab !== 'tracker' && activeTab !== 'client-tasks') return;
    void load();
  }, [activeTab, load]);

  const save = async (
    payload: Partial<
      Pick<TrackerSettingsData, 'default_task_status_name' | 'client_task_status_name'>
    >,
  ) => {
    try {
      setIsSaving(true);
      setSettings(await api.workspace.settings.updateTracker(payload));
      toast.success('Настройки сохранены.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Произошла ошибка.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className='flex min-h-0 flex-col overflow-visible rounded-xl border border-[#e3e9f3] bg-white text-[#1f3565] lg:h-full lg:overflow-hidden'>
      <div className='border-b border-[#e8eef8] bg-[linear-gradient(135deg,#f8fbff_0%,#eef4ff_100%)] px-3 py-4 md:px-5 md:py-5'>
        <div className='grid gap-4'>
          <div className='grid gap-2'>
            <h1 className='text-[20px] leading-tight font-semibold text-[#10275a] md:text-[24px] md:leading-none'>
              Настройки рабочего пространства
            </h1>
            <p className='max-w-[760px] text-[14px] leading-6 text-[#5f7095]'>
              Реквизиты и часовой пояс компании, статус новых задач трекера и задач
              клиентов, уведомления по задачам.
            </p>
          </div>

          <div
            ref={tabsRef}
            className='relative flex overflow-x-auto border-b border-[#dbe6fb]'
          >
            {tabs.map((tab) => (
              <Link
                key={tab.key}
                to={WORKSPACE_SETTINGS_TAB_PATHS[tab.key]}
                className={joinClassNames(
                  'min-h-11 min-w-max shrink-0 border-b-2 px-3 py-2 text-sm font-semibold transition-colors md:min-h-0 md:px-4',
                  activeTab === tab.key
                    ? 'border-[#2d6ff7] text-[#2d6ff7]'
                    : 'border-transparent text-[#7e8fb4] hover:text-[#1f3565]',
                )}
                aria-current={activeTab === tab.key ? 'page' : undefined}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className='min-h-0 flex-1 overflow-visible p-2 md:p-5 lg:overflow-auto'>
        {activeTab === 'company' ? (
          <CompanySettings embedded />
        ) : activeTab === 'notifications' ? (
          <NotificationRulesPanel canManage={canManage} />
        ) : isLoading || !settings ? (
          <div className='grid min-h-60 place-items-center rounded-xl border border-[#e3e9f3] bg-[#fbfcff]'>
            <div className='h-7 w-7 animate-spin rounded-full border-2 border-[#c9d8f8] border-t-[#2d6ff7]' />
          </div>
        ) : activeTab === 'tracker' ? (
          <TaskStatusSettingPanel
            key={`tracker:${settings.default_task_status_name}`}
            canManage={canManage}
            isSaving={isSaving}
            value={settings.default_task_status_name}
            availableStatuses={settings.available_statuses}
            title='Статус новых задач трекера'
            description='Статус подставляется в задачи, которые создают сотрудники. Для проекта используется одноимённый статус, если он есть среди его колонок.'
            currentHint='Будет выбран автоматически при создании задачи'
            resultText='Новые задачи будут создаваться со статусом'
            onSave={(value) => save({ default_task_status_name: value })}
          />
        ) : (
          <TaskStatusSettingPanel
            key={`client:${settings.client_task_status_name}`}
            canManage={canManage}
            isSaving={isSaving}
            value={settings.client_task_status_name}
            availableStatuses={settings.available_statuses}
            title='Статус клиентских задач'
            description='Статус подставляется в задачи, которые клиент создаёт в своём кабинете. Для проекта используется одноимённый статус, если он есть среди его колонок. Пока статус не выбран, действует статус новых задач трекера.'
            currentHint='Будет выбран автоматически, когда клиент создаёт задачу'
            resultText='Задачи клиентов будут создаваться со статусом'
            onSave={(value) => save({ client_task_status_name: value })}
          />
        )}
      </div>
    </section>
  );
}
