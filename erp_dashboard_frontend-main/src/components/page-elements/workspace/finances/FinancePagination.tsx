import TablePagination from '../../../ui/TablePagination';

type Props = {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (_page: number) => void;
  onPageSizeChange: (_pageSize: number) => void;
};

export default function FinancePagination({
  currentPage,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: Props) {
  return (
    <TablePagination
      currentPage={currentPage}
      totalPages={totalPages}
      pageSize={pageSize}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
    />
  );
}
