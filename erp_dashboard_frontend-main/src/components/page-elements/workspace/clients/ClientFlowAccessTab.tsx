import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '../../../../api/api';
import type { Client, ClientFlowAccount } from '../../../../types/app';
import Button from '../../../ui/Button';
import { Select } from '../../../ui/FormField';
import { copyToClipboard } from '../../../../utils/clipboard';
import { ChipsMultiSelect } from '../../../modals/ProjectTeamModal';
import { TextInput } from './ClientPageComponents';

export default function ClientFlowAccessTab({ client }: { client: Client }) {
  const [accounts, setAccounts] = useState<ClientFlowAccount[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [contactId, setContactId] = useState('');
  const [allProjects, setAllProjects] = useState(true);
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  // Последняя выданная ссылка по аккаунту: показываем её в поле, чтобы можно было скопировать вручную.
  const [inviteUrls, setInviteUrls] = useState<Record<string, string>>({});
  const projectOptions = projects.map((project) => ({
    value: project.id,
    label: project.name,
  }));
  const reload = useCallback(
    () =>
      Promise.all([
        api.workspace.clients.flowAccounts(client.id).then(setAccounts),
        api.workspace.clients.flowProjects(client.id).then(setProjects),
      ]).catch((error: unknown) =>
        toast.error(
          error instanceof Error ? error.message : 'Не удалось загрузить доступ.',
        ),
      ),
    [client.id],
  );
  useEffect(() => {
    void reload();
  }, [reload]);

  const copyInviteUrl = async (url: string) => {
    try {
      await copyToClipboard(url);
      toast.success('Ссылка для входа скопирована. Она действует 24 часа.');
    } catch {
      toast.info('Скопируйте ссылку из поля под аккаунтом. Она действует 24 часа.');
    }
  };

  const showInviteUrl = async (accountId: string, url: string) => {
    setInviteUrls((current) => ({ ...current, [accountId]: url }));
    await copyInviteUrl(url);
  };

  const create = async () => {
    try {
      setLoading(true);
      const response = await api.workspace.clients.createFlowAccount(client.id, {
        ...(contactId ? { contact_id: contactId } : { name, email }),
        all_projects: allProjects,
        project_ids: allProjects ? [] : projectIds,
      });
      setName('');
      setEmail('');
      setContactId('');
      setAllProjects(true);
      setProjectIds([]);
      await reload();
      await showInviteUrl(response.data.id, response.invite_url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось создать доступ.');
    } finally {
      setLoading(false);
    }
  };

  const toggle = async (
    account: ClientFlowAccount,
    patch: Record<string, unknown>,
  ): Promise<boolean> => {
    try {
      await api.workspace.clients.updateFlowAccount(client.id, account.id, patch);
      await reload();
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось обновить доступ.');
      return false;
    }
  };

  return (
    <div className='grid gap-4'>
      <div className='grid gap-4 rounded-xl border border-[#e3e9f3] p-4'>
        <h2 className='text-[18px] font-semibold text-[#10275a]'>
          Создать аккаунт клиента
        </h2>
        <Select
          tone='client'
          value={contactId}
          onChange={(e) => setContactId(e.target.value)}
        >
          <option value=''>Ввести имя и email</option>
          {(client.contacts ?? [])
            .filter((contact) => contact.email)
            .map((contact) => (
              <option key={contact.id} value={contact.id}>
                {[contact.first_name, contact.last_name].filter(Boolean).join(' ')} —{' '}
                {contact.email}
              </option>
            ))}
        </Select>
        {!contactId && (
          <div className='grid gap-2.5 md:grid-cols-2'>
            <TextInput
              label='Имя'
              required
              placeholder='Иван Иванов'
              value={name}
              onChange={setName}
            />
            <TextInput
              label='Email'
              type='email'
              required
              placeholder='ivan@company.ru'
              value={email}
              onChange={setEmail}
            />
          </div>
        )}
        <div className='grid gap-2 rounded-xl border border-[#dbe6ff] bg-white p-3'>
          <label className='flex items-start gap-2 text-[14px] font-medium text-[#1f3565]'>
            <input
              type='checkbox'
              className='mt-0.5'
              checked={allProjects}
              onChange={(e) => setAllProjects(e.target.checked)}
            />
            <span>Все проекты клиента, включая будущие</span>
          </label>
          {!allProjects ? (
            <ChipsMultiSelect
              values={projectIds}
              onChange={setProjectIds}
              options={projectOptions}
              placeholder='Выберите проекты'
              emptyText={
                projects.length === 0
                  ? 'У клиента нет активных проектов'
                  : 'Все проекты выбраны'
              }
            />
          ) : null}
        </div>
        <Button
          type='button'
          disabled={loading || (!contactId && (!name || !email))}
          onClick={() => void create()}
          className='justify-self-start'
        >
          Создать доступ
        </Button>
      </div>
      <div className='grid gap-4'>
        <div className='grid gap-1'>
          <h2 className='text-[18px] font-semibold text-[#10275a]'>Аккаунты</h2>
          <p className='text-sm text-[#7e8fb4]'>
            Клиент видит все свои проекты, включая архивные и внутренние. Архивные проекты
            открыты только для просмотра.
          </p>
        </div>
        {accounts.length === 0 ? (
          <p className='text-sm text-[#7e8fb4]'>Аккаунтов пока нет.</p>
        ) : (
          accounts.map((account) => (
            <article
              key={account.id}
              className='grid gap-2 rounded-xl border border-[#e3e9f3] p-4 md:grid-cols-[1fr_auto]'
            >
              <div>
                <div className='font-semibold text-[#10275a]'>
                  {account.name}{' '}
                  <span className={account.active ? 'text-green-700' : 'text-red-600'}>
                    · {account.active ? 'Активен' : 'Отключен'}
                  </span>
                </div>
                <div className='text-sm text-[#7e8fb4]'>
                  {account.email} ·{' '}
                  {account.all_projects
                    ? projects.length === 1
                      ? `Все проекты клиента: ${projects[0].name}`
                      : 'Все проекты клиента'
                    : account.projects.join(', ') || 'Нет проектов'}{' '}
                  · вход:{' '}
                  {account.last_login_at
                    ? new Date(account.last_login_at).toLocaleString()
                    : 'не выполнялся'}
                  {!account.password_set ? ' · пароль не установлен' : ''}
                </div>
              </div>
              <div className='flex flex-wrap items-center gap-2'>
                <label className='flex items-center gap-2 text-[14px] font-medium text-[#1f3565]'>
                  <input
                    type='checkbox'
                    checked={account.all_projects}
                    onChange={(e) =>
                      void toggle(account, { all_projects: e.target.checked })
                    }
                  />
                  Все проекты
                </label>
                <Button
                  type='button'
                  variant='secondary'
                  size='sm'
                  onClick={() => void toggle(account, { active: !account.active })}
                >
                  {account.active ? 'Отключить' : 'Включить'}
                </Button>
                <Button
                  type='button'
                  variant='secondary'
                  size='sm'
                  disabled={!account.active}
                  title='Новая ссылка для первого входа или сброса пароля. Прежняя ссылка перестанет работать.'
                  onClick={() => {
                    void api.workspace.clients
                      .sendFlowPasswordLink(client.id, account.id)
                      .then((response) => showInviteUrl(account.id, response.invite_url))
                      .catch((error: unknown) =>
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : 'Не удалось создать ссылку.',
                        ),
                      );
                  }}
                >
                  Ссылка для входа
                </Button>
              </div>
              {inviteUrls[account.id] && account.active ? (
                <div className='grid gap-1 md:col-span-2'>
                  <span className='text-[13px] font-medium text-[#7e8fb4]'>
                    Ссылка для входа · действует 24 часа, прежние ссылки больше не
                    работают
                  </span>
                  <div className='flex gap-2'>
                    <input
                      readOnly
                      value={inviteUrls[account.id]}
                      onFocus={(event) => event.currentTarget.select()}
                      className='h-9 min-w-0 flex-1 rounded-lg border border-[#dbe6ff] bg-[#f7f9fc] px-3 text-[13px] text-[#1f3565] outline-none focus:border-[#2d6ff7]'
                    />
                    <Button
                      type='button'
                      size='sm'
                      onClick={() => void copyInviteUrl(inviteUrls[account.id])}
                    >
                      Копировать
                    </Button>
                  </div>
                </div>
              ) : null}
              {account.all_projects && projects.length > 1 ? (
                <div className='grid gap-2 md:col-span-2'>
                  <span className='text-[13px] font-medium text-[#7e8fb4]'>
                    Проекты в кабинете клиента ({projects.length})
                  </span>
                  <div className='flex flex-wrap gap-1.5'>
                    {projects.map((project) => (
                      <span
                        key={project.id}
                        className='inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700'
                      >
                        {project.name}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {!account.all_projects ? (
                <div className='grid gap-2 md:col-span-2'>
                  <span className='text-[13px] font-medium text-[#7e8fb4]'>
                    Проекты в кабинете клиента
                  </span>
                  <ChipsMultiSelect
                    values={account.project_ids}
                    onChange={(projectIds) =>
                      void toggle(account, { project_ids: projectIds })
                    }
                    options={projectOptions}
                    placeholder='Выберите проекты'
                    emptyText={
                      projects.length === 0
                        ? 'У клиента нет активных проектов'
                        : 'Все проекты выбраны'
                    }
                  />
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>
    </div>
  );
}
