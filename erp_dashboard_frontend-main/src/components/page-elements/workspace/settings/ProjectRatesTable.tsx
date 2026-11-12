import { useCallback, useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';

import { api } from '../../../../api/api';
import type { FinanceArticle, Project } from '../../../../types/app';
import { formatDateLocal } from '../../../../utils/formatters';
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
  useTableSort,
} from '../../../ui/table';
import Icon from '../employees/components/Icon';
import ProjectRateModal, { type ProjectRateForm } from '../../../modals/ProjectRateModal';
import ProjectRateHistoryModal from '../../../modals/ProjectRateHistoryModal';
import ProjectEntranceArticleSelect from '../projects/ProjectEntranceArticleSelect';
import { currencySymbol, DEFAULT_RATE_CURRENCY } from '../../../../utils/currency';

type Props = {
  canManageRates: boolean;
};

type ProjectRateSortKey =
  | 'name'
  | 'client'
  | 'entrance_article'
  | 'rate_effective_from'
  | 'rate'
  | 'vat';

const SORTABLE_COLUMNS: Array<{
  key: ProjectRateSortKey;
  label: string;
  numeric?: boolean;
}> = [
  { key: 'name', label: 'Проект' },
  { key: 'client', label: 'Клиент' },
  { key: 'entrance_article', label: 'Статья поступления' },
  { key: 'rate_effective_from', label: 'Действует с' },
  { key: 'rate', label: 'Ставка', numeric: true },
  { key: 'vat', label: 'НДС', numeric: true },
];

const DEFAULT_PAGE_SIZE = 100;
const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100, 1000];

function emptyText(value?: string | null) {
  const normalized = value?.trim();
  return normalized && normalized !== 'Не указано' ? normalized : '—';
}

function HistoryIcon() {
  return (
    <svg
      viewBox='0 0 24 24'
      className='size-5 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]'
      aria-hidden='true'
    >
      <path d='M3 12a9 9 0 1 0 3-6.7' />
      <path d='M3 4v5h5' />
      <path d='M12 7v5l3 2' />
    </svg>
  );
}

export default function ProjectRatesTable({ canManageRates }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [rows, setRows] = useState<Project[]>([]);
  const [entranceArticles, setEntranceArticles] = useState<FinanceArticle[]>([]);
  const [isLoadingRows, setIsLoadingRows] = useState(false);
  const [tableMeta, setTableMeta] = useState({
    current_page: 1,
    last_page: 1,
    per_page: DEFAULT_PAGE_SIZE,
    total: 0,
  });

  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [historyProject, setHistoryProject] = useState<Project | null>(null);
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [isSavingRate, setIsSavingRate] = useState(false);
  const { sort, toggleSort, directionOf } = useTableSort<ProjectRateSortKey>();

  const loadProjectRows = useCallback(async () => {
    setIsLoadingRows(true);
    try {
      const response = await api.workspace.projects.getMany({
        search: debouncedSearchQuery.trim(),
        page: currentPage,
        per_page: pageSize,
        ...(sort.key ? { sort_by: sort.key, sort_direction: sort.direction } : {}),
      });

      const projects = response.data ?? [];
      setRows(projects);
      setTableMeta({
        current_page: response.meta?.current_page ?? currentPage,
        last_page: response.meta?.last_page ?? 1,
        per_page: response.meta?.per_page ?? pageSize,
        total: response.meta?.total ?? response.data?.length ?? 0,
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось загрузить проекты.',
      );
      setRows([]);
      setTableMeta({
        current_page: currentPage,
        last_page: 1,
        per_page: pageSize,
        total: 0,
      });
    } finally {
      setIsLoadingRows(false);
    }
  }, [currentPage, debouncedSearchQuery, pageSize, sort.key, sort.direction]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setCurrentPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    void loadProjectRows();
  }, [loadProjectRows]);

  useEffect(() => {
    void api.workspace.financeArticles
      .getMany({ type: 'ENTRANCE' })
      .then(setEntranceArticles)
      .catch((error) =>
        toast.error(
          error instanceof Error ? error.message : 'Не удалось загрузить статьи.',
        ),
      );
  }, []);

  const openRateModal = (project: Project) => {
    if (!canManageRates) {
      toast.error('Недостаточно прав для изменения ставки.');
      return;
    }
    setEditingProject(project);
    setIsRateModalOpen(true);
  };

  const handleSaveRate = async (form: ProjectRateForm) => {
    if (!editingProject) return;

    setIsSavingRate(true);
    try {
      await api.workspace.projectRates.createForProject(editingProject.id, {
        rate: form.rate,
        currency: form.currency,
        vat: form.vat,
        effective_from: form.startDate,
      });
      toast.success('Ставка проекта сохранена.');
      await loadProjectRows();
      setIsRateModalOpen(false);
      setEditingProject(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось сохранить ставку.',
      );
    } finally {
      setIsSavingRate(false);
    }
  };

  const handleSearchQueryChange = (value: string) => {
    setSearchQuery(value);
  };

  const handlePageSizeChange = (nextPageSize: number) => {
    setPageSize(nextPageSize);
    setCurrentPage(1);
  };

  const totalPages = Math.max(tableMeta.last_page || 1, 1);
  const safeCurrentPage = Math.min(tableMeta.current_page || currentPage, totalPages);

  const initialFormForModal = useMemo(() => {
    if (!editingProject || !editingProject.current_rate) return {};
    const rate = editingProject.current_rate;
    const rawDate = rate.effective_from ?? '';
    return {
      rate: rate.rate ? String(rate.rate / 100) : '',
      currency: rate.currency ?? DEFAULT_RATE_CURRENCY,
      vat: rate.vat != null ? String(rate.vat) : '',
      startDate: rawDate ? rawDate.split('T')[0] : '',
    };
  }, [editingProject]);

  return (
    <section className='grid gap-4 rounded-xl border border-[#e3e9f3] bg-[#fbfcff] p-3 md:p-4'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div className='grid gap-1'>
          <h2 className='text-[18px] leading-tight font-semibold text-[#10275a] md:text-[20px] md:leading-none'>
            Свод по ставкам
          </h2>
          <p className='text-[13px] leading-6 text-[#7082a8]'>
            Ставка, НДС и статья поступления по умолчанию для каждого проекта.
          </p>
        </div>

        <label className='flex h-11 w-full max-w-[360px] items-center gap-2 rounded-xl border border-[#dce7ff] bg-white px-3 text-[14px] text-[#7e8fb4] md:h-10'>
          <Icon name='search' />
          <input
            value={searchQuery}
            onChange={(event) => handleSearchQueryChange(event.target.value)}
            placeholder='Поиск по проектам'
            className='min-w-0 flex-1 border-0 bg-transparent p-0 text-base text-[#1f3565] outline-none placeholder:text-[#7e8fb4] md:text-[14px]'
          />
        </label>
      </div>

      <TableContainer className='min-h-[220px]'>
        <Table className='min-w-[860px]'>
          <THead sticky>
            <tr>
              {SORTABLE_COLUMNS.map((column) => (
                <Th
                  key={column.key}
                  numeric={column.numeric}
                  sortDirection={directionOf(column.key)}
                  onSort={() => {
                    toggleSort(column.key);
                    setCurrentPage(1);
                  }}
                >
                  {column.label}
                </Th>
              ))}
              <Th align='center' className='w-[88px]'>
                Действия
              </Th>
            </tr>
          </THead>
          <TBody>
            {isLoadingRows ? (
              <TableLoadingRow />
            ) : rows.length ? (
              rows.map((project) => {
                const currentRate = project.current_rate;
                return (
                  <Tr key={project.id}>
                    <Td
                      className='max-w-[180px] truncate font-semibold text-[#10275a]'
                      title={project.name}
                    >
                      {project.name}
                    </Td>
                    <Td
                      className='max-w-[160px] truncate'
                      title={project.client?.name ?? undefined}
                    >
                      {emptyText(project.client?.name)}
                    </Td>
                    <Td className='w-[240px] min-w-[180px] max-w-[260px]'>
                      <ProjectEntranceArticleSelect
                        project={project}
                        articles={entranceArticles}
                        disabled={!canManageRates}
                        onSaved={(articleId) =>
                          setRows((current) =>
                            current.map((row) =>
                              row.id === project.id
                                ? {
                                    ...row,
                                    default_entrance_finance_article_id: articleId,
                                  }
                                : row,
                            ),
                          )
                        }
                      />
                    </Td>
                    <Td className='whitespace-nowrap'>
                      {formatDateLocal(
                        currentRate?.effective_from ?? currentRate?.created_at,
                      )}
                    </Td>
                    <Td numeric>
                      {currentRate?.rate
                        ? `${currentRate.rate / 100} ${currencySymbol(currentRate.currency)}/ч`
                        : '—'}
                    </Td>
                    <Td numeric>
                      {currentRate?.vat != null ? `${currentRate.vat}%` : '—'}
                    </Td>
                    <Td align='center'>
                      <TableActions>
                        <TableActionButton
                          label='Изменить ставку'
                          disabled={!canManageRates}
                          onClick={() => openRateModal(project)}
                        >
                          <Icon name='edit' />
                        </TableActionButton>
                        <TableActionButton
                          label='История изменений ставки'
                          onClick={() => setHistoryProject(project)}
                        >
                          <HistoryIcon />
                        </TableActionButton>
                      </TableActions>
                    </Td>
                  </Tr>
                );
              })
            ) : (
              <TableEmptyRow>Проекты не найдены</TableEmptyRow>
            )}
          </TBody>
        </Table>
      </TableContainer>

      <TablePagination
        currentPage={safeCurrentPage}
        totalPages={totalPages}
        pageSize={tableMeta.per_page || pageSize}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        onPageChange={setCurrentPage}
        onPageSizeChange={handlePageSizeChange}
      />

      <ProjectRateModal
        isOpen={isRateModalOpen}
        isSaving={isSavingRate}
        initialForm={initialFormForModal}
        projectName={editingProject?.name}
        onClose={() => {
          setIsRateModalOpen(false);
          setEditingProject(null);
        }}
        onSave={handleSaveRate}
      />
      {historyProject && (
        <ProjectRateHistoryModal
          isOpen={Boolean(historyProject)}
          projectId={historyProject.id}
          onClose={() => setHistoryProject(null)}
        />
      )}
    </section>
  );
}
