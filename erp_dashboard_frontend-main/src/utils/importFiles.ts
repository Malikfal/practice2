export const downloadTemplate = async (fileName?: string) => {
  if (!fileName || fileName.length === 0) return;
  const response = await fetch(`/templates/${fileName}`);
  const blob = await response.blob();

  const downloadUrl = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = fileName;
  a.click();

  URL.revokeObjectURL(downloadUrl);
};

export const parseXLSX = async (file: File) => {
  const [data, XLSX] = await Promise.all([file.arrayBuffer(), import('xlsx')]);
  const workbook = XLSX.read(data, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  console.log(rows);
  return rows;
};

export const parseCSV = async (file: File) => {
  const buffer = await file.arrayBuffer();

  let text: string;

  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    text = new TextDecoder('windows-1251').decode(buffer);
  }

  const lines = text.trim().split(/\r?\n/);

  if (lines.length < 2) {
    return [];
  }

  const headerLine = lines[0].replace(/^\uFEFF/, '');
  const delimiter = headerLine.includes(';') ? ';' : ',';

  const headers = headerLine.split(delimiter).map((h) => h.trim());

  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) continue;

    const values = line.split(delimiter).map((v) => v.trim());

    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });

    rows.push(row);
  }

  return rows;
};
