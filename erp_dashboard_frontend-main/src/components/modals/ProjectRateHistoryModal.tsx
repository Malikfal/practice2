import { useEffect, useRef, useState, type MouseEvent } from 'react';

import { api } from '../../api/api';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { formatDateLocal } from '../../utils/formatters';
import type { ProjectRate } from '../../types/app';
import { currencySymbol } from '../../utils/currency';
import {
  Table,
  TableContainer,
  TableEmptyRow,
  TableLoadingRow,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '../ui/table';

function formatRubles(kopecks: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(
    kopecks / 100,
  );
}

function formatRateValue(rate: ProjectRate) {
  return `${formatRubles(rate.rate)} ${currencySymbol(rate.currency)}`;
}

function formatVat(rate: ProjectRate) {
  if (rate.vat == null) return 'Не указано';
  if (rate.vat === 0) return 'Без НДС';
  return `${rate.vat}%`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return formatDateLocal(date);
}

export default function ProjectRateHistoryModal({
  isOpen,
  projectId,
  onClose,
}: {
  isOpen: boolean;
  projectId: string;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  // Новое открытие или другой проект — новое содержимое со свежей загрузкой.
  return (
    <ProjectRateHistoryContent key={projectId} projectId={projectId} onClose={onClose} />
  );
}

function ProjectRateHistoryContent({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const shouldCloseOnBackdropClickRef = useRef(false);
  const [rates, setRates] = useState<ProjectRate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    api.workspace.projectRates
      .getForProject(projectId)
      .then((response) => {
        if (cancelled) return;
        setRates(response);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Не удалось загрузить историю ставок');
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEscapeToClose(onClose);

  const sortedRates = [...rates].sort((left, right) => {
    const leftDate = left.effective_from ?? left.created_at ?? '';
    const rightDate = right.effective_from ?? right.created_at ?? '';
    return rightDate.localeCompare(leftDate);
  });

  return (
    <div
      className='fixed inset-0 z-1000 grid place-items-center bg-slate-900/40 p-2 text-[#1f3565] sm:p-4'
      onMouseDown={(event) => {
        shouldCloseOnBackdropClickRef.current = event.target === event.currentTarget;
      }}
      onMouseUp={(event) => {
        const shouldClose =
          shouldCloseOnBackdropClickRef.current && event.target === event.currentTarget;
        shouldCloseOnBackdropClickRef.current = false;

        if (shouldClose) {
          onClose();
        }
      }}
    >
      <div
        className='max-h-[calc(100dvh-1rem)] w-full max-w-[1210px] overflow-x-hidden overflow-y-auto rounded-xl border border-[#e3e9f3] bg-white p-3 shadow-2xl shadow-slate-900/20 sm:max-h-[90vh] sm:rounded-2xl sm:p-4 md:overflow-auto'
        onClick={(event: MouseEvent<HTMLDivElement>) => event.stopPropagation()}
      >
        <div className='mb-4 flex items-center justify-between gap-3'>
          <h2 className='text-[18px] leading-tight font-semibold text-[#10275a] sm:text-[22px]'>
            История изменений ставки
          </h2>
          <button
            type='button'
            className='grid size-8 shrink-0 place-items-center rounded-xl border border-[#e3e9f3] bg-white text-[18px] leading-none text-[#1f3565] transition-colors hover:bg-[#f3f7ff] hover:text-[#2d6ff7]'
            onClick={onClose}
            aria-label='Закрыть историю изменений ставки'
            title='Закрыть'
          >
            x
          </button>
        </div>

        {error ? (
          <div className='mb-3 rounded-xl border border-[#fbd5d5] bg-[#fef4f4] px-4 py-3 text-sm text-[#b94545]'>
            {error}
          </div>
        ) : null}

        <TableContainer>
          <Table density='compact' className='min-w-[760px]'>
            <THead>
              <tr>
                <Th>Дата начала действия</Th>
                <Th numeric>Ставка</Th>
                <Th numeric>НДС</Th>
                <Th>Дата изменения</Th>
              </tr>
            </THead>
            <TBody>
              {isLoading ? (
                <TableLoadingRow />
              ) : sortedRates.length ? (
                sortedRates.map((rate) => (
                  <Tr key={rate.id}>
                    <Td className='font-semibold'>{formatDate(rate.effective_from)}</Td>
                    <Td numeric>{formatRateValue(rate)}</Td>
                    <Td numeric>{formatVat(rate)}</Td>
                    <Td>{formatDate(rate.created_at)}</Td>
                  </Tr>
                ))
              ) : (
                <TableEmptyRow>История ставок пока пустая.</TableEmptyRow>
              )}
            </TBody>
          </Table>
        </TableContainer>
      </div>
    </div>
  );
}
