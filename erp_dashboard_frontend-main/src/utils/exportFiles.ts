import { downloadXlsx, type CellValue } from './xlsx';

export type ExportTableData = {
  headers: string[];
  rows: CellValue[][];
  fileName: string;
  sheetName: string;
};

const UTF8_BOM = '\uFEFF';

function normalizeCsvFileName(fileName: string): string {
  return fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
}

function toCsvCell(value: CellValue): string {
  const text = value == null ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function downloadCsv({ headers, rows, fileName }: ExportTableData) {
  const contents = [headers, ...rows]
    .map((row) => row.map(toCsvCell).join(';'))
    .join('\n');
  const blob = new Blob([UTF8_BOM, contents], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = normalizeCsvFileName(fileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadExportXlsx(data: ExportTableData) {
  return downloadXlsx(data);
}

export type PrintTableData = ExportTableData & {
  title: string;
  subtitle?: string;
  /** Итоговая строка, печатается жирным под таблицей. */
  footer?: CellValue[];
};

function escapeHtml(value: CellValue): string {
  return (value == null ? '' : String(value))
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function toHtmlRow(cells: CellValue[], tag: 'td' | 'th'): string {
  return `<tr>${cells.map((cell) => `<${tag}>${escapeHtml(cell)}</${tag}>`).join('')}</tr>`;
}

/**
 * PDF через печать браузера («Сохранить как PDF»), как кнопка «Печать» в отчёте по задачам.
 * Таблица печатается из скрытого iframe, поэтому интерфейс страницы в PDF не попадает.
 * Первая колонка выравнивается влево, остальные считаются числовыми и выравниваются вправо.
 */
export function printTableAsPdf({
  title,
  subtitle,
  headers,
  rows,
  footer,
  fileName,
}: PrintTableData) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  iframe.onload = () => {
    const frameWindow = iframe.contentWindow;
    if (!frameWindow) {
      iframe.remove();
      return;
    }

    // Chrome ждёт закрытия диалога внутри print(), Firefox сообщает о нём через afterprint.
    frameWindow.addEventListener('afterprint', () =>
      window.setTimeout(() => iframe.remove(), 0),
    );
    frameWindow.focus();
    frameWindow.print();
  };
  // Заголовок документа браузер предлагает как имя PDF-файла.
  iframe.srcdoc = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>${escapeHtml(fileName)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  body { margin: 0; font-family: Arial, 'Helvetica Neue', sans-serif; color: #1f2937; font-size: 11px; }
  h1 { margin: 0 0 4px; font-size: 16px; }
  p { margin: 0 0 12px; color: #6b7280; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 5px 8px; border: 1px solid #d1d5db; text-align: right; white-space: nowrap; }
  th:first-child, td:first-child { text-align: left; white-space: normal; }
  th { background: #f3f4f6; }
  tfoot td { font-weight: 700; background: #f9fafb; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}
<table>
<thead>${toHtmlRow(headers, 'th')}</thead>
<tbody>${rows.map((row) => toHtmlRow(row, 'td')).join('')}</tbody>
${footer ? `<tfoot>${toHtmlRow(footer, 'td')}</tfoot>` : ''}
</table>
</body>
</html>`;
  document.body.appendChild(iframe);
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
