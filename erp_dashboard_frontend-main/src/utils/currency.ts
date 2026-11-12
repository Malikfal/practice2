// Валюта почасовой ставки проекта. Ставки без валюты считаются рублёвыми.
export type RateCurrency = 'RUB' | 'EUR' | 'USD';

export const DEFAULT_RATE_CURRENCY: RateCurrency = 'RUB';

export const RATE_CURRENCY_OPTIONS: Array<{ value: RateCurrency; label: string }> = [
  { value: 'RUB', label: 'Рубли, ₽' },
  { value: 'EUR', label: 'Евро, €' },
  { value: 'USD', label: 'Доллары, $' },
];

const CURRENCY_SYMBOLS: Record<RateCurrency, string> = {
  RUB: '₽',
  EUR: '€',
  USD: '$',
};

export function currencySymbol(currency?: string | null): string {
  return CURRENCY_SYMBOLS[(currency ?? DEFAULT_RATE_CURRENCY) as RateCurrency] ?? '₽';
}
