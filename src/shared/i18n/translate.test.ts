import { describe, expect, it } from 'vitest';
import { en } from './en';
import { zh } from './zh';
import { formatAppError, isAppError, resolveLocale, t, type MessageKey } from './translate';

function leaves(tree: unknown, prefix = ''): string[] {
  if (typeof tree === 'string') return [prefix];
  if (!tree || typeof tree !== 'object') return [];
  return Object.entries(tree as Record<string, unknown>).flatMap(([key, value]) =>
    leaves(value, prefix ? `${prefix}.${key}` : key)
  );
}

describe('resolveLocale', () => {
  it('prefers a saved locale', () => {
    expect(resolveLocale('zh', 'en-US')).toBe('zh');
    expect(resolveLocale('en', 'zh-CN')).toBe('en');
  });

  it('ignores an invalid saved value and uses the system locale', () => {
    expect(resolveLocale('fr', 'zh-CN')).toBe('zh');
    expect(resolveLocale(null, 'en-US')).toBe('en');
    expect(resolveLocale(undefined, '')).toBe('en');
  });

  it('maps every zh* system locale to zh and everything else to en', () => {
    expect(resolveLocale(null, 'zh')).toBe('zh');
    expect(resolveLocale(null, 'zh-CN')).toBe('zh');
    expect(resolveLocale(null, 'zh-TW')).toBe('zh');
    expect(resolveLocale(null, 'en-US')).toBe('en');
    expect(resolveLocale(null, 'fr')).toBe('en');
  });
});

describe('t', () => {
  it('returns the string for the active locale', () => {
    expect(t('en', 'actions.converting')).toBe('Converting...');
    expect(t('zh', 'actions.converting')).toBe('正在转换...');
  });

  it('replaces placeholders and keeps missing ones', () => {
    expect(t('en', 'actions.convert', { count: 2 })).toBe('Convert 2 files');
    expect(t('zh', 'actions.convert', { count: 2 })).toBe('转换 2 个文件');
    expect(t('en', 'actions.convert', {})).toBe('Convert {count} files');
  });

  it('returns the key itself when the path is missing at runtime', () => {
    expect(t('en', 'no.such.key' as MessageKey)).toBe('no.such.key');
  });
});

describe('dictionaries', () => {
  it('has the same non-empty leaves in zh and en', () => {
    const enLeaves = leaves(en).filter(Boolean);
    const zhLeaves = leaves(zh).filter(Boolean);
    expect(zhLeaves.sort()).toEqual(enLeaves.sort());
    for (const key of enLeaves) {
      expect(t('en', key as MessageKey).length).toBeGreaterThan(0);
      expect(t('zh', key as MessageKey).length).toBeGreaterThan(0);
    }
  });
});

describe('isAppError', () => {
  it('accepts an object with a string key', () => {
    expect(isAppError({ key: 'errors.audioLoadFailed' })).toBe(true);
  });

  it('rejects values that are not app errors', () => {
    expect(isAppError(new Error('boom'))).toBe(false);
    expect(isAppError(null)).toBe(false);
    expect(isAppError({ key: 1 })).toBe(false);
  });
});

describe('formatAppError', () => {
  it('returns the translated message', () => {
    expect(formatAppError('zh', { key: 'errors.ffmpegNotFound' })).toBe(
      '未找到 FFmpeg。请确认已安装 FFmpeg。'
    );
  });

  it('appends detail unchanged on a new line', () => {
    expect(
      formatAppError('en', {
        key: 'errors.ffmpegExit',
        params: { code: 1 },
        detail: 'raw stderr',
      })
    ).toBe('FFmpeg exited with code 1\nraw stderr');
  });
});
