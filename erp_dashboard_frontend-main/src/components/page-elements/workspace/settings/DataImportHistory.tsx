import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';

import { api } from '../../../../api/api';
import {
  ACTIVE_DATA_IMPORT_STATUSES,
  DATA_IMPORT_LOG_LEVEL_LABELS,
  DATA_IMPORT_ROW_STATUS_CLASSES,
  DATA_IMPORT_ROW_STATUS_LABELS,
  DATA_IMPORT_STATUS_CLASSES,
  DATA_IMPORT_STATUS_LABELS,
  DATA_IMPORT_TYPE_LABELS,
  formatFileSize,
  formatImportDuration,
} from '../../../../constants/dataImports';
import TablePagination from '../../../ui/TablePagination';
import {
  Table,
  TableContainer,
  TableEmptyRow,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '../../../ui/table';
import type { DataImport, DataImportRow } from '../../../../types/dataImport';

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleString('ru-RU') : '—';
const speedFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });

/** Ошибки и предупреждения строки списком текста: сервер отдаёт их по полям или массивом. */
function rowMessages(value: DataImportRow['errors'] | DataImportRow['warnings']) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  return Object.values(value).flatMap((messages) =>
    Array.isArray(messages) ? messages.map(String) : [String(messages)],
  );
}

/**
 * Вкладка «Статистика»: история импортов и подробности выбранного.
 * Выбранный импорт хранится в адресе (?import=<id>), чтобы на него можно было перейти
 * из прогресса нового импорта.
 */
export default function DataImportHistory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('import');
  const [imports, setImports] = useState<DataImport[]>([]);
  const [selected, setSelected] = useState<DataImport | null>(null);
  const [rows, setRows] = useState<DataImportRow[]>([]);
  const [rowFilter, setRowFilter] = useState<'ALL' | 'CREATED' | 'FAILED'>('ALL');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [rowPage, setRowPage] = useState(1);
  const [rowLastPage, setRowLastPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const loadImports = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.imports.getMany(page, 20);
      setImports(response.data ?? []);
      setLastPage(response.meta.last_page || 1);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось загрузить историю импортов.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  const loadRows = useCallback(async () => {
    if (!selectedId) return;
    try {
      const response = await api.imports.getRows(selectedId, rowPage, 50);
      setRows(response.data ?? []);
      setRowLastPage(response.meta.last_page || 1);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось загрузить строки импорта.',
      );
    }
  }, [rowPage, selectedId]);

  useEffect(() => {
    void loadImports();
  }, [loadImports]);
  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  // Подробности (с журналом событий) грузятся по id из адреса.
  useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      setRows([]);
      return;
    }
    let isCancelled = false;
    api.imports
      .get(selectedId)
      .then((item) => {
        if (!isCancelled) setSelected(item);
      })
      .catch((error: unknown) => {
        if (isCancelled) return;
        toast.error(
          error instanceof Error ? error.message : 'Не удалось загрузить импорт.',
        );
      });
    return () => {
      isCancelled = true;
    };
  }, [selectedId]);

  const selectedStatus = selected?.status;
  useEffect(() => {
    if (
      !selectedId ||
      !selectedStatus ||
      !ACTIVE_DATA_IMPORT_STATUSES.has(selectedStatus)
    ) {
      return;
    }
    const timer = window.setInterval(async () => {
      try {
        const next = await api.imports.get(selectedId);
        setSelected(next);
        setImports((items) => items.map((item) => (item.id === next.id ? next : item)));
        if (!ACTIVE_DATA_IMPORT_STATUSES.has(next.status)) void loadRows();
      } catch {
        window.clearInterval(timer);
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [selectedId, selectedStatus, loadRows]);

  const select = (item: DataImport | null) => {
    setRowPage(1);
    setRowFilter('ALL');
    setSelected(item);
    setSearchParams(
      (params) => {
        const next = new URLSearchParams(params);
        if (item) next.set('import', item.id);
        else next.delete('import');
        return next;
      },
      { replace: true },
    );
  };

  const runAction = async (action: 'retry' | 'cancel') => {
    if (!selected) return;
    try {
      const next = await api.imports[action](selected.id);
      setSelected(next);
      setImports((items) => items.map((item) => (item.id === next.id ? next : item)));
      toast.success(action === 'retry' ? 'Повторный импорт запущен.' : 'Импорт отменён.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Действие не выполнено.');
    }
  };

  const download = async () => {
    if (!selected) return;
    try {
      const blob = await api.imports.download(selected.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = selected.original_name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось скачать файл.');
    }
  };

  const visibleRows = rows.filter(
    (row) => rowFilter === 'ALL' || row.status === rowFilter,
  );

  return (
    <div>
      <div className='grid gap-3 lg:hidden'>
        {imports.map((item) => (
          <article
            key={item.id}
            className='grid gap-3 rounded-xl border border-[#e3e9f3] bg-[#fbfcff] p-3'
          >
            <div className='flex items-start justify-between gap-3'>
              <div className='min-w-0'>
                <div className='font-semibold text-[#10275a]'>
                  {DATA_IMPORT_TYPE_LABELS[item.type]}
                </div>
                <div className='mt-1 text-xs text-[#7e8fb4]'>
                  {formatDate(item.created_at)}
                </div>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${DATA_IMPORT_STATUS_CLASSES[item.status]}`}
              >
                {DATA_IMPORT_STATUS_LABELS[item.status]}
              </span>
            </div>

            <div className='min-w-0 truncate text-sm' title={item.original_name}>
              {item.original_name}
            </div>

            <div>
              <div className='mb-1 flex justify-between gap-3 text-xs text-[#63759c]'>
                <span>Прогресс</span>
                <span>
                  {item.total_rows === 0 && ACTIVE_DATA_IMPORT_STATUSES.has(item.status)
                    ? '…'
                    : `${item.progress}% (${item.processed_rows}/${item.total_rows})`}
                </span>
              </div>
              <div className='h-2 overflow-hidden rounded-full bg-[#dce7ff]'>
                <div
                  className={`h-full bg-[#2d6ff7] ${item.total_rows === 0 && ACTIVE_DATA_IMPORT_STATUSES.has(item.status) ? 'w-1/3 animate-pulse' : ''}`}
                  style={{
                    width:
                      item.total_rows === 0 &&
                      ACTIVE_DATA_IMPORT_STATUSES.has(item.status)
                        ? undefined
                        : `${Math.max(0, Math.min(100, item.progress))}%`,
                  }}
                />
              </div>
            </div>

            <div className='grid grid-cols-2 gap-2 text-xs'>
              <span className='rounded-lg bg-emerald-50 px-2 py-1.5 text-emerald-700'>
                Успешно: {item.successful_rows}
              </span>
              <span className='rounded-lg bg-red-50 px-2 py-1.5 text-red-700'>
                Ошибки: {item.failed_rows}
              </span>
            </div>

            <button
              type='button'
              className='min-h-11 rounded-lg border border-[#c9d8f8] bg-white px-3 text-sm font-semibold text-[#2d6ff7]'
              onClick={() => select(item)}
            >
              Подробнее
            </button>
          </article>
        ))}
        {!isLoading && imports.length === 0 ? (
          <div className='rounded-xl border border-dashed border-[#c9d8f8] p-6 text-center text-sm text-[#7e8fb4]'>
            Импортов пока нет.
          </div>
        ) : null}
      </div>

      <TableContainer className='hidden lg:block'>
        <Table className='min-w-250'>
          <THead>
            <tr>
              <Th>Дата</Th>
              <Th>Тип</Th>
              <Th>Файл</Th>
              <Th>Статус</Th>
              <Th numeric>Прогресс</Th>
              <Th numeric>Успешно</Th>
              <Th numeric>Ошибки</Th>
              <Th>Запуск / завершение</Th>
              <Th align='center' />
            </tr>
          </THead>
          <TBody>
            {imports.map((item) => (
              <Tr
                key={item.id}
                aria-current={item.id === selectedId ? 'true' : undefined}
                background={item.id === selectedId ? 'bg-[#edf3ff]' : undefined}
              >
                <Td>{formatDate(item.created_at)}</Td>
                <Td>{DATA_IMPORT_TYPE_LABELS[item.type]}</Td>
                <Td className='max-w-55 truncate' title={item.original_name}>
                  {item.original_name}
                </Td>
                <Td>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${DATA_IMPORT_STATUS_CLASSES[item.status]}`}
                  >
                    {DATA_IMPORT_STATUS_LABELS[item.status]}
                  </span>
                </Td>
                <Td numeric>
                  {item.total_rows === 0 && ACTIVE_DATA_IMPORT_STATUSES.has(item.status)
                    ? '…'
                    : `${item.progress}% (${item.processed_rows}/${item.total_rows})`}
                </Td>
                <Td numeric className='text-emerald-700'>
                  {item.successful_rows}
                </Td>
                <Td numeric className='text-red-700'>
                  {item.failed_rows}
                </Td>
                <Td className='text-xs'>
                  {formatDate(item.started_at)}
                  <br />
                  {formatDate(item.finished_at)}
                </Td>
                <Td align='center'>
                  <button
                    type='button'
                    className='font-semibold text-[#2d6ff7]'
                    onClick={() => select(item)}
                  >
                    Подробнее
                  </button>
                </Td>
              </Tr>
            ))}
            {!isLoading && imports.length === 0 ? (
              <TableEmptyRow>Импортов пока нет.</TableEmptyRow>
            ) : null}
          </TBody>
        </Table>
      </TableContainer>
      <TablePagination
        currentPage={page}
        totalPages={lastPage}
        pageSize={20}
        showPageSizeSelector={false}
        onPageChange={setPage}
        onPageSizeChange={() => undefined}
      />

      {selected ? (
        <div className='relative mt-6 rounded-xl border border-[#dce5f2] p-3 pr-11 md:p-4 md:pr-12'>
          <button
            type='button'
            aria-label='Закрыть отчёт'
            title='Закрыть отчёт'
            className='absolute top-3 right-3 grid size-8 place-items-center rounded-lg text-2xl leading-none text-[#7e8fb4] transition-colors hover:bg-[#edf3ff] hover:text-[#2d6ff7]'
            onClick={() => select(null)}
          >
            ×
          </button>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <div>
              <h2 className='text-lg font-semibold text-[#10275a]'>
                {selected.original_name}
              </h2>
              <div className='mt-1 text-sm text-[#63759c]'>
                {DATA_IMPORT_TYPE_LABELS[selected.type]} ·{' '}
                {formatFileSize(selected.file_size)} ·{' '}
                {DATA_IMPORT_STATUS_LABELS[selected.status]}
              </div>
            </div>
            <div className='grid w-full gap-2 sm:flex sm:w-auto'>
              <button
                type='button'
                className='min-h-11 rounded-lg border px-3 py-2 text-sm font-semibold sm:min-h-0'
                onClick={download}
              >
                Скачать файл
              </button>
              {['FAILED', 'COMPLETED_WITH_ERRORS'].includes(selected.status) ? (
                <button
                  type='button'
                  className='min-h-11 rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white sm:min-h-0'
                  onClick={() => void runAction('retry')}
                >
                  Повторить ошибки
                </button>
              ) : null}
              {ACTIVE_DATA_IMPORT_STATUSES.has(selected.status) ? (
                <button
                  type='button'
                  className='min-h-11 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white sm:min-h-0'
                  onClick={() => void runAction('cancel')}
                >
                  Отменить
                </button>
              ) : null}
            </div>
          </div>
          <div className='mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4'>
            <div>Запуск: {formatDate(selected.started_at)}</div>
            <div>Завершение: {formatDate(selected.finished_at)}</div>
            <div>
              Длительность: {formatImportDuration(selected.metrics?.duration_seconds)}
            </div>
            <div>
              Скорость:{' '}
              {selected.metrics?.rows_per_second != null
                ? `${speedFormat.format(selected.metrics.rows_per_second)} строк/с`
                : '—'}
            </div>
            <div>
              Обработано: {selected.processed_rows}/{selected.total_rows}
            </div>
            <div className='text-emerald-700'>Успешно: {selected.successful_rows}</div>
            <div className='text-red-700'>Ошибки: {selected.failed_rows}</div>
            <div>Пропущено: {selected.skipped_rows}</div>
          </div>
          <div className='mt-4'>
            <div className='mb-1 flex justify-between text-xs text-[#63759c]'>
              <span>Прогресс обработки</span>
              <span>{selected.progress}%</span>
            </div>
            <div className='h-2 overflow-hidden rounded-full bg-[#dce7ff]'>
              <div
                className={`h-full bg-[#2d6ff7] ${selected.total_rows === 0 && ACTIVE_DATA_IMPORT_STATUSES.has(selected.status) ? 'w-1/3 animate-pulse' : ''}`}
                style={{
                  width:
                    selected.total_rows === 0 &&
                    ACTIVE_DATA_IMPORT_STATUSES.has(selected.status)
                      ? undefined
                      : `${Math.max(0, Math.min(100, selected.progress))}%`,
                }}
              />
            </div>
          </div>
          {selected.error_message ? (
            <div className='mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700'>
              {selected.error_message}
            </div>
          ) : null}
          {selected.logs?.length ? (
            <div className='mt-4'>
              <h3 className='font-semibold'>Последние события</h3>
              <div className='mt-2 max-h-40 overflow-auto rounded-lg bg-slate-50 p-3 text-xs'>
                {selected.logs.map((log, index) => {
                  const levelLabel = DATA_IMPORT_LOG_LEVEL_LABELS[log.level];
                  return (
                    <div
                      key={`${log.created_at}-${index}`}
                      className={`mb-1 ${log.level === 'ERROR' ? 'text-red-700' : log.level === 'WARNING' ? 'text-amber-700' : ''}`}
                    >
                      <span className='text-[#7e8fb4]'>{formatDate(log.created_at)}</span>{' '}
                      {levelLabel ? `${levelLabel}: ` : ''}
                      {log.message}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
          <div className='mt-5 flex gap-2 overflow-x-auto pb-1'>
            {(
              [
                ['ALL', 'Все'],
                ['CREATED', 'Успешные'],
                ['FAILED', 'Ошибки'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type='button'
                className={`min-h-11 shrink-0 rounded-lg px-3 py-2 text-sm font-semibold sm:min-h-0 ${rowFilter === value ? 'bg-[#2d6ff7] text-white' : 'bg-[#edf2fb]'}`}
                onClick={() => setRowFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <TableContainer className='mt-3'>
            <Table density='compact' className='min-w-160'>
              <THead>
                <tr>
                  <Th numeric className='w-20'>
                    Строка
                  </Th>
                  <Th className='w-32'>Статус</Th>
                  <Th>Ошибки и предупреждения</Th>
                  <Th className='w-64'>Данные строки</Th>
                </tr>
              </THead>
              <TBody>
                {visibleRows.map((row) => {
                  const errors = rowMessages(row.errors);
                  const warnings = rowMessages(row.warnings);
                  return (
                    <Tr key={row.id} className='[&>td]:align-top'>
                      <Td numeric>{row.row_number}</Td>
                      <Td>
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold whitespace-nowrap ${DATA_IMPORT_ROW_STATUS_CLASSES[row.status] ?? ''}`}
                        >
                          {DATA_IMPORT_ROW_STATUS_LABELS[row.status] ?? row.status}
                        </span>
                      </Td>
                      <Td>
                        {errors.length || warnings.length ? (
                          <ul className='grid gap-1'>
                            {errors.map((message, index) => (
                              <li key={`e-${index}`} className='text-red-700'>
                                {message}
                              </li>
                            ))}
                            {warnings.map((message, index) => (
                              <li key={`w-${index}`} className='text-amber-700'>
                                {message}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className='text-[#7e8fb4]'>—</span>
                        )}
                      </Td>
                      <Td>
                        <details>
                          <summary className='cursor-pointer text-xs font-semibold text-[#2d6ff7]'>
                            Подробнее для поддержки
                          </summary>
                          <div className='mt-2 grid gap-2 text-xs'>
                            <div>
                              <div className='font-semibold text-[#63759c]'>
                                Данные из файла
                              </div>
                              <pre className='mt-1 max-h-60 max-w-100 overflow-auto rounded-lg bg-slate-50 p-2 whitespace-pre-wrap'>
                                {JSON.stringify(row.raw_data, null, 2)}
                              </pre>
                            </div>
                            <div>
                              <div className='font-semibold text-[#63759c]'>
                                Данные после проверки
                              </div>
                              <pre className='mt-1 max-h-60 max-w-100 overflow-auto rounded-lg bg-slate-50 p-2 whitespace-pre-wrap'>
                                {JSON.stringify(row.normalized_data, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </details>
                      </Td>
                    </Tr>
                  );
                })}
                {!ACTIVE_DATA_IMPORT_STATUSES.has(selected.status) &&
                visibleRows.length === 0 ? (
                  <TableEmptyRow>
                    {rowFilter === 'ALL'
                      ? 'Строк нет.'
                      : 'Нет строк с таким результатом.'}
                  </TableEmptyRow>
                ) : null}
              </TBody>
            </Table>
          </TableContainer>
          <TablePagination
            currentPage={rowPage}
            totalPages={rowLastPage}
            pageSize={50}
            showPageSizeSelector={false}
            onPageChange={setRowPage}
            onPageSizeChange={() => undefined}
          />
        </div>
      ) : null}
    </div>
  );
}
