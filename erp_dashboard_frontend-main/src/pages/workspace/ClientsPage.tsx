import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';

import { api } from '../../api/api';
import {
  BankDetailModal,
  ClientModal,
  type ClientTab,
  ContactModal,
  type FieldErrors,
  LegalEntityModal,
  emptyClientForm,
  requiredErrors,
} from '../../components/page-elements/workspace/clients/ClientPageComponents';
import {
  ClientDetails,
  ClientsTable,
} from '../../components/page-elements/workspace/clients/ClientPanels';
import ConfirmDialog from '../../components/modals/ConfirmDialog';
import { canViewFinances as canViewFinancesForRole } from '../../constants/app';
import { useServerPagination } from '../../components/ui/Pagination';
import { useAppControllerContext } from '../../context/AppControllerContext';
import { parseHoursInput } from '../../utils/formatters';
import type {
  Client,
  ClientContact,
  ClientForm,
  ClientLegalEntity,
  ClientLegalEntityBankDetail,
} from '../../types/app';

// Как на бэкенде: не больше 1000 часов в неделю.
const MAX_WEEKLY_LIMIT_HOURS = 1000;

type DeleteTarget = {
  type: 'client' | 'contact' | 'legal' | 'bank';
  id: string;
  parentId?: string;
};

type ClientModalState = {
  mode: 'create' | 'edit';
  form: ClientForm;
};

type BankModalState = {
  entity: ClientLegalEntity;
  detail: ClientLegalEntityBankDetail | null;
};

const bankDetailRequiredLabels = {
  checking_account: 'расчетный счет',
  bank: 'банк',
  bik: 'БИК',
  correspondent_account: 'корреспондентский счет',
};

function pluralizeProjects(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return 'проект';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'проекта';

  return 'проектов';
}

function pluralizeRemain(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return 'останется';

  return 'останутся';
}

function ProjectsHoverCard({ projects }: { projects: string[] }) {
  if (!projects.length) return null;

  return (
    <span className='group relative inline-flex align-middle'>
      <button
        type='button'
        className='inline-flex items-center gap-1 rounded-full border border-[#d7e3fb] bg-[#f3f7ff] px-2 py-0.5 text-[13px] font-semibold text-[#245fd8] transition-colors hover:border-[#b9cdf8] hover:bg-[#eaf1ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2d6ff7]/30'
      >
        <span>
          {projects.length} {pluralizeProjects(projects.length)}
        </span>
        <svg
          className='size-3 fill-none stroke-current stroke-[1.8] text-[#7e8fb4] transition-colors group-hover:text-[#245fd8]'
          viewBox='0 0 24 24'
          aria-hidden='true'
        >
          <path d='M12 16v.01' strokeLinecap='round' />
          <path
            d='M9.09 9a3 3 0 1 1 5.82 1c0 2-3 2-3 4'
            strokeLinecap='round'
            strokeLinejoin='round'
          />
          <circle cx='12' cy='12' r='9' />
        </svg>
      </button>

      <span className='pointer-events-none absolute left-1/2 top-full z-20 mt-3 w-80 max-w-[calc(100vw-4rem)] -translate-x-1/2 rounded-2xl border border-white/70 bg-white/95 p-3 text-left opacity-0 shadow-[0_20px_60px_rgba(16,39,90,0.16)] ring-1 ring-[#dfe8fb] backdrop-blur-sm transition duration-200 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100'>
        <span className='absolute left-1/2 top-0 size-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-l border-t border-[#dfe8fb] bg-white/95' />
        <span className='mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7e8fb4]'>
          Проекты без клиента
        </span>
        <span className='block max-h-48 space-y-1 overflow-y-auto pr-1'>
          {projects.map((project) => (
            <span
              key={project}
              className='flex items-center gap-2 rounded-xl px-2 py-1.5 text-[13px] text-[#1f3565]'
            >
              <span className='size-1.5 shrink-0 rounded-full bg-[#2d6ff7]' />
              <span className='min-w-0 break-words'>{project}</span>
            </span>
          ))}
        </span>
      </span>
    </span>
  );
}

export default function ClientsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAppControllerContext();
  const permissions = user?.permissions ?? [];
  const canView =
    permissions.includes('clients.view') ||
    permissions.includes('clients.create_update') ||
    permissions.includes('clients.delete');
  const canEdit = permissions.includes('clients.create_update');
  const canDelete = permissions.includes('clients.delete');
  const canViewFinances = canViewFinancesForRole(user?.role, permissions);
  const canManageFinances = permissions.includes('finance.manage');
  const canManageFlowAccess = permissions.includes('clients.flow_access.manage');

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedTab, setSelectedTab] = useState<ClientTab>('general');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [bankErrors, setBankErrors] = useState<FieldErrors>({});
  const [clientModal, setClientModal] = useState<ClientModalState | null>(null);
  const [contactModal, setContactModal] = useState<ClientContact | null | 'create'>(null);
  const [legalModal, setLegalModal] = useState<ClientLegalEntity | null | 'create'>(null);
  const [legalModalRevision, setLegalModalRevision] = useState(0);
  const [bankModal, setBankModal] = useState<BankModalState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const {
    currentPage,
    pageSize,
    totalPages,
    setCurrentPage,
    resetPage,
    onPageSizeChange,
    applyMeta,
  } = useServerPagination(10);

  const requestedClientId = useMemo(
    () => new URLSearchParams(location.search).get('client_id') ?? '',
    [location.search],
  );
  const selectedClientId = selectedClient?.id ?? '';
  const deleteClient =
    deleteTarget?.type === 'client'
      ? (clients.find((client) => client.id === deleteTarget.id) ??
        (selectedClient?.id === deleteTarget.id ? selectedClient : null))
      : null;
  const deleteClientProjects = deleteClient?.projects ?? [];
  const deleteClientProjectNames = deleteClientProjects
    .map((project) => project.name.trim())
    .filter(Boolean);

  const handleError = useCallback((err: unknown) => {
    toast.error(err instanceof Error ? err.message : 'Произошла ошибка.');
  }, []);

  const updateUrl = useCallback(
    (clientId: string) => {
      const params = new URLSearchParams(location.search);
      if (clientId) {
        params.set('client_id', clientId);
      } else {
        params.delete('client_id');
      }
      const next = `${location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
      const current = `${location.pathname}${location.search}`;
      if (next !== current) navigate(next, { replace: true });
    },
    [location.pathname, location.search, navigate],
  );

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchClientDetails = useCallback(
    async (clientId: string) => {
      if (!clientId) return;
      try {
        const client = await api.workspace.clients.getDetails(clientId);
        setSelectedClient(client);
        setClients((prev) => prev.map((item) => (item.id === client.id ? client : item)));
        return client;
      } catch (err) {
        handleError(err);
        return null;
      }
    },
    [handleError],
  );

  const fetchClients = useCallback(async () => {
    if (!canView) return;
    try {
      setIsLoading(true);
      const response = await api.workspace.clients.getMany({
        search: debouncedSearchQuery,
        page: currentPage,
        per_page: pageSize,
      });
      let list = Array.isArray(response.data) ? response.data : [];
      if (requestedClientId && !list.some((client) => client.id === requestedClientId)) {
        try {
          const direct = await api.workspace.clients.getDetails(requestedClientId);
          list = [direct, ...list];
        } catch {
          // Недоступный client_id не мешает открыть список.
        }
      }
      setClients(list);
      applyMeta(response.meta);
      if (requestedClientId) {
        const direct = list.find((client) => client.id === requestedClientId);
        if (direct) setSelectedClient(direct);
      }
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoading(false);
    }
  }, [
    applyMeta,
    canView,
    currentPage,
    debouncedSearchQuery,
    handleError,
    pageSize,
    requestedClientId,
  ]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const openClientDetails = (client: Client, tab: ClientTab = 'general') => {
    setSelectedClient(client);
    setSelectedTab(tab);
    updateUrl(client.id);
    fetchClientDetails(client.id);
  };

  const openClientContacts = (client: Client) => {
    openClientDetails(client, 'contacts');
  };

  const closeClientDetails = () => {
    setSelectedClient(null);
    updateUrl('');
  };

  const persistClient = async (mode: ClientModalState['mode'], form: ClientForm) => {
    if (!form.name.trim()) {
      setErrors({ name: 'Заполните наименование.' });
      return;
    }
    // Поля лимита нет в форме — лимит не отправляется и не меняется.
    const weeklyLimitSeconds =
      form.weekly_limit_hours === undefined
        ? undefined
        : parseHoursInput(form.weekly_limit_hours, MAX_WEEKLY_LIMIT_HOURS);
    if (form.weekly_limit_hours !== undefined && weeklyLimitSeconds === undefined) {
      setErrors({
        weekly_limit_hours: `Укажите число часов от 0 до ${MAX_WEEKLY_LIMIT_HOURS}, например 7,5, или оставьте пустым.`,
      });
      return;
    }
    const payload = { ...form, weekly_limit_seconds: weeklyLimitSeconds };
    try {
      setIsSaving(true);
      setErrors({});
      if (mode === 'create') {
        const client = await api.workspace.clients.create(payload);
        toast.success('Клиент добавлен.');
        setClientModal(null);
        updateUrl(client.id);
        await fetchClients();
        await fetchClientDetails(client.id);
      } else if (selectedClient) {
        const client = await api.workspace.clients.update(selectedClient.id, payload);
        toast.success('Клиент обновлён.');
        setSelectedClient(client);
        fetchClients();
      }
    } catch (err) {
      handleError(err);
    } finally {
      setIsSaving(false);
    }
  };

  const saveClient = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!clientModal) return;
    await persistClient(clientModal.mode, clientModal.form);
  };

  const saveContact = async (form: ClientContact) => {
    if (!selectedClientId) return;
    if (!form.first_name.trim()) {
      setErrors({ first_name: 'Заполните имя.' });
      return;
    }
    try {
      setIsSaving(true);
      setErrors({});
      if (form.id) {
        await api.workspace.clientContacts.update(selectedClientId, form.id, form);
        toast.success('Контакт обновлён.');
      } else {
        await api.workspace.clientContacts.create(selectedClientId, form);
        toast.success('Контакт добавлен.');
      }
      setContactModal(null);
      fetchClientDetails(selectedClientId);
    } catch (err) {
      handleError(err);
    } finally {
      setIsSaving(false);
    }
  };

  const saveLegalEntity = async (
    form: ClientLegalEntity,
    newDetails: ClientLegalEntityBankDetail[],
  ) => {
    if (!selectedClientId) return;
    const formErrors = requiredErrors(
      {
        name: form.name,
        legal_address: form.legal_address,
        postal_code: form.postal_code,
        inn: form.inn,
      },
      {
        name: 'наименование',
        legal_address: 'юридический адрес',
        postal_code: 'почтовый индекс',
        inn: 'ИНН',
      },
    );
    const invalidBankDetails = newDetails.some(
      (detail) =>
        Object.keys(
          requiredErrors(
            {
              checking_account: detail.checking_account,
              bank: detail.bank,
              bik: detail.bik,
              correspondent_account: detail.correspondent_account,
            },
            bankDetailRequiredLabels,
          ),
        ).length > 0,
    );

    if (Object.keys(formErrors).length || invalidBankDetails) {
      setErrors(formErrors);
      setBankErrors(
        invalidBankDetails
          ? {
              checking_account: 'Заполните расчетный счет.',
              bank: 'Заполните банк.',
              bik: 'Заполните БИК.',
              correspondent_account: 'Заполните корреспондентский счет.',
            }
          : {},
      );
      return;
    }

    try {
      setIsSaving(true);
      setErrors({});
      setBankErrors({});
      const saved = form.id
        ? await api.workspace.clientLegalEntities.update(selectedClientId, form.id, form)
        : await api.workspace.clientLegalEntities.create(selectedClientId, form);
      for (const detail of newDetails) {
        await api.workspace.clientBankDetails.create(selectedClientId, saved.id!, detail);
      }
      toast.success(form.id ? 'Юр. лицо обновлено.' : 'Юр. лицо добавлено.');
      setLegalModal(null);
      fetchClientDetails(selectedClientId);
    } catch (err) {
      handleError(err);
    } finally {
      setIsSaving(false);
    }
  };

  const saveBankDetail = async (form: ClientLegalEntityBankDetail) => {
    if (!selectedClientId || !bankModal?.entity.id) return;
    const formErrors = requiredErrors(
      {
        checking_account: form.checking_account,
        bank: form.bank,
        bik: form.bik,
        correspondent_account: form.correspondent_account,
      },
      bankDetailRequiredLabels,
    );
    if (Object.keys(formErrors).length) {
      setErrors(formErrors);
      return;
    }

    try {
      setIsSaving(true);
      setBankErrors({});
      const entityId = bankModal.entity.id;
      if (form.id) {
        await api.workspace.clientBankDetails.update(
          selectedClientId,
          entityId,
          form.id,
          form,
        );
        toast.success('Реквизиты обновлены.');
      } else {
        await api.workspace.clientBankDetails.create(selectedClientId, entityId, form);
        toast.success('Реквизиты добавлены.');
      }
      setBankModal(null);
      const refreshedClient = await fetchClientDetails(selectedClientId);
      if (refreshedClient && legalModal !== 'create' && legalModal?.id === entityId) {
        const refreshedEntity = refreshedClient.legal_entities?.find(
          (item) => item.id === entityId,
        );
        if (refreshedEntity) {
          setLegalModal(refreshedEntity);
          setLegalModalRevision((value) => value + 1);
        }
      }
    } catch (err) {
      handleError(err);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteSelected = async () => {
    if (!deleteTarget) return;
    try {
      setIsSaving(true);
      if (deleteTarget.type === 'client') {
        await api.workspace.clients.delete(deleteTarget.id);
        toast.success('Клиент удален.');
        setSelectedClient(null);
        updateUrl('');
        fetchClients();
      }
      if (deleteTarget.type === 'contact' && selectedClientId) {
        await api.workspace.clientContacts.delete(selectedClientId, deleteTarget.id);
        toast.success('Контакт удален.');
        fetchClientDetails(selectedClientId);
      }
      if (deleteTarget.type === 'legal' && selectedClientId) {
        await api.workspace.clientLegalEntities.delete(selectedClientId, deleteTarget.id);
        toast.success('Юр. лицо удалено.');
        fetchClientDetails(selectedClientId);
      }
      if (deleteTarget.type === 'bank' && deleteTarget.parentId && selectedClientId) {
        await api.workspace.clientBankDetails.delete(
          selectedClientId,
          deleteTarget.parentId,
          deleteTarget.id,
        );
        toast.success('Реквизиты удалены.');
        const refreshedClient = await fetchClientDetails(selectedClientId);
        if (
          refreshedClient &&
          legalModal !== 'create' &&
          legalModal?.id === deleteTarget.parentId
        ) {
          const refreshedEntity = refreshedClient.legal_entities?.find(
            (item) => item.id === deleteTarget.parentId,
          );
          if (refreshedEntity) {
            setLegalModal(refreshedEntity);
            setLegalModalRevision((value) => value + 1);
          }
        }
      }
      setDeleteTarget(null);
    } catch (err) {
      handleError(err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!canView) {
    return (
      <div className='rounded-xl border border-[#e3e9f3] bg-white p-4 text-sm text-[#7e8fb4]'>
        У вас нет доступа к клиентам.
      </div>
    );
  }

  return (
    <>
      {selectedClient ? (
        <ClientDetails
          client={selectedClient}
          selectedTab={selectedTab}
          canEdit={canEdit}
          canDelete={canDelete}
          canViewFinances={canViewFinances}
          canManageFinances={canManageFinances}
          canManageFlowAccess={canManageFlowAccess}
          onSelectTab={setSelectedTab}
          onClose={closeClientDetails}
          isSaving={isSaving}
          errors={errors}
          onSaveClient={(form) => persistClient('edit', form)}
          onClearErrors={() => setErrors({})}
          onCreateContact={() => {
            setErrors({});
            setContactModal('create');
          }}
          onEditContact={(contact) => {
            setErrors({});
            setContactModal(contact);
          }}
          onDeleteContact={(contactId) =>
            setDeleteTarget({ type: 'contact', id: contactId })
          }
          onCreateLegalEntity={() => {
            setErrors({});
            setLegalModal('create');
          }}
          onEditLegalEntity={(entity) => {
            setErrors({});
            setLegalModal(entity);
          }}
          onDeleteLegalEntity={(entityId) =>
            setDeleteTarget({ type: 'legal', id: entityId })
          }
          onCreateProject={() => navigate(`/projects?client_id=${selectedClient.id}`)}
        />
      ) : (
        <ClientsTable
          clients={clients}
          searchQuery={searchQuery}
          isLoading={isLoading}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          canEdit={canEdit}
          canDelete={canDelete}
          onSearchQueryChange={(value) => {
            setSearchQuery(value);
            resetPage();
          }}
          onOpenCreate={() => {
            setErrors({});
            setClientModal({
              mode: 'create',
              form: { ...emptyClientForm, weekly_limit_hours: '' },
            });
          }}
          onOpenClient={openClientDetails}
          onOpenClientContacts={openClientContacts}
          onEditClient={(client) => openClientDetails(client, 'general')}
          onDeleteClient={(clientId) => setDeleteTarget({ type: 'client', id: clientId })}
          onPageChange={setCurrentPage}
          onPageSizeChange={onPageSizeChange}
        />
      )}

      {clientModal ? (
        <ClientModal
          title='Новый клиент'
          submitLabel='Добавить клиента'
          isSaving={isSaving}
          form={clientModal.form}
          errors={errors}
          onChange={(form) => setClientModal({ ...clientModal, form })}
          onClose={() => setClientModal(null)}
          onSubmit={saveClient}
        />
      ) : null}
      {contactModal ? (
        <ContactModal
          contact={contactModal === 'create' ? null : contactModal}
          isSaving={isSaving}
          errors={errors}
          onClose={() => setContactModal(null)}
          onSave={saveContact}
        />
      ) : null}
      {legalModal ? (
        <LegalEntityModal
          key={
            legalModal === 'create'
              ? `legal-create-${legalModalRevision}`
              : `${legalModal.id ?? 'legal'}-${legalModalRevision}`
          }
          entity={legalModal === 'create' ? null : legalModal}
          isSaving={isSaving}
          errors={errors}
          bankErrors={bankErrors}
          onClose={() => {
            setLegalModal(null);
            setBankModal(null);
          }}
          onSave={saveLegalEntity}
          onEditBankDetail={(entity, detail) => setBankModal({ entity, detail })}
          onDeleteBankDetail={(entityId, detailId) =>
            setDeleteTarget({ type: 'bank', id: detailId, parentId: entityId })
          }
        />
      ) : null}
      {bankModal ? (
        <BankDetailModal
          detail={bankModal.detail}
          isSaving={isSaving}
          errors={bankErrors}
          onClose={() => setBankModal(null)}
          onSave={saveBankDetail}
        />
      ) : null}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        isProcessing={isSaving}
        title='Удалить?'
        message={
          deleteTarget?.type === 'client' ? (
            <div className='space-y-2'>
              <p>
                Клиент{deleteClient?.name ? ` "${deleteClient.name}"` : ''} будет удален
                безвозвратно.
              </p>
              {deleteClientProjects.length ? (
                <p>
                  При этом <ProjectsHoverCard projects={deleteClientProjectNames} />{' '}
                  {pluralizeRemain(deleteClientProjects.length)} без клиента.
                </p>
              ) : null}
            </div>
          ) : (
            'Запись будет удалена безвозвратно.'
          )
        }
        confirmLabel='Удалить'
        onClose={() => setDeleteTarget(null)}
        onConfirm={deleteSelected}
      />
    </>
  );
}
