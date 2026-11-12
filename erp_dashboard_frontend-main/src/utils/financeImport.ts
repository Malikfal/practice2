import type {
  Client,
  FinanceArticle,
  FinanceDistributionMethod,
  FinancePayload,
  FinanceType,
  Project,
  ProjectEditorForm,
  User,
} from '../types/app';
import { isProjectArchived } from './formatters';

export const FINANCE_IMPORT_TEMPLATES = [
  { label: 'Скачать шаблон XLSX', fileName: 'finances_import_tpl.xlsx' },
  { label: 'Скачать шаблон XLS', fileName: 'finances_import_tpl.xls' },
  { label: 'Скачать шаблон CSV', fileName: 'finances_import_tpl.csv' },
];

type ImportFinanceApi = {
  finances: {
    create: (_payload: FinancePayload) => Promise<unknown>;
  };
  financeArticles: {
    create: (_payload: {
      name: string;
      type: FinanceType;
      parent_id?: string | null;
      distribution_method?: FinanceDistributionMethod;
    }) => Promise<FinanceArticle>;
  };
  clients: {
    create: (_payload: { name: string; description: string }) => Promise<Client>;
  };
  projects: {
    update: (_projectId: string, _payload: ProjectEditorForm) => Promise<Project>;
  };
};

type ImportFinanceRowsParams = {
  rows: unknown[];
  api: ImportFinanceApi;
  articles: FinanceArticle[];
  projects: Project[];
  clients: Client[];
  employees: User[];
};

export type FinanceImportResult = {
  successCount: number;
  errorDetails: { row: number; errors: string[] }[];
  warningDetails: { row: number; errors: string[] }[];
  articles: FinanceArticle[];
  projects: Project[];
  clients: Client[];
};

type FinanceImportContext = {
  api: ImportFinanceApi;
  articles: FinanceArticle[];
  projects: Project[];
  clients: Client[];
  employees: User[];
};

type FinanceRowValidationResult =
  | { valid: true; payload: FinancePayload; warnings: string[] }
  | { valid: false; errors: string[] };

const FINANCE_TYPE_BY_LABEL: Record<string, FinanceType> = {
  поступление: 'ENTRANCE',
  entrance: 'ENTRANCE',
  income: 'ENTRANCE',
  приход: 'ENTRANCE',
  расход: 'EXPENDITURE',
  expenditure: 'EXPENDITURE',
  expense: 'EXPENDITURE',
};

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeLookupValue(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function isEmptyImportValue(value: unknown): boolean {
  const normalized = normalizeLookupValue(value);
  return !normalized || normalized === '-' || normalized === '—';
}

function findKeyByWord(data: Record<string, unknown>, keywords: string[]) {
  return Object.keys(data).find((key) => {
    const lowerKey = key.toLowerCase();
    return keywords.some((keyword) => lowerKey === keyword || lowerKey.includes(keyword));
  });
}

function flattenFinanceArticles(articleList: FinanceArticle[]): FinanceArticle[] {
  return articleList.flatMap((article) => [
    article,
    ...flattenFinanceArticles(article.children ?? []),
  ]);
}

function parseFinanceDateForApi(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';

  if (typeof value === 'number' || /^\d+$/.test(String(value))) {
    const excelDate = Number(value);
    if (excelDate > 0 && excelDate < 100000) {
      const date = new Date((excelDate - 25569) * 86400 * 1000);
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString().split('T')[0] ?? '';
      }
    }
  }

  const dateStr = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

  const ddmmyyyyMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (ddmmyyyyMatch) {
    const [, day, month, year] = ddmmyyyyMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const parsedDate = new Date(dateStr);
  if (!Number.isNaN(parsedDate.getTime())) {
    return parsedDate.toISOString().split('T')[0] ?? '';
  }

  return '';
}

function parseFinanceAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(Math.abs(value) * 100);
  }

  const raw = normalizeText(value);
  if (!raw || raw === '-' || raw === '—') return null;

  const normalized = raw
    .replace(/[₽руб]/gi, '')
    .replace(/\s+/g, '')
    .replace(/^[+\-−–—]+/, '')
    .replace(',', '.');

  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return Math.round(amount * 100);
}

function findFinanceType(typeLabel: string): FinanceType | null {
  return FINANCE_TYPE_BY_LABEL[normalizeLookupValue(typeLabel)] ?? null;
}

function findArticleByName(
  articleName: string,
  type: FinanceType,
  articles: FinanceArticle[],
) {
  const normalizedName = normalizeLookupValue(articleName);
  return (
    flattenFinanceArticles(articles).find(
      (article) =>
        article.type === type && normalizeLookupValue(article.name) === normalizedName,
    ) ?? null
  );
}

async function resolveFinanceArticle(
  articleName: string,
  type: FinanceType,
  context: FinanceImportContext,
) {
  if (isEmptyImportValue(articleName)) return null;

  const existingArticle = findArticleByName(articleName, type, context.articles);
  if (existingArticle) return existingArticle.id;

  const createdArticle = await context.api.financeArticles.create({
    name: articleName.trim(),
    type,
    parent_id: null,
    distribution_method: 'BY_TERM',
  });

  context.articles = [...context.articles, { ...createdArticle, children: [] }];
  return createdArticle.id;
}

function findClientByName(clientName: string, clients: Client[]) {
  const normalizedClientName = normalizeLookupValue(clientName);
  return (
    clients.find(
      (client) => normalizeLookupValue(client.name) === normalizedClientName,
    ) ?? null
  );
}

async function resolveClient(clientName: string, context: FinanceImportContext) {
  if (isEmptyImportValue(clientName)) return null;

  const existingClient = findClientByName(clientName, context.clients);
  if (existingClient) return existingClient;

  const createdClient = await context.api.clients.create({
    name: clientName.trim(),
    description: '',
  });
  context.clients = [...context.clients, createdClient];
  return createdClient;
}

function buildProjectUpdatePayload(
  project: Project,
  clientId: string,
): ProjectEditorForm {
  return {
    projectId: project.id,
    name: project.name || '',
    description: project.description || '',
    status: isProjectArchived(project.status) ? 'ARCHIVED' : 'ACTIVE',
    client_id: clientId,
    manager_payment_method: project.manager_payment_method || 'ACCRUE_ALL',
    is_internal: Boolean(project.is_internal),
    exclude_from_payroll: Boolean(project.exclude_from_payroll),
    payroll_exclusion_scope:
      project.payroll_exclusion_scope === 'SELECTED' ? 'SELECTED' : 'ALL',
    payroll_excluded_employee_ids: project.payroll_excluded_employee_ids ?? [],
  };
}

async function bindClientToProject(
  project: Project,
  client: Client,
  context: FinanceImportContext,
) {
  if (project.client_id && project.client_id !== client.id) {
    return {
      project: null,
      warning: `Проект "${project.name}" уже привязан к другому клиенту`,
    };
  }

  if (project.client?.id && project.client.id !== client.id) {
    return {
      project: null,
      warning: `Проект "${project.name}" уже привязан к другому клиенту`,
    };
  }

  if (project.client_id === client.id || project.client?.id === client.id) {
    return { project };
  }

  const updatedProject = await context.api.projects.update(
    project.id,
    buildProjectUpdatePayload(project, client.id),
  );
  context.projects = context.projects.map((item) =>
    item.id === updatedProject.id ? updatedProject : item,
  );

  return { project: updatedProject };
}

async function resolveProject(
  projectName: string,
  clientName: string,
  context: FinanceImportContext,
): Promise<{ project: Project | null; warning?: string }> {
  const normalizedProjectName = normalizeLookupValue(projectName);
  if (!normalizedProjectName) return { project: null };

  const matchingProjects = context.projects.filter(
    (project) => normalizeLookupValue(project.name) === normalizedProjectName,
  );

  if (matchingProjects.length === 0) {
    return {
      project: null,
      warning: `Проект "${projectName.trim()}" не найден. Платеж создан без проекта`,
    };
  }

  if (isEmptyImportValue(clientName)) {
    if (matchingProjects.length > 1) {
      return {
        project: null,
        warning: `Найдено несколько проектов "${projectName.trim()}". Платеж создан без проекта`,
      };
    }

    return { project: matchingProjects[0] ?? null };
  }

  const existingClient = findClientByName(clientName, context.clients);
  const projectWithClient = matchingProjects.find(
    (project) =>
      (existingClient &&
        (project.client_id === existingClient.id ||
          project.client?.id === existingClient.id)) ||
      normalizeLookupValue(project.client?.name) === normalizeLookupValue(clientName),
  );

  if (projectWithClient) return { project: projectWithClient };

  const projectsWithoutClient = matchingProjects.filter(
    (project) => !project.client_id && !project.client,
  );

  if (projectsWithoutClient.length === 1 && projectsWithoutClient[0]) {
    const client = await resolveClient(clientName, context);
    if (!client) return { project: projectsWithoutClient[0] };

    return bindClientToProject(projectsWithoutClient[0], client, context);
  }

  if (projectsWithoutClient.length > 1) {
    return {
      project: null,
      warning: `Найдено несколько проектов "${projectName.trim()}" без клиента. Платеж создан без проекта`,
    };
  }

  if (matchingProjects.length === 1 && matchingProjects[0]) {
    return {
      project: matchingProjects[0],
      warning: `Проект "${projectName.trim()}" уже привязан к другому клиенту. Платеж создан с указанным проектом`,
    };
  }

  return {
    project: null,
    warning: `Найдено несколько проектов "${projectName.trim()}" с другими клиентами. Платеж создан без проекта`,
  };
}

function findEmployeeByEmail(employeeEmail: string, employees: User[]): User | null {
  if (isEmptyImportValue(employeeEmail)) return null;

  const normalizedEmail = normalizeLookupValue(employeeEmail);
  return (
    employees.find(
      (employee) => normalizeLookupValue(employee.email) === normalizedEmail,
    ) ?? null
  );
}

async function validateFinanceRow(
  data: Record<string, unknown>,
  context: FinanceImportContext,
): Promise<FinanceRowValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const dateKey = findKeyByWord(data, ['дата', 'date']);
  const typeKey = findKeyByWord(data, ['тип', 'type']);
  const articleKey = findKeyByWord(data, ['статья', 'article']);
  const amountKey = findKeyByWord(data, ['сумма', 'amount']);
  const projectKey = findKeyByWord(data, ['проект', 'project']);
  const clientKey = findKeyByWord(data, ['клиент', 'client']);
  const employeeEmailKey = findKeyByWord(data, ['участник', 'employee']);
  const commentKey = findKeyByWord(data, ['комментарий', 'comment']);

  const dateOfPayment = parseFinanceDateForApi(
    (data[dateKey || 'Дата'] as string | number | null | undefined) ?? '',
  );
  const typeLabel = normalizeText(data[typeKey || 'Тип']);
  const articleName = normalizeText(data[articleKey || 'Статья']);
  const projectName = normalizeText(data[projectKey || 'Проект']);
  const clientName = normalizeText(data[clientKey || 'Клиент']);
  const employeeEmail = normalizeText(data[employeeEmailKey || 'Участник'] ?? '');
  const comment = normalizeText(data[commentKey || 'Комментарий']);
  const amount = parseFinanceAmount(data[amountKey || 'Сумма']);

  if (!dateOfPayment) errors.push('Некорректная или отсутствует дата');
  if (!typeLabel) errors.push('Отсутствует тип');
  if (amount === null) errors.push('Некорректная или отсутствует сумма');

  const type = findFinanceType(typeLabel);
  if (typeLabel && !type) {
    errors.push(`Тип "${typeLabel}" не распознан`);
  }

  if (errors.length > 0 || !type || amount === null) {
    return { valid: false, errors };
  }

  let financeArticleId: string | null = null;
  if (!isEmptyImportValue(articleName)) {
    financeArticleId = await resolveFinanceArticle(articleName, type, context);
  }

  let projectId: string | null = null;
  if (!isEmptyImportValue(projectName)) {
    const projectLookup = await resolveProject(projectName, clientName, context);
    if (projectLookup.warning) {
      warnings.push(projectLookup.warning);
    }

    if (projectLookup.project) {
      projectId = projectLookup.project.id;
    }
  }

  let employeeId: string | null = null;
  if (!isEmptyImportValue(employeeEmail)) {
    const employee = findEmployeeByEmail(employeeEmail, context.employees);
    if (employee) {
      employeeId = employee.id;
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    warnings,
    payload: {
      type,
      amount,
      dateOfPayment,
      finance_article_id: financeArticleId,
      project_id: projectId,
      employee_id: employeeId,
      comment: comment || null,
    },
  };
}

export async function importFinanceRows({
  rows,
  api,
  articles,
  projects,
  clients,
  employees,
}: ImportFinanceRowsParams): Promise<FinanceImportResult> {
  const context: FinanceImportContext = {
    api,
    articles: [...articles],
    projects: [...projects],
    clients: [...clients],
    employees,
  };
  let successCount = 0;
  const errorDetails: { row: number; errors: string[] }[] = [];
  const warningDetails: { row: number; errors: string[] }[] = [];

  for (let index = 0; index < rows.length; index++) {
    const rawData = rows[index];

    try {
      if (typeof rawData !== 'object' || rawData === null) {
        errorDetails.push({
          row: index + 2,
          errors: ['Некорректный формат данных'],
        });
        continue;
      }

      const validation = await validateFinanceRow(
        rawData as Record<string, unknown>,
        context,
      );

      if (!validation.valid) {
        errorDetails.push({
          row: index + 2,
          errors: validation.errors,
        });
        continue;
      }

      if (validation.warnings.length > 0) {
        warningDetails.push({
          row: index + 2,
          errors: validation.warnings,
        });
      }

      await context.api.finances.create(validation.payload);
      successCount++;
    } catch (err) {
      errorDetails.push({
        row: index + 2,
        errors: [err instanceof Error ? err.message : 'Неизвестная ошибка'],
      });
    }
  }

  return {
    successCount,
    errorDetails,
    warningDetails,
    articles: context.articles,
    projects: context.projects,
    clients: context.clients,
  };
}
