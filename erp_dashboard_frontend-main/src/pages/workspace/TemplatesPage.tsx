import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { api } from '../../api/api';
import TemplateModal from '../../components/modals/TemplateModal';
import TemplatesListPanel from '../../components/page-elements/workspace/projects/TemplatesListPanel';
import TemplatesTablePanel from '../../components/page-elements/workspace/projects/TemplatesTablePanel';
import { useServerPagination } from '../../components/ui/Pagination';
import {
  createDefaultTemplateStatusColumns,
  createInitialTemplateForm,
} from '../../hooks/formFactories';
import type { Template, User } from '../../types/app';

export default function TemplatesPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [employees, setEmployees] = useState<User[]>([]);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState('');
  const [templateForm, setTemplateForm] = useState(createInitialTemplateForm);

  const {
    currentPage,
    pageSize,
    totalPages,
    setCurrentPage,
    resetPage,
    onPageSizeChange,
    applyMeta,
  } = useServerPagination();

  const handleError = useCallback((err: unknown) => {
    toast.error(err instanceof Error ? err.message : 'Произошла ошибка.');
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const response = await api.workspace.employees.getMany({
        status: 'active',
        per_page: 1000,
      });
      setEmployees(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      handleError(err);
    }
  }, [handleError]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchTemplates = useCallback(async () => {
    try {
      setIsLoading(true);
      const [response, pinnedIds] = await Promise.all([
        api.workspace.templates.getMany({
          search: debouncedSearchQuery,
          page: currentPage,
          per_page: pageSize,
        }),
        api.workspace.templates.getPinned(),
      ]);

      const templateList = Array.isArray(response.data) ? response.data : [];
      const pinnedSet = new Set(pinnedIds as string[]);

      setTemplates((prev) => {
        const pinnedAtMap = new Map(prev.map((t) => [t.id, t.pinned_at]));
        return templateList.map((t) => {
          const isPinned = pinnedSet.has(t.id);
          return {
            ...t,
            is_pinned: isPinned,
            pinned_at: isPinned ? pinnedAtMap.get(t.id) || Date.now() : undefined,
          };
        });
      });
      applyMeta(response.meta);

      setSelectedTemplateId((prev) => {
        if (!templateList.length) return '';
        if (prev && templateList.some((t) => t.id === prev)) {
          return prev;
        }
        return '';
      });
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoading(false);
    }
  }, [applyMeta, currentPage, debouncedSearchQuery, handleError, pageSize]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleOpenCreateModal = () => {
    setTemplateForm(createInitialTemplateForm());
    setEditingTemplateId('');
    setIsTemplateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setIsTemplateModalOpen(false);
    setEditingTemplateId('');
    setTemplateForm(createInitialTemplateForm());
  };

  const handleSubmitCreateTemplate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!templateForm.name.trim()) {
      toast.error('Укажите название шаблона.');
      return;
    }
    if (!templateForm.status_columns.length) {
      toast.error('Добавьте хотя бы один статус в шаблон.');
      return;
    }
    try {
      setIsSavingTemplate(true);
      const payload = {
        name: templateForm.name.trim(),
        manager_id: templateForm.manager_id || null,
        member_ids: templateForm.member_ids,
        is_default_template: templateForm.is_default_template,
        status_columns: templateForm.status_columns.map((column) => ({
          name: column.name.trim(),
          color: column.color?.trim() || null,
          is_final: Boolean(column.is_final),
        })),
      };

      if (editingTemplateId) {
        await api.workspace.templates.update(editingTemplateId, payload);
        toast.success('Шаблон обновлён.');
      } else {
        await api.workspace.templates.create(payload);
        toast.success('Шаблон создан.');
      }

      setIsTemplateModalOpen(false);
      setEditingTemplateId('');
      setTemplateForm(createInitialTemplateForm());
      fetchTemplates();
    } catch (err) {
      handleError(err);
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleEditTemplate = (template: Template) => {
    setEditingTemplateId(template.id);
    setTemplateForm({
      name: template.name,
      manager_id: template.manager?.id ?? '',
      member_ids: (template.members ?? []).map((member) => member.user.id),
      is_default_template: Boolean(template.is_default_template),
      status_columns: template.status_columns?.length
        ? template.status_columns.map((column) => ({
            name: column.name ?? column.label,
            color: column.color ?? '#7e8fb4',
            is_final: Boolean(column.is_final),
          }))
        : createDefaultTemplateStatusColumns(),
    });
    setIsTemplateModalOpen(true);
  };

  const handleDeleteTemplate = async (template: Template) => {
    if (!window.confirm(`Вы уверены, что хотите удалить шаблон "${template.name}"?`))
      return;
    try {
      await api.workspace.templates.delete(template.id);
      toast.success('Шаблон удален.');
      fetchTemplates();
    } catch (err) {
      handleError(err);
    }
  };

  const handleCreateProjectFromTemplate = (template: Template) => {
    navigate(`/projects?template_id=${template.id}`);
  };

  const handleTogglePinTemplate = async (template: Template) => {
    const now = Date.now();
    const prevPinnedAt = template.pinned_at;
    const isPinned = template.is_pinned;

    setTemplates((prev) =>
      prev.map((t) =>
        t.id === template.id
          ? { ...t, is_pinned: !isPinned, pinned_at: !isPinned ? now : undefined }
          : t,
      ),
    );

    try {
      if (isPinned) {
        await api.workspace.templates.unpin(template.id);
        toast.success('Шаблон откреплен.');
      } else {
        await api.workspace.templates.pin(template.id);
        toast.success('Шаблон закреплен.');
      }
      fetchTemplates();
    } catch (err) {
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === template.id
            ? { ...t, is_pinned: isPinned, pinned_at: prevPinnedAt }
            : t,
        ),
      );
      handleError(err);
    }
  };

  const handleExportTemplates = () => {
    toast.info('Экспорт шаблонов...');
  };

  const handleExitTemplates = () => {
    navigate('/projects');
  };

  return (
    <>
      <div className='grid h-full min-h-0 gap-2 lg:grid-cols-[210px_minmax(0,1fr)]'>
        <TemplatesListPanel
          templates={templates}
          isLoading={isLoading}
          searchQuery={searchQuery}
          selectedTemplateId={selectedTemplateId}
          onSearchQueryChange={(value: string) => {
            setSearchQuery(value);
            resetPage();
          }}
          onSelectTemplate={setSelectedTemplateId}
          onOpenCreateModal={handleOpenCreateModal}
          onExitTemplates={handleExitTemplates}
          onTogglePinTemplate={handleTogglePinTemplate}
        />

        <TemplatesTablePanel
          templates={templates}
          searchQuery={searchQuery}
          isLoading={isLoading}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          onSearchQueryChange={(value: string) => {
            setSearchQuery(value);
            resetPage();
          }}
          onPageChange={setCurrentPage}
          onPageSizeChange={onPageSizeChange}
          onOpenCreateModal={handleOpenCreateModal}
          onEditTemplate={handleEditTemplate}
          onCreateProjectFromTemplate={handleCreateProjectFromTemplate}
          onDeleteTemplate={handleDeleteTemplate}
          onExportTemplates={handleExportTemplates}
          onTogglePinTemplate={handleTogglePinTemplate}
        />
      </div>

      <TemplateModal
        isOpen={isTemplateModalOpen}
        isSaving={isSavingTemplate}
        isEditing={editingTemplateId !== ''}
        form={templateForm}
        employees={employees}
        onChange={setTemplateForm}
        onClose={handleCloseCreateModal}
        onSubmit={handleSubmitCreateTemplate}
      />
    </>
  );
}
