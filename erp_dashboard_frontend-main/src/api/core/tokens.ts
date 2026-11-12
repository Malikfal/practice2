import { REFRESH_TOKEN_KEY, TOKEN_KEY } from '../../constants/app';

export function clearTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}
