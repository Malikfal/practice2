import { useMemo } from 'react';

import type { HoursChartGroupBy } from '../../../../../types/app';
import {
  sortRows,
  Table,
  TableContainer,
  TBody,
  Td,
  TFoot,
  Th,
  THead,
  Tr,
  useTableSort,
} from '../../../../ui/table';
import { formatReportTime } from '../ReportsTable';
import { incompleteNote, periodLabel, type HoursChartPoint } from './hoursChartUtils';

const PERIOD_TITLES: Record<HoursChartGroupBy, string> = {
  day: 'День',
  week: 'Неделя',
  month: 'Месяц',
};

type Props = {
  points: HoursChartPoint[];
  groupBy: HoursChartGroupBy;
  totalSeconds: number;
};

/** Те же данные, что на графике, без периодов, которые ещё не начались. */
export default function HoursChartTable({ points, groupBy, totalSeconds }: Props) {
  // Возр. → убыв. → по времени, как на графике.
  const { sort, toggleSort, directionOf } = useTableSort<'seconds'>({ resettable: true });
  const rows = useMemo(
    () =>
      sortRows(
        points.filter((point) => !point.isFuture),
        sort,
        (row, key) => row[key],
      ),
    [points, sort],
  );

  return (
    <TableContainer>
      <Table>
        <THead>
          <tr>
            <Th>{PERIOD_TITLES[groupBy]}</Th>
            <Th
              numeric
              sortDirection={directionOf('seconds')}
              onSort={() => toggleSort('seconds')}
            >
              Часы
            </Th>
          </tr>
        </THead>
        <TBody>
          {rows.map((row) => {
            const note = incompleteNote(row, groupBy);
            return (
              <Tr key={row.key}>
                <Td>
                  {periodLabel(row, groupBy)}
                  {note ? (
                    <span className='ml-2 text-xs text-[#b45309]'>{note}</span>
                  ) : null}
                </Td>
                <Td numeric className={row.seconds === 0 ? 'text-[#a5b1c9]' : undefined}>
                  {formatReportTime(row.seconds)}
                </Td>
              </Tr>
            );
          })}
        </TBody>
        <TFoot>
          <tr>
            <Td>Итого</Td>
            <Td numeric>{formatReportTime(totalSeconds)}</Td>
          </tr>
        </TFoot>
      </Table>
    </TableContainer>
  );
}
