import { useEffect, useState, type CSSProperties } from 'react';

import { useTariffAccess } from '../../../../hooks/useTariffAccess';
import ProBadge from '../../../tariff/ProBadge';
import ProFeatureLock from '../../../tariff/ProFeatureLock';
import Button from '../../../ui/Button';
import TablePagination from '../../../ui/TablePagination';
import {
  Table,
  TableActionButton,
  TableActions,
  TableContainer,
  TableEmptyRow,
  TableLoadingRow,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '../../../ui/table';
import ClientFinanceTab from './ClientFinanceTab';
import ClientFlowAccessTab from './ClientFlowAccessTab';
import { formatDateLocal, formatHoursCompact } from '../../../../utils/formatters';
import type {
  Client,
  ClientContact,
  ClientForm,
  ClientLegalEntity,
  ClientProject,
} from '../../../../types/app';

import {
  Actions,
  BankDetailText,
  type ClientTab,
  EmptyState,
  type FieldErrors,
  fullContactName,
  InfoBox,
  ProjectCard,
  TextInput,
} from './ClientPageComponents';

function ContactsCount({ contacts }: { contacts: ClientContact[] }) {
  const contactsCount = contacts.length;

  return (
    <div
      className='flex items-center justify-center gap-1.5 text-[13px] font-medium text-[#2d6ff7]'
      title={`Количество контактов: ${contactsCount}`}
    >
      <svg
        viewBox='0 0 24 24'
        className='size-5 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]'
        aria-hidden='true'
      >
        <path d='M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2' />
        <circle cx='12' cy='7' r='4' />
      </svg>
      <span>{contactsCount}</span>
    </div>
  );
}

function ClientProjectsLinks({ projects }: { projects: ClientProject[] }) {
  if (!projects.length) return <span className='text-[#7e8fb4]'>—</span>;

  return (
    <div className='flex flex-wrap gap-x-1 gap-y-0.5 text-[#1f3565]'>
      {projects.map((project, index) => (
        <span key={project.id} className='inline-flex min-w-0 items-baseline'>
          {index > 0 ? <span className='pr-1 text-[#7e8fb4]'>,</span> : null}
          <a
            href={`/projects?project_id=${project.id}`}
            className='max-w-60 truncate text-[#2d6ff7] hover:underline'
            onClick={(event) => event.stopPropagation()}
            title={project.name}
          >
            {project.name}
          </a>
        </span>
      ))}
    </div>
  );
}

export function ClientDetails({
  client,
  selectedTab,
  canEdit,
  canDelete,
  canViewFinances,
  canManageFinances,
  canManageFlowAccess,
  onSelectTab,
  isSaving,
  errors,
  onClose,
  onSaveClient,
  onClearErrors,
  onCreateContact,
  onEditContact,
  onDeleteContact,
  onCreateLegalEntity,
  onEditLegalEntity,
  onDeleteLegalEntity,
  onCreateProject,
}: {
  client: Client;
  selectedTab: ClientTab;
  canEdit: boolean;
  canDelete: boolean;
  canViewFinances: boolean;
  canManageFinances: boolean;
  canManageFlowAccess: boolean;
  isSaving: boolean;
  errors: FieldErrors;
  onSelectTab: (_tab: ClientTab) => void;
  onClose: () => void;
  onSaveClient: (_form: ClientForm) => Promise<void>;
  onClearErrors: () => void;
  onCreateContact: () => void;
  onEditContact: (_contact: ClientContact) => void;
  onDeleteContact: (_contactId: string) => void;
  onCreateLegalEntity: () => void;
  onEditLegalEntity: (_entity: ClientLegalEntity) => void;
  onDeleteLegalEntity: (_entityId: string) => void;
  onCreateProject: () => void;
}) {
  const tariffAccess = useTariffAccess();
  // На ФРИ клиентский доступ закрыт: вкладка остаётся с меткой «ПРО» и заглушкой.
  const isFlowTabProLocked =
    !canManageFlowAccess && tariffAccess.isPermissionLocked('clients.flow_access.manage');
  const tabs: Array<[ClientTab, string]> = [
    ['general', 'Общие данные'],
    ['contacts', `Контакты (${client.contacts?.length ?? 0})`],
    ['legal', `Юр. лица (${client.legal_entities?.length ?? 0})`],
    ['projects', `Проекты (${client.projects?.length ?? 0})`],
    ...(canViewFinances ? [['finances', 'Финансы'] as [ClientTab, string]] : []),
    ...(canManageFlowAccess || isFlowTabProLocked
      ? [['flow', 'Доступ в ФЛОУ'] as [ClientTab, string]]
      : []),
  ];

  return (
    <section className='flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[#e3e9f3] bg-white text-[#1f3565]'>
      <div className='flex items-center justify-between border-b border-[#e3e9f3] px-5 py-4'>
        <h1 className='truncate text-[24px] font-semibold text-[#10275a]'>
          {client.name}
        </h1>
        <button
          type='button'
          className='grid size-9 place-items-center rounded-lg border border-[#e3e9f3] text-[#7e8fb4] hover:bg-[#f3f7ff] hover:text-[#1f3565]'
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div
        className='grid grid-cols-2 border-b border-[#e3e9f3] text-[13px] font-semibold md:grid-cols-[repeat(var(--client-tab-count),minmax(0,1fr))]'
        style={{ '--client-tab-count': tabs.length } as CSSProperties}
      >
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type='button'
            className={`min-h-11 border-r border-[#e3e9f3] px-3 py-2 last:border-r-0 ${selectedTab === key ? 'bg-[#edf3ff] text-[#2d6ff7]' : 'bg-white hover:bg-[#f3f7ff]'}`}
            onClick={() => onSelectTab(key)}
          >
            {label}
            {key === 'flow' && isFlowTabProLocked ? (
              <ProBadge className='ml-1.5 align-middle' />
            ) : null}
          </button>
        ))}
      </div>
      <div className='min-h-0 flex-1 overflow-auto p-4'>
        {selectedTab === 'general' ? (
          <GeneralTab
            key={client.id}
            client={client}
            canEdit={canEdit}
            isSaving={isSaving}
            errors={errors}
            onSave={onSaveClient}
            onClearErrors={onClearErrors}
          />
        ) : selectedTab === 'contacts' ? (
          <ContactsTab
            contacts={client.contacts ?? []}
            canEdit={canEdit}
            canDelete={canDelete}
            onCreateContact={onCreateContact}
            onEditContact={onEditContact}
            onDeleteContact={onDeleteContact}
          />
        ) : selectedTab === 'legal' ? (
          <LegalEntitiesTab
            entities={client.legal_entities ?? []}
            canEdit={canEdit}
            canDelete={canDelete}
            onCreateLegalEntity={onCreateLegalEntity}
            onEditLegalEntity={onEditLegalEntity}
            onDeleteLegalEntity={onDeleteLegalEntity}
          />
        ) : selectedTab === 'projects' ? (
          <ProjectsTab
            projects={client.projects ?? []}
            canEdit={canEdit}
            onCreateProject={onCreateProject}
          />
        ) : selectedTab === 'finances' && canViewFinances ? (
          <ClientFinanceTab client={client} canManage={canManageFinances} />
        ) : selectedTab === 'flow' && isFlowTabProLocked ? (
          <ProFeatureLock
            feature='client_access'
            screen='client_flow_access'
            variant='inline'
          />
        ) : selectedTab === 'flow' && canManageFlowAccess ? (
          <ClientFlowAccessTab client={client} />
        ) : null}
      </div>
    </section>
  );
}

function clientToForm(client: Client): Required<ClientForm> {
  return {
    name: client.name,
    description: client.description ?? '',
    weekly_limit_hours: formatHoursCompact(client.weekly_limit_seconds),
  };
}

// Поля редактируются на месте, без модалки: кнопки активны, пока есть несохранённые правки.
function GeneralTab({
  client,
  canEdit,
  isSaving,
  errors,
  onSave,
  onClearErrors,
}: {
  client: Client;
  canEdit: boolean;
  isSaving: boolean;
  errors: FieldErrors;
  onSave: (_form: ClientForm) => Promise<void>;
  onClearErrors: () => void;
}) {
  const saved = clientToForm(client);
  const [form, setForm] = useState(saved);

  // После сохранения клиент приходит с сервера — показываем значения в его записи (7.5 → 7,5).
  useEffect(() => {
    setForm(clientToForm(client));
  }, [client]);
  const isDirty =
    form.name !== saved.name ||
    form.description !== saved.description ||
    form.weekly_limit_hours.trim() !== saved.weekly_limit_hours;

  const change = (next: Partial<ClientForm>) => {
    setForm((current) => ({ ...current, ...next }));
    onClearErrors();
  };

  return (
    <form
      className='grid gap-4'
      onSubmit={(event) => {
        event.preventDefault();
        if (canEdit && isDirty && !isSaving) void onSave(form);
      }}
    >
      <h2 className='text-[18px] font-semibold text-[#10275a]'>Информация</h2>
      <TextInput
        label='Наименование'
        required
        value={form.name}
        error={errors.name}
        placeholder='ООО Компания'
        readOnly={!canEdit}
        onChange={(name) => change({ name })}
      />
      <TextInput
        label='Дополнительно'
        textarea
        value={form.description}
        error={errors.description}
        placeholder={canEdit ? 'Введите дополнительную информацию...' : undefined}
        readOnly={!canEdit}
        onChange={(description) => change({ description })}
      />
      <TextInput
        label='Недельный лимит, ч'
        inputMode='decimal'
        value={form.weekly_limit_hours}
        error={errors.weekly_limit_hours}
        placeholder={canEdit ? 'Не задан, например 15 или 7,5' : 'Не задан'}
        hint='Общий на все проекты клиента и главнее лимита проекта. Пусто — без лимита.'
        readOnly={!canEdit}
        onChange={(weekly_limit_hours) => change({ weekly_limit_hours })}
      />
      {canEdit ? (
        <div className='flex justify-end gap-2'>
          {isDirty ? (
            <Button
              type='button'
              variant='secondary'
              disabled={isSaving}
              onClick={() => {
                setForm(saved);
                onClearErrors();
              }}
            >
              Отменить
            </Button>
          ) : null}
          <Button type='submit' disabled={!isDirty || isSaving}>
            {isSaving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      ) : null}
    </form>
  );
}

function ContactsTab({
  contacts,
  canEdit,
  canDelete,
  onCreateContact,
  onEditContact,
  onDeleteContact,
}: {
  contacts: ClientContact[];
  canEdit: boolean;
  canDelete: boolean;
  onCreateContact: () => void;
  onEditContact: (_contact: ClientContact) => void;
  onDeleteContact: (_contactId: string) => void;
}) {
  return (
    <div className='grid gap-3'>
      {canEdit ? (
        <PrimaryActionButton onClick={onCreateContact}>
          + Добавить контакт
        </PrimaryActionButton>
      ) : null}
      {contacts.map((contact) => (
        <article
          key={contact.id}
          className='rounded-xl border border-[#e3e9f3] bg-white p-4'
        >
          <div className='flex items-start justify-between gap-3'>
            <div>
              <h3 className='text-[16px] font-bold text-[#10275a]'>
                {fullContactName(contact) || contact.first_name}
              </h3>
              {contact.position ? (
                <p className='mt-2 text-[13px] text-[#7e8fb4]'>{contact.position}</p>
              ) : null}
              {contact.email ? (
                <a
                  className='block text-[13px] text-[#2d6ff7] hover:underline'
                  href={`mailto:${contact.email}`}
                >
                  {contact.email}
                </a>
              ) : null}
              {contact.phone ? (
                <a
                  className='block text-[13px] text-[#2d6ff7] hover:underline'
                  href={`tel:${contact.phone}`}
                >
                  {contact.phone}
                </a>
              ) : null}
            </div>
            <Actions
              canEdit={canEdit}
              canDelete={canDelete}
              onEdit={() => onEditContact(contact)}
              onDelete={() => contact.id && onDeleteContact(contact.id)}
            />
          </div>
          {contact.payload && Object.keys(contact.payload).length ? (
            <div className='mt-3'>
              <p className='text-[13px] font-semibold text-[#7e8fb4]'>
                Дополнительные поля
              </p>
              <InfoBox
                rows={Object.entries(contact.payload).map(([key, value]) => [
                  key,
                  typeof value === 'string'
                    ? value
                    : value == null
                      ? ''
                      : JSON.stringify(value),
                ])}
              />
            </div>
          ) : null}
          {contact.comments ? (
            <div className='mt-3 rounded-xl bg-[#f7f9fc] p-3 text-[13px]'>
              {contact.comments}
            </div>
          ) : null}
        </article>
      ))}
      {!contacts.length ? <EmptyState text='Контактов пока нет' /> : null}
    </div>
  );
}

function LegalEntitiesTab({
  entities,
  canEdit,
  canDelete,
  onCreateLegalEntity,
  onEditLegalEntity,
  onDeleteLegalEntity,
}: {
  entities: ClientLegalEntity[];
  canEdit: boolean;
  canDelete: boolean;
  onCreateLegalEntity: () => void;
  onEditLegalEntity: (_entity: ClientLegalEntity) => void;
  onDeleteLegalEntity: (_entityId: string) => void;
}) {
  return (
    <div className='grid gap-3'>
      {canEdit ? (
        <PrimaryActionButton onClick={onCreateLegalEntity}>
          + Добавить юр. лицо
        </PrimaryActionButton>
      ) : null}
      {entities.map((entity) => (
        <article
          key={entity.id}
          className='rounded-xl border border-[#e3e9f3] bg-white p-4'
        >
          <div className='mb-3 flex items-start justify-between gap-3'>
            <div>
              <h3 className='text-[16px] font-bold text-[#10275a]'>{entity.name}</h3>
              <p className='text-[13px] text-[#7e8fb4]'>Основные данные</p>
            </div>
            <Actions
              canEdit={canEdit}
              canDelete={canDelete}
              onEdit={() => onEditLegalEntity(entity)}
              onDelete={() => entity.id && onDeleteLegalEntity(entity.id)}
            />
          </div>
          <InfoBox
            rows={[
              ['Юридический адрес', entity.legal_address],
              ['Почтовый индекс', entity.postal_code],
              ['ИНН', entity.inn],
              ['КПП', entity.kpp],
              ['ОГРН', entity.ogrn],
            ]}
          />
          <p className='mt-3 text-[13px] font-semibold text-[#7e8fb4]'>Подписант</p>
          <InfoBox
            rows={[
              [
                'ФИО',
                [
                  entity.signer_last_name,
                  entity.signer_first_name,
                  entity.signer_middle_name,
                ]
                  .filter(Boolean)
                  .join(' '),
              ],
              ['Должность', entity.signer_position],
            ]}
          />
          <p className='mt-3 text-[13px] font-semibold text-[#7e8fb4]'>Контакты</p>
          <InfoBox
            rows={[
              ['Телефон', entity.phone],
              ['Email', entity.email],
            ]}
          />
          <div className='mt-3 grid gap-2'>
            <p className='text-[13px] font-semibold text-[#7e8fb4]'>
              Банковские реквизиты
            </p>
            {(entity.bank_details ?? []).map((detail) => (
              <div
                key={detail.id}
                className='rounded-xl border border-[#e3e9f3] bg-[#fbfcff] p-3 text-[13px]'
              >
                <BankDetailText detail={detail} />
              </div>
            ))}
          </div>
        </article>
      ))}
      {!entities.length ? <EmptyState text='Юридических лиц пока нет' /> : null}
    </div>
  );
}

function ProjectsTab({
  projects,
  canEdit,
  onCreateProject,
}: {
  projects: Client['projects'];
  canEdit: boolean;
  onCreateProject: () => void;
}) {
  return (
    <div className='grid gap-3'>
      {canEdit ? (
        <PrimaryActionButton onClick={onCreateProject}>
          + Добавить проект
        </PrimaryActionButton>
      ) : null}
      {(projects ?? []).map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
      {!(projects ?? []).length ? <EmptyState text='Проектов пока нет' /> : null}
    </div>
  );
}

function PrimaryActionButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      type='button'
      variant='secondary'
      className='h-10 rounded-xl border-transparent! bg-[#2d6ff7]! px-5 text-[13px] font-semibold text-white! shadow-sm shadow-[#2d6ff7]/25 hover:bg-[#245fd8]!'
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function ClientsTable({
  clients,
  searchQuery,
  isLoading,
  currentPage,
  totalPages,
  pageSize,
  canEdit,
  canDelete,
  onSearchQueryChange,
  onOpenCreate,
  onOpenClient,
  onOpenClientContacts,
  onEditClient,
  onDeleteClient,
  onPageChange,
  onPageSizeChange,
}: {
  clients: Client[];
  searchQuery: string;
  isLoading: boolean;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  canEdit: boolean;
  canDelete: boolean;
  onSearchQueryChange: (_value: string) => void;
  onOpenCreate: () => void;
  onOpenClient: (_client: Client) => void;
  onOpenClientContacts: (_client: Client) => void;
  onEditClient: (_client: Client) => void;
  onDeleteClient: (_clientId: string) => void;
  onPageChange: (_page: number) => void;
  onPageSizeChange: (_pageSize: number) => void;
}) {
  return (
    <section className='flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[#e3e9f3] bg-white p-4 text-[#1f3565]'>
      <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
        <h1 className='text-[22px] font-semibold text-[#10275a]'>Клиенты</h1>
        {canEdit ? (
          <Button
            type='button'
            variant='secondary'
            className='h-10 rounded-xl border-[#e3e9f3] px-4'
            onClick={onOpenCreate}
          >
            + Добавить
          </Button>
        ) : null}
      </div>
      <label className='mb-4 flex h-10 items-center gap-2 rounded-xl border border-[#e3e9f3] bg-white px-3 text-[14px] text-[#7e8fb4]'>
        <svg className='size-5 fill-none stroke-current stroke-[1.8]' viewBox='0 0 24 24'>
          <circle cx='11' cy='11' r='7' />
          <path d='m20 20-3.5-3.5' />
        </svg>
        <input
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder='Поиск по наименованию, проекту...'
          className='min-w-0 flex-1 border-0 bg-transparent p-0 text-[14px] text-[#1f3565] outline-none placeholder:text-[#7e8fb4]'
        />
      </label>
      <TableContainer className='min-h-0 flex-1'>
        <Table className='min-w-225'>
          <THead sticky>
            <tr>
              <Th>Наименование</Th>
              <Th align='center'>Контакты</Th>
              <Th>Проекты</Th>
              <Th>Дата добавления</Th>
              <Th align='center' className='w-25 whitespace-nowrap'>
                Действия
              </Th>
            </tr>
          </THead>
          <TBody>
            {isLoading ? (
              <TableLoadingRow />
            ) : clients.length ? (
              clients.map((client) => (
                <Tr key={client.id}>
                  <Td>
                    <button
                      type='button'
                      className='block max-w-80 truncate text-left font-semibold text-[#2d6ff7] hover:underline'
                      title={client.name}
                      onClick={() => onOpenClient(client)}
                    >
                      {client.name}
                    </button>
                  </Td>
                  <Td align='center'>
                    <button
                      type='button'
                      className='inline-flex w-full items-center justify-center rounded-lg px-1 py-1 transition-colors hover:bg-[#edf3ff]'
                      onClick={() => onOpenClientContacts(client)}
                      title='Открыть контакты клиента'
                    >
                      <ContactsCount contacts={client.contacts ?? []} />
                    </button>
                  </Td>
                  <Td>
                    <ClientProjectsLinks projects={client.projects ?? []} />
                  </Td>
                  <Td className='whitespace-nowrap text-[#7e8fb4]'>
                    {formatDateLocal(client.created_at)}
                  </Td>
                  <Td align='center'>
                    {canEdit || canDelete ? (
                      <TableActions>
                        {canEdit ? (
                          <TableActionButton
                            label='Редактировать'
                            onClick={() => onEditClient(client)}
                          >
                            <svg
                              className='fill-none stroke-current stroke-[1.8]'
                              viewBox='0 0 24 24'
                              aria-hidden='true'
                            >
                              <path d='M12 20h9' />
                              <path d='M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z' />
                            </svg>
                          </TableActionButton>
                        ) : null}
                        {canDelete ? (
                          <TableActionButton
                            label='Удалить'
                            tone='danger'
                            onClick={() => onDeleteClient(client.id)}
                          >
                            <svg
                              className='fill-none stroke-current stroke-[1.8]'
                              viewBox='0 0 24 24'
                              aria-hidden='true'
                            >
                              <path d='M3 6h18' />
                              <path d='M8 6V4h8v2' />
                              <path d='M19 6l-1 14H6L5 6' />
                              <path d='M10 11v6M14 11v6' />
                            </svg>
                          </TableActionButton>
                        ) : null}
                      </TableActions>
                    ) : null}
                  </Td>
                </Tr>
              ))
            ) : (
              <TableEmptyRow>Клиенты не найдены</TableEmptyRow>
            )}
          </TBody>
        </Table>
      </TableContainer>
      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </section>
  );
}
