import { Fragment, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { api } from '../../../../api/api';
import Button from '../../../ui/Button';
import { HintToolTip } from '../../../ui/HintTooltip';
import { Table, TableContainer, TBody, Td, Th, THead, Tr } from '../../../ui/table';
import type { CompanyNotificationSettings } from '../../../../types/notifications';

type Matrix = Record<string, Record<string, boolean>>;

const SECTIONS: { key: 'task' | 'time'; title: string; hint: string | null }[] = [
  { key: 'task', title: 'Задачи', hint: null },
  {
    key: 'time',
    title: 'Учёт времени',
    hint: 'Ручные изменения рабочего времени. О действиях сотрудников с ролью «Админ» уведомления не приходят.',
  },
];

const RELATION_HINTS: Record<string, string> = {
  assignee: 'Сотрудники, назначенные на задачу в поле «Исполнители».',
  creator: 'Сотрудник, который создал задачу.',
  project_manager: 'Участники проекта с отметкой PM.',
  project_member:
    'Все сотрудники, добавленные в проект, включая PM. Самый широкий круг получателей.',
  watcher:
    'Сотрудники, которые следят за задачей, хотя не исполнители и не авторы: нажали «Следить за задачей» в окне задачи или автоматически начали следить, когда оставили комментарий или ответили клиенту. Автоподписку каждый может выключить в «Моих уведомлениях», а отказаться от наблюдения можно в окне задачи.',
  client:
    'Клиентские аккаунты проекта в кабинете клиента, если задача видна клиенту. Внутренние комментарии им не приходят.',
  admin: 'Сотрудники компании с ролью «Админ».',
};

function matrixFrom(
  settings: CompanyNotificationSettings,
  pick: 'enabled' | 'default',
): Matrix {
  return Object.fromEntries(
    settings.events.map((event) => [
      event.key,
      Object.fromEntries(
        Object.entries(event.relations)
          .filter(([, cell]) => cell.allowed)
          .map(([relation, cell]) => [relation, cell[pick]]),
      ),
    ]),
  );
}

export default function NotificationRulesPanel({ canManage }: { canManage: boolean }) {
  const [settings, setSettings] = useState<CompanyNotificationSettings | null>(null);
  const [draft, setDraft] = useState<Matrix>({});
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let isActive = true;
    api.notifications
      .getCompanySettings()
      .then((data) => {
        if (!isActive) return;
        setSettings(data);
        setDraft(matrixFrom(data, 'enabled'));
      })
      .catch((error) => {
        if (isActive) {
          setLoadError(
            error instanceof Error ? error.message : 'Не удалось загрузить настройки.',
          );
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  const saved = useMemo(
    () => (settings ? matrixFrom(settings, 'enabled') : {}),
    [settings],
  );
  const defaults = useMemo(
    () => (settings ? matrixFrom(settings, 'default') : {}),
    [settings],
  );
  const changedCells = useMemo(
    () =>
      Object.entries(draft).flatMap(([event, relations]) =>
        Object.entries(relations)
          .filter(([relation, enabled]) => saved[event]?.[relation] !== enabled)
          .map(([relation, enabled]) => ({ event, relation, enabled })),
      ),
    [draft, saved],
  );
  const isDefault = useMemo(
    () =>
      Object.entries(draft).every(([event, relations]) =>
        Object.entries(relations).every(
          ([relation, enabled]) => defaults[event]?.[relation] === enabled,
        ),
      ),
    [draft, defaults],
  );

  const toggle = (event: string, relation: string) => {
    setDraft((current) => ({
      ...current,
      [event]: { ...current[event], [relation]: !current[event]?.[relation] },
    }));
  };

  const save = async () => {
    if (changedCells.length === 0) return;
    try {
      setIsSaving(true);
      const data = await api.notifications.updateCompanySettings(changedCells);
      setSettings(data);
      setDraft(matrixFrom(data, 'enabled'));
      toast.success('Настройки сохранены.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Произошла ошибка.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loadError) {
    return (
      <div className='grid min-h-60 place-items-center rounded-xl border border-[#e3e9f3] bg-[#fbfcff] px-4 text-center text-sm text-[#c2410c]'>
        {loadError}
      </div>
    );
  }

  if (!settings) {
    return (
      <div className='grid min-h-60 place-items-center rounded-xl border border-[#e3e9f3] bg-[#fbfcff]'>
        <div className='h-7 w-7 animate-spin rounded-full border-2 border-[#c9d8f8] border-t-[#2d6ff7]' />
      </div>
    );
  }

  const isDisabled = !canManage || isSaving;
  // Задачи настраиваются по связям с задачей, учёт времени — по ролям: у таблиц свои столбцы.
  const sections = SECTIONS.map((section) => {
    const groups = settings.groups.filter(
      (group) => (group.scope ?? 'task') === section.key,
    );
    const groupKeys = new Set(groups.map((group) => group.key));
    const events = settings.events.filter((event) => groupKeys.has(event.group));
    const relations = settings.relations.filter((relation) =>
      events.some((event) => event.relations[relation.key]?.allowed),
    );

    return { ...section, groups, events, relations };
  }).filter((section) => section.events.length > 0);

  return (
    <section className='grid gap-4 rounded-xl border border-[#e3e9f3] bg-[#fbfcff] p-3 md:p-4'>
      <div className='grid gap-1.5'>
        <h2 className='text-[17px] font-semibold text-[#10275a]'>
          Кому приходят уведомления
        </h2>
        <p className='max-w-[860px] text-[13px] leading-5 text-[#5f7095]'>
          Отметьте, кому сообщать о событии. Автор действия уведомление не получает, а
          сотрудник получает его, только если видит задачу. Внутренние комментарии клиенту
          не отправляются никогда. Каждый может выключить событие у себя в «Моих
          уведомлениях» или отключить уведомления по отдельной задаче.
        </p>
        {!canManage ? (
          <p className='text-[12px] text-[#7e8fb4]'>
            Только просмотр: для изменения нужно право «Управление настройками».
          </p>
        ) : null}
      </div>

      {sections.map((section) => (
        <div key={section.key} className='hidden gap-2 md:grid'>
          {sections.length > 1 ? (
            <div className='grid gap-0.5'>
              <h3 className='text-[14px] font-semibold text-[#10275a]'>
                {section.title}
              </h3>
              {section.hint ? (
                <p className='text-[12px] leading-4 text-[#7e8fb4]'>{section.hint}</p>
              ) : null}
            </div>
          ) : null}
          <TableContainer>
            <Table striped={false}>
              <THead>
                <tr>
                  <Th pin='left' className='min-w-56'>
                    Событие
                  </Th>
                  {section.relations.map((relation) => (
                    <Th key={relation.key} align='center' className='min-w-28'>
                      <span className='inline-flex items-center gap-1.5'>
                        {relation.label}
                        {RELATION_HINTS[relation.key] ? (
                          <HintToolTip
                            content={RELATION_HINTS[relation.key]}
                            className='font-normal normal-case'
                          />
                        ) : null}
                      </span>
                    </Th>
                  ))}
                </tr>
              </THead>
              <TBody>
                {section.groups.map((group) => (
                  <Fragment key={group.key}>
                    {section.groups.length > 1 ? (
                      <Tr background='bg-[#eff4ff]' hoverable={false}>
                        <Td
                          colSpan={section.relations.length + 1}
                          className='text-xs font-semibold tracking-wide text-[#5a6f9f] uppercase'
                        >
                          {group.label}
                        </Td>
                      </Tr>
                    ) : null}
                    {section.events
                      .filter((event) => event.group === group.key)
                      .map((event) => (
                        <Tr key={event.key}>
                          <Td pin='left'>
                            <div className='font-medium text-[#1f3565]'>
                              {event.label}
                            </div>
                            <div className='text-[12px] leading-4 text-[#7e8fb4]'>
                              {event.hint}
                            </div>
                          </Td>
                          {section.relations.map((relation) => {
                            const cell = event.relations[relation.key];

                            return (
                              <Td key={relation.key} align='center'>
                                {cell?.allowed ? (
                                  <input
                                    type='checkbox'
                                    className='size-4.5 accent-[#2d6ff7]'
                                    checked={draft[event.key]?.[relation.key] ?? false}
                                    disabled={isDisabled}
                                    aria-label={`${event.label}: ${relation.label}`}
                                    onChange={() => toggle(event.key, relation.key)}
                                  />
                                ) : (
                                  <span className='text-[11px] text-slate-400'>—</span>
                                )}
                              </Td>
                            );
                          })}
                        </Tr>
                      ))}
                  </Fragment>
                ))}
              </TBody>
            </Table>
          </TableContainer>
        </div>
      ))}

      <div className='grid gap-3 md:hidden'>
        <details className='rounded-xl border border-[#dce7ff] bg-white px-3 py-2 text-[13px] text-[#1f3565]'>
          <summary className='cursor-pointer font-medium text-[#35568f]'>
            Кто есть кто
          </summary>
          <dl className='mt-2 grid gap-2'>
            {settings.relations
              .filter((relation) => RELATION_HINTS[relation.key])
              .map((relation) => (
                <div key={relation.key}>
                  <dt className='font-medium'>{relation.label}</dt>
                  <dd className='text-[12px] leading-4 text-[#7e8fb4]'>
                    {RELATION_HINTS[relation.key]}
                  </dd>
                </div>
              ))}
          </dl>
        </details>
        {settings.groups.map((group) => (
          <section
            key={group.key}
            className='overflow-hidden rounded-xl border border-[#dce7ff] bg-white'
          >
            <div className='bg-[#eff4ff] px-3 py-2 text-sm font-semibold text-[#35568f]'>
              {group.label}
              {group.scope === 'time' ? (
                <div className='mt-0.5 text-[12px] leading-4 font-normal text-[#7e8fb4]'>
                  {SECTIONS.find((section) => section.key === 'time')?.hint}
                </div>
              ) : null}
            </div>
            <div className='grid divide-y divide-[#eef2f8]'>
              {settings.events
                .filter((event) => event.group === group.key)
                .map((event) => (
                  <div key={event.key} className='grid gap-2 p-3'>
                    <div>
                      <div className='text-sm font-medium text-[#1f3565]'>
                        {event.label}
                      </div>
                      <div className='text-[12px] leading-4 text-[#7e8fb4]'>
                        {event.hint}
                      </div>
                    </div>
                    <div className='flex flex-wrap gap-x-4 gap-y-2'>
                      {settings.relations
                        .filter((relation) => event.relations[relation.key]?.allowed)
                        .map((relation) => (
                          <label
                            key={relation.key}
                            className='flex items-center gap-2 text-[13px] text-[#1f3565]'
                          >
                            <input
                              type='checkbox'
                              className='size-5 accent-[#2d6ff7]'
                              checked={draft[event.key]?.[relation.key] ?? false}
                              disabled={isDisabled}
                              onChange={() => toggle(event.key, relation.key)}
                            />
                            {relation.label}
                          </label>
                        ))}
                    </div>
                  </div>
                ))}
            </div>
          </section>
        ))}
      </div>

      {canManage ? (
        <div className='grid gap-2 sm:flex sm:items-center sm:justify-end'>
          <Button
            type='button'
            variant='secondary'
            size='sm'
            disabled={isDefault || isSaving}
            onClick={() => setDraft(defaults)}
          >
            Вернуть значения по умолчанию
          </Button>
          <Button
            type='button'
            size='sm'
            disabled={changedCells.length === 0 || isSaving}
            onClick={() => void save()}
          >
            {isSaving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
