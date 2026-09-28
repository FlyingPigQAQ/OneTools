import { useCallback } from 'react';
import { formatAppError, t as translate, type AppError, type MessageKey } from '@shared/i18n';
import { useLocaleStore } from '../store/localeStore';

export function useI18n() {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const t = useCallback(
    (key: MessageKey, params?: Record<string, string | number>) => translate(locale, key, params),
    [locale]
  );
  const formatError = useCallback((error: AppError) => formatAppError(locale, error), [locale]);
  return { locale, setLocale, t, formatError };
}
