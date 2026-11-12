import {
  type ChangeEvent,
  type DragEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';

import { api } from '../../../../../../../api/api';
import { API_URL } from '../../../../../../../constants/app';
import type { EmployeeDocument, User } from '../../../../../../../types/app';
import Button from '../../../../../../ui/Button';
import SortIcon from '../../../../../../ui/SortIcon';
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
} from '../../../../../../ui/table';
import Icon from '../../../components/Icon';

type Props = {
  employee: User;
  canUploadDocument?: boolean;
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

function getFirstDroppedFile(event: DragEvent<HTMLElement>): File | null {
  return getDroppedFiles(event)[0] ?? null;
}

function formatDocumentDate(value?: string) {
  if (!value) return 'Не указано';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Не указано';

  return new Intl.DateTimeFormat('ru-RU').format(date);
}

function formatAuthor(document: EmployeeDocument) {
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

export default function DocumentsTab({ employee, canUploadDocument = true }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDropActive, setIsDropActive] = useState(false);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const { sort, toggleSort, directionOf } = useTableSort<SortKey>({
    initial: { key: 'created_at', direction: 'desc' },
  });

  useEffect(() => {
    let ignore = false;

    const loadDocuments = async () => {
      setIsLoading(true);

      try {
        const data = await api.workspace.employeeDocuments.getForEmployee(employee.id);
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
  }, [employee.id]);

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
    if (!canUploadDocument) return;
    fileInputRef.current?.click();
  };

  const uploadSelectedDocument = async (file: File | null) => {
    if (!file) return;

    setIsUploading(true);

    try {
      const created = await api.workspace.employeeDocuments.uploadForEmployee(
        employee.id,
        file,
      );
      setDocuments((current) => [created, ...current]);
      toast.success('Документ загружен.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось загрузить документ.',
      );
    } finally {
      setIsUploading(false);
    }
  };

  const uploadDocument = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';
    void uploadSelectedDocument(file);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!canUploadDocument || isUploading || !hasDraggedFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsDropActive(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setIsDropActive(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!canUploadDocument || isUploading || !hasDraggedFiles(event)) return;
    event.preventDefault();
    setIsDropActive(false);
    void uploadSelectedDocument(getFirstDroppedFile(event));
  };

  const downloadDocument = async (document: EmployeeDocument) => {
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

  const deleteDocument = async (document: EmployeeDocument) => {
    const confirmed = window.confirm(`Удалить документ "${document.original_name}"?`);
    if (!confirmed) return;

    setActiveDocumentId(document.id);

    try {
      await api.workspace.employeeDocuments.delete(document.id);
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

        {canUploadDocument ? (
          <>
            <input
              ref={fileInputRef}
              type='file'
              className='hidden'
              accept='.pdf,.doc,.docx,.png,.jpg,.jpeg'
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
          </>
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
          {canUploadDocument ? (
            <p className='hidden text-xs font-medium text-[#7e8fb4] sm:block'>
              {isDropActive
                ? 'Отпустите файл, чтобы загрузить документ'
                : 'Можно перетащить файл в эту область'}
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
          ).map(([key, label]) => (
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
                <div className='min-w-0'>
                  <p className='break-words text-sm font-semibold text-[#1f3565]'>
                    {document.original_name}
                  </p>
                  <dl className='mt-2 grid grid-cols-2 gap-2 text-xs'>
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
                </div>
                <div className='grid grid-cols-2 gap-2'>
                  <button
                    type='button'
                    className='min-h-10 rounded-lg border border-[#c9d8f8] bg-white px-3 text-xs font-semibold text-[#2d6ff7] disabled:opacity-55'
                    disabled={activeDocumentId === document.id}
                    onClick={() => void downloadDocument(document)}
                  >
                    Скачать
                  </button>
                  <button
                    type='button'
                    className='min-h-10 rounded-lg border border-[#ffd7dd] bg-white px-3 text-xs font-semibold text-[#c83f52] disabled:opacity-55'
                    disabled={activeDocumentId === document.id}
                    onClick={() => void deleteDocument(document)}
                  >
                    Удалить
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className='rounded-xl border border-[#e3e9f3] bg-white px-3 py-8 text-center text-sm text-[#7e8fb4]'>
              Документы не загружены.
            </div>
          )}
        </div>

        <TableContainer className='hidden md:block'>
          <Table density='compact' className='min-w-180'>
            <THead>
              <tr>
                <Th
                  sortDirection={directionOf('original_name')}
                  onSort={() => toggleSort('original_name')}
                >
                  Наименование документа
                </Th>
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
                <Th align='center'>Действия</Th>
              </tr>
            </THead>
            <TBody>
              {isLoading ? (
                <TableLoadingRow />
              ) : sortedDocuments.length ? (
                sortedDocuments.map((document) => (
                  <Tr key={document.id}>
                    <Td className='font-semibold'>
                      <span className='block truncate'>{document.original_name}</span>
                    </Td>
                    <Td>{formatDocumentDate(document.created_at)}</Td>
                    <Td>{formatAuthor(document)}</Td>
                    <Td align='center'>
                      <TableActions>
                        <TableActionButton
                          label='Скачать документ'
                          disabled={activeDocumentId === document.id}
                          onClick={() => void downloadDocument(document)}
                        >
                          <Icon name='download' />
                        </TableActionButton>
                        <TableActionButton
                          label='Удалить документ'
                          tone='danger'
                          disabled={activeDocumentId === document.id}
                          onClick={() => void deleteDocument(document)}
                        >
                          <Icon name='trash' />
                        </TableActionButton>
                      </TableActions>
                    </Td>
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
