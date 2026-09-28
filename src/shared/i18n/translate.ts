import { en } from './en';
import { zh } from './zh';
import type { AppError, Locale, MessageKey } from './types';

export type { AppError, Locale, MessageKey };

const dictionaries: Record<Locale, unknown> = { en, zh };

export function resolveLocale(saved: string | null | undefined, systemLocale: string): Locale {
  if (saved === 'zh' || saved === 'en') return saved;
  return systemLocale.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

function lookup(tree: unknown, key: string): string | undefined {
  const value = key.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object' && part in (node as object)) {
      return (node as Record<string, unknown>)[part];
    }
    return undefined;
  }, tree);
  return typeof value === 'string' ? value : undefined;
}

export function t(
  locale: Locale,
  key: MessageKey,
  params?: Record<string, string | number>
): string {
  const template = lookup(dictionaries[locale], key) ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

export function formatAppError(locale: Locale, error: AppError): string {
  const text = t(locale, error.key, error.params);
  return error.detail ? `${text}\n${error.detail}` : text;
}

export function isAppError(value: unknown): value is AppError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'key' in value &&
    typeof (value as { key: unknown }).key === 'string'
  );
}

const STATUS_KEYS = {
  pending: 'status.pending',
  converting: 'status.converting',
  completed: 'status.completed',
  error: 'status.error',
  cancelled: 'status.cancelled',
} as const;

export function statusKey(
  status: 'pending' | 'converting' | 'completed' | 'error' | 'cancelled'
): MessageKey {
  return STATUS_KEYS[status];
}
