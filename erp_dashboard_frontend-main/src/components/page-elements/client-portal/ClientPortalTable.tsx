import type { ReactNode } from 'react';

import { Table, TableContainer, TableEmptyRow, TBody, Th, THead } from '../../ui/table';

export const clientTableLinkClasses =
  'text-left font-semibold text-[#2d6ff7] hover:underline';

/** Колонка: подпись или подпись с признаком числовых данных (заголовок справа). */
export type ClientPortalColumn = string | { label: string; numeric?: boolean };

/** Таблица кабинета клиента; строки тела — `Tr` и `Td` из `ui/table`. */
export default function ClientPortalTable({
  columns,
  isEmpty,
  emptyText,
  children,
}: {
  columns: ClientPortalColumn[];
  isEmpty: boolean;
  emptyText: string;
  children: ReactNode;
}) {
  return (
    <TableContainer className='min-h-0 flex-1'>
      <Table>
        <THead sticky>
          <tr>
            {columns.map((column) => {
              const { label, numeric = false } =
                typeof column === 'string' ? { label: column } : column;

              return (
                <Th key={label} numeric={numeric} className='whitespace-nowrap'>
                  {label}
                </Th>
              );
            })}
          </tr>
        </THead>
        <TBody>{isEmpty ? <TableEmptyRow>{emptyText}</TableEmptyRow> : children}</TBody>
      </Table>
    </TableContainer>
  );
}
