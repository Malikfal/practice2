import {
  type ChangeEvent,
  type DragEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';

import { api } from '../../../../api/api';
import { API_URL } from '../../../../constants/app';
import type { Project, ProjectDocument } from '../../../../types/app';
import Button from '../../../ui/Button';
import SortIcon from '../../../ui/SortIcon';
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

type Props = {
  project: Pick<Project, 'id'>;
  canUploadDocuments: boolean;
  canDeleteDocuments: boolean;
  // У проекта есть клиент: документы можно показывать ему или скрывать.
  showClientVisibility?: boolean;
  // Клиентский кабинет берёт документы из своего API.
  fetchDocuments?: (_projectId: string) => Promise<ProjectDocument[]>;
  // Клиенту показывается только наименование, документ скачивается по клику на него.
  namesOnly?: boolean;
};

type SortKey = 'original_name' | 'created_at' | 'author';

function hasDraggedFiles(event: DragEvent<HTMLElement>): boolean {
  return Array.from(event.dataTransfer.types).includes('Files');
}

function getDroppedFiles(event: DragEvent<HTMLElement>): File[] {
  const files = Array.from(event.dataTransfer.items ?? [])
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));

  return files.length > 0 ? files : Array.from(event.dataTransfer.files ?? []);
}

function formatDocumentDate(value?: string) {
  if (!value) return 'Не указано';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Не указано';

  return new Intl.DateTimeFormat('ru-RU').format(date);
}

function formatAuthor(document: ProjectDocument) {
  const name = document.author?.name?.trim() ?? '';
  const lastName = document.author?.last_name?.trim() ?? '';
  const fullName = `${name} ${lastName}`.trim();

  return fullName || document.author?.email || 'Не указано';
}

function fileNameFromResponse(response: Response, fallback: string) {
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
  const rawName = utfMatch?.[1] ?? plainMatch?.[1];

  if (!rawName) return fallback;

  try {
    return decodeURIComponent(rawName);
  } catch {
    return rawName;
  }
}

export default function ProjectDocumentsTab({
  project,
  canUploadDocuments,
  canDeleteDocuments,
  showClientVisibility = false,
  fetchDocuments = api.workspace.projectDocuments.getForProject,
  namesOnly = false,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDropActive, setIsDropActive] = useState(false);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  // Видимость для клиента у новых документов; по умолчанию клиент видит все документы.
  const [uploadClientVisible, setUploadClientVisible] = useState(true);
  const canToggleClientVisibility = showClientVisibility && canUploadDocuments;
  const { sort, toggleSort, directionOf } = useTableSort<SortKey>({
    initial: { key: 'created_at', direction: 'desc' },
  });

  useEffect(() => {
    let ignore = false;

    const loadDocuments = async () => {
      setIsLoading(true);

      try {
        const data = await fetchDocuments(project.id);
        if (!ignore) setDocuments(data);
      } catch (error) {
        if (!ignore) {
          toast.error(
            error instanceof Error ? error.message : 'Не удалось загрузить документы.',
          );
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
    };

    void loadDocuments();

    return () => {
      ignore = true;
    };
  }, [project.id, fetchDocuments]);

  const sortedDocuments = useMemo(() => {
    const { key, direction } = sort;
    if (!key) return documents;

    return [...documents].sort((left, right) => {
      const leftValue = key === 'author' ? formatAuthor(left) : String(left[key] ?? '');
      const rightValue =
        key === 'author' ? formatAuthor(right) : String(right[key] ?? '');
      const compare = leftValue.localeCompare(rightValue, 'ru');

      return direction === 'asc' ? compare : -compare;
    });
  }, [documents, sort]);

  const openFileDialog = () => {
    if (!canUploadDocuments) return;
    fileInputRef.current?.click();
  };

  const uploadSelectedDocuments = async (files: File[]) => {
    if (!canUploadDocuments) return;
    if (!files.length) return;

    setIsUploading(true);

    try {
      const createdDocuments = await Promise.all(
        files.map((file) =>
          api.workspace.projectDocuments.uploadForProject(
            project.id,
            file,
            !showClientVisibility || uploadClientVisible,
          ),
        ),
      );
      setDocuments((current) => [...createdDocuments, ...current]);
      toast.success(
        createdDocuments.length === 1
          ? 'Документ загружен.'
          : `Документы загружены: ${createdDocuments.length}.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось загрузить документы.',
      );
    } finally {
      setIsUploading(false);
    }
  };

  const uploadDocument = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    void uploadSelectedDocuments(files);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!canUploadDocuments || isUploading || !hasDraggedFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsDropActive(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setIsDropActive(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!canUploadDocuments || isUploading || !hasDraggedFiles(event)) return;
    event.preventDefault();
    setIsDropActive(false);
    void uploadSelectedDocuments(getDroppedFiles(event));
  };

  const downloadDocument = async (document: ProjectDocument) => {
    if (!document.download_url) {
      toast.error('Ссылка на скачивание недоступна.');
      return;
    }

    setActiveDocumentId(document.id);

    try {
      const response = await fetch(`${API_URL}${document.download_url}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Не удалось скачать документ.');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = fileNameFromResponse(response, document.original_name);
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Не удалось скачать документ.');
    } finally {
      setActiveDocumentId(null);
    }
  };

  const toggleClientVisibility = async (document: ProjectDocument, visible: boolean) => {
    if (!canToggleClientVisibility) return;

    setActiveDocumentId(document.id);

    try {
      const updated = await api.workspace.projectDocuments.updateClientVisibility(
        document.id,
        visible,
      );
      setDocuments((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      toast.success(visible ? 'Документ виден клиенту.' : 'Документ скрыт от клиента.');
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Не удалось изменить видимость документа.',
      );
    } finally {
      setActiveDocumentId(null);
    }
  };

  const deleteDocument = async (document: ProjectDocument) => {
    if (!canDeleteDocuments) return;

    const confirmed = window.confirm(`Удалить документ "${document.original_name}"?`);
    if (!confirmed) return;

    setActiveDocumentId(document.id);

    try {
      await api.workspace.projectDocuments.delete(document.id);
      setDocuments((current) => current.filter((item) => item.id !== document.id));
      toast.success('Документ удалён.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось удалить документ.',
      );
    } finally {
      setActiveDocumentId(null);
    }
  };

  return (
    <section className='grid min-w-0 gap-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h3 className='text-xl leading-none font-semibold text-[#10275a] sm:text-[22px]'>
            Документы
          </h3>
        </div>

        {canUploadDocuments ? (
          <div className='flex w-full flex-wrap items-center gap-3 sm:w-auto'>
            {showClientVisibility ? (
              <label
                className='flex items-center gap-2 text-[13px] font-medium text-[#1f3565]'
                title='Отметка для документов, которые вы загрузите'
              >
                <input
                  type='checkbox'
                  className='size-4 shrink-0 accent-[#2d6ff7]'
                  checked={uploadClientVisible}
                  onChange={(event) => setUploadClientVisible(event.target.checked)}
                />
                Новые документы видны клиенту
              </label>
            ) : null}
            <input
              ref={fileInputRef}
              type='file'
              className='hidden'
              multiple
              onChange={uploadDocument}
            />
            <Button
              type='button'
              variant='secondary'
              disabled={isUploading}
              className='h-10 w-full rounded-xl border-transparent! bg-[#2d6ff7]! px-4 text-[13px] font-semibold text-white! shadow-sm shadow-[#2d6ff7]/25 hover:bg-[#245fd8]! disabled:bg-[#edf1f7]! disabled:text-[#9aa8c7]! sm:w-auto'
              onClick={openFileDialog}
            >
              {isUploading ? 'Загрузка...' : 'Загрузить документ'}
            </Button>
          </div>
        ) : null}
      </div>

      <div
        className={`min-w-0 rounded-xl border bg-[#fbfcff] p-2 transition-colors sm:p-3 ${
          isDropActive
            ? 'border-[#2d6ff7] shadow-[0_0_0_3px_rgba(45,111,247,0.12)]'
            : 'border-[#e3e9f3]'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className='mb-3 flex flex-wrap items-center justify-between gap-2'>
          <p className='text-[15px] font-semibold text-[#1f3565]'>
            Список документов ({documents.length})
          </p>
          {canUploadDocuments ? (
            <p className='hidden text-xs font-medium text-[#7e8fb4] sm:block'>
              {isDropActive
                ? 'Отпустите файлы, чтобы загрузить документы'
                : 'Можно перетащить файлы в эту область'}
            </p>
          ) : null}
        </div>

        <div className='mb-2 flex flex-wrap gap-1.5 md:hidden'>
          {(
            [
              ['original_name', 'Название'],
              ['created_at', 'Дата'],
              ['author', 'Автор'],
            ] as const
          )
            .filter(([key]) => !namesOnly || key === 'original_name')
            .map(([key, label]) => (
              <button
                key={key}
                type='button'
                className={`inline-flex min-h-9 items-center gap-1 rounded-lg border px-3 text-xs font-semibold ${
                  sort.key === key
                    ? 'border-[#a9c2fa] bg-[#edf3ff] text-[#2d6ff7]'
                    : 'border-[#e3e9f3] bg-white text-[#66728d]'
                }`}
                onClick={() => toggleSort(key)}
              >
                {label}
                {sort.key === key ? <SortIcon direction={sort.direction} /> : null}
              </button>
            ))}
        </div>

        <div className='grid gap-2 md:hidden'>
          {isLoading ? (
            <div className='grid min-h-28 place-items-center rounded-xl border border-[#e3e9f3] bg-white'>
              <div className='h-6 w-6 animate-spin rounded-full border-2 border-[#c9d8f8] border-t-[#2d6ff7]' />
            </div>
          ) : sortedDocuments.length ? (
            sortedDocuments.map((document) => (
              <article
                key={document.id}
                className='grid min-w-0 gap-3 rounded-xl border border-[#e3e9f3] bg-white p-3'
              >
                {namesOnly ? (
                  <DocumentNameButton
                    document={document}
                    disabled={activeDocumentId === document.id}
                    onClick={() => void downloadDocument(document)}
                  />
                ) : (
                  <>
                    <p className='break-words text-sm font-semibold text-[#1f3565]'>
                      {document.original_name}
                    </p>
                    <dl className='grid grid-cols-2 gap-2 text-xs'>
                      <div>
                        <dt className='text-[#7e8fb4]'>Дата загрузки</dt>
                        <dd className='mt-0.5 font-medium text-[#1f3565]'>
                          {formatDocumentDate(document.created_at)}
                        </dd>
                      </div>
                      <div className='min-w-0'>
                        <dt className='text-[#7e8fb4]'>Автор</dt>
                        <dd className='mt-0.5 truncate font-medium text-[#1f3565]'>
                          {formatAuthor(document)}
                        </dd>
                      </div>
                    </dl>
                    {showClientVisibility ? (
                      <ClientVisibilityCheckbox
                        document={document}
                        disabled={
                          !canToggleClientVisibility || activeDocumentId === document.id
                        }
                        withLabel
                        onChange={(visible) =>
                          void toggleClientVisibility(document, visible)
                        }
                      />
                    ) : null}
                    <div
                      className={`grid gap-2 ${canDeleteDocuments ? 'grid-cols-2' : 'grid-cols-1'}`}
                    >
                      <button
                        type='button'
                        className='min-h-10 rounded-lg border border-[#c9d8f8] bg-white px-3 text-xs font-semibold text-[#2d6ff7] disabled:opacity-55'
                        disabled={activeDocumentId === document.id}
                        onClick={() => void downloadDocument(document)}
                      >
                        Скачать
                      </button>
                      {canDeleteDocuments ? (
                        <button
                          type='button'
                          className='min-h-10 rounded-lg border border-[#ffd7dd] bg-white px-3 text-xs font-semibold text-[#c83f52] disabled:opacity-55'
                          disabled={activeDocumentId === document.id}
                          onClick={() => void deleteDocument(document)}
                        >
                          Удалить
                        </button>
                      ) : null}
                    </div>
                  </>
                )}
              </article>
            ))
          ) : (
            <div className='rounded-xl border border-[#e3e9f3] bg-white px-3 py-8 text-center text-sm text-[#7e8fb4]'>
              Документы не загружены.
            </div>
          )}
        </div>

        <TableContainer className='hidden md:block'>
          <Table density='compact' className={namesOnly ? undefined : 'min-w-180'}>
            <THead>
              <tr>
                <Th
                  sortDirection={directionOf('original_name')}
                  onSort={() => toggleSort('original_name')}
                >
                  Наименование документа
                </Th>
                {!namesOnly ? (
                  <>
                    <Th
                      sortDirection={directionOf('created_at')}
                      onSort={() => toggleSort('created_at')}
                    >
                      Дата загрузки
                    </Th>
                    <Th
                      sortDirection={directionOf('author')}
                      onSort={() => toggleSort('author')}
                    >
                      Автор
                    </Th>
                    {showClientVisibility ? (
                      <Th align='center' className='w-32'>
                        Виден клиенту
                      </Th>
                    ) : null}
                    <Th align='center'>Действия</Th>
                  </>
                ) : null}
              </tr>
            </THead>
            <TBody>
              {isLoading ? (
                <TableLoadingRow />
              ) : sortedDocuments.length ? (
                sortedDocuments.map((document) => (
                  <Tr key={document.id}>
                    <Td className='font-semibold'>
                      {namesOnly ? (
                        <DocumentNameButton
                          document={document}
                          disabled={activeDocumentId === document.id}
                          onClick={() => void downloadDocument(document)}
                        />
                      ) : (
                        <span className='block truncate'>{document.original_name}</span>
                      )}
                    </Td>
                    {!namesOnly ? (
                      <>
                        <Td>{formatDocumentDate(document.created_at)}</Td>
                        <Td>{formatAuthor(document)}</Td>
                        {showClientVisibility ? (
                          <Td align='center'>
                            <ClientVisibilityCheckbox
                              document={document}
                              disabled={
                                !canToggleClientVisibility ||
                                activeDocumentId === document.id
                              }
                              onChange={(visible) =>
                                void toggleClientVisibility(document, visible)
                              }
                            />
                          </Td>
                        ) : null}
                        <Td align='center'>
                          <TableActions>
                            <TableActionButton
                              label='Скачать документ'
                              disabled={activeDocumentId === document.id}
                              onClick={() => void downloadDocument(document)}
                            >
                              <Icon name='download' />
                            </TableActionButton>
                            {canDeleteDocuments ? (
                              <TableActionButton
                                label='Удалить документ'
                                tone='danger'
                                disabled={activeDocumentId === document.id}
                                onClick={() => void deleteDocument(document)}
                              >
                                <Icon name='trash' />
                              </TableActionButton>
                            ) : null}
                          </TableActions>
                        </Td>
                      </>
                    ) : null}
                  </Tr>
                ))
              ) : (
                <TableEmptyRow>Документы не загружены.</TableEmptyRow>
              )}
            </TBody>
          </Table>
        </TableContainer>
      </div>
    </section>
  );
}

function DocumentNameButton({
  document,
  disabled,
  onClick,
}: {
  document: ProjectDocument;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type='button'
      title='Скачать документ'
      disabled={disabled}
      onClick={onClick}
      className='block max-w-full break-words text-left text-sm font-semibold text-[#2d6ff7] hover:underline disabled:opacity-55'
    >
      {document.original_name}
    </button>
  );
}

function ClientVisibilityCheckbox({
  document,
  disabled,
  withLabel = false,
  onChange,
}: {
  document: ProjectDocument;
  disabled: boolean;
  withLabel?: boolean;
  onChange: (_visible: boolean) => void;
}) {
  const isVisible = document.is_client_visible ?? true;

  return (
    <label
      className={`inline-flex items-center gap-2 text-xs font-medium text-[#1f3565] ${
        disabled ? 'cursor-not-allowed' : 'cursor-pointer'
      }`}
      title={isVisible ? 'Клиент видит документ' : 'Документ скрыт от клиента'}
    >
      <input
        type='checkbox'
        className='size-4 shrink-0 accent-[#2d6ff7] disabled:cursor-not-allowed'
        checked={isVisible}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        aria-label={`Виден клиенту: ${document.original_name}`}
      />
      {withLabel ? 'Виден клиенту' : null}
    </label>
  );
}
