export type CellValue = string | number | boolean | null | undefined;

type DownloadXlsxOptions = {
  headers: string[];
  rows: CellValue[][];
  fileName: string;
  sheetName?: string;
};

function normalizeSheetName(value: string): string {
  const sanitized = value.replaceAll(/[\\/?*:[\]]/g, ' ').trim();
  return (sanitized || 'Sheet1').slice(0, 31);
}

function normalizeFileName(fileName: string): string {
  return fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
}

function calculateColumnWidths(headers: string[], rows: CellValue[][]) {
  return headers.map((header, columnIndex) => {
    const maxCellLength = rows.reduce((maxWidth, row) => {
      const cellValue = row[columnIndex];
      const cellLength = cellValue == null ? 0 : String(cellValue).length;
      return Math.max(maxWidth, cellLength);
    }, header.length);

    return { wch: Math.min(Math.max(maxCellLength + 2, 10), 50) };
  });
}

// Библиотека тяжёлая (сотни КБ), поэтому грузится только при экспорте.
export async function downloadXlsx({
  headers,
  rows,
  fileName,
  sheetName = 'Report',
}: DownloadXlsxOptions) {
  const { utils, writeFileXLSX } = await import('xlsx');
  const worksheet = utils.aoa_to_sheet([headers, ...rows]);
  worksheet['!cols'] = calculateColumnWidths(headers, rows);

  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, normalizeSheetName(sheetName));

  writeFileXLSX(workbook, normalizeFileName(fileName), {
    compression: true,
  });
}
