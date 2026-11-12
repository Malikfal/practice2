// Прежние адреса настроек финансов и ФОТ, которые переехали в «Финансы» и «Оплату труда».
// Возвращает новый адрес или null, если адрес актуален.

const PAYROLL_PAYOUT_TABS = new Set(['sheet', 'debt', 'payouts']);
const PAYROLL_CALCULATION_TABS = new Set(['analytics', 'periods', 'employees']);

function withSearch(pathname: string, params: URLSearchParams) {
  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
}

export function getLegacyRedirectPath(asPath: string): string | null {
  const [rawPathname, rawSearch = ''] = asPath.split('?');
  const pathname = rawPathname.replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(rawSearch);

  // /finances?view=payroll&payroll_view=… → /payroll?view=…&tab=…, прочие параметры сохраняются.
  if (pathname === '/finances' && params.get('view') === 'payroll') {
    const tab = params.get('payroll_view') ?? '';
    params.delete('view');
    params.delete('payroll_view');

    if (PAYROLL_PAYOUT_TABS.has(tab)) {
      params.set('view', 'payout');
      if (tab !== 'sheet') params.set('tab', tab);
    } else if (PAYROLL_CALCULATION_TABS.has(tab) && tab !== 'analytics') {
      params.set('tab', tab);
    }

    return withSearch('/payroll', params);
  }

  if (pathname !== '/settings/finance' && !pathname.startsWith('/settings/finance/')) {
    return null;
  }

  const tab = pathname.split('/')[3] ?? 'articles';

  if (
    tab === 'salary' ||
    (tab === 'articles' && params.get('group') === 'payroll-payout')
  ) {
    return '/payroll?view=settings&tab=articles';
  }
  if (tab === 'planned-expenses') return '/finances?view=settings&tab=planned-expenses';
  if (tab === 'projects') return '/finances?view=settings&tab=rates';

  return '/finances?view=settings';
}
