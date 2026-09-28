import { describe, it, expect } from 'vitest';
import {
  CJK_FONT_CANDIDATES,
  LATIN_FONT_CANDIDATES,
  SYSTEM_FONT_CANDIDATES,
  resolveFontFile,
} from './fonts';

describe('resolveFontFile', () => {
  it('returns the first existing candidate', () => {
    const font = resolveFontFile((p) => p === '/System/Library/Fonts/Hiragino Sans GB.ttc');
    expect(font).toBe('/System/Library/Fonts/Hiragino Sans GB.ttc');
  });

  it('never picks a Latin-only font while a CJK font exists', () => {
    // The regression this guards: PingFang.ttc missing on newer macOS used to
    // fall through to Helvetica.ttc, which has no Chinese glyphs — the
    // watermark rendered as tofu boxes instead of Chinese text.
    const font = resolveFontFile(
      (p) => p === '/System/Library/Fonts/Helvetica.ttc' || p === CJK_FONT_CANDIDATES[1]
    );
    expect(font).toBe(CJK_FONT_CANDIDATES[1]);
  });

  it('returns undefined when no candidate exists', () => {
    expect(resolveFontFile(() => false)).toBeUndefined();
  });

  it('orders every CJK candidate before every Latin-only one', () => {
    const lastCjk = SYSTEM_FONT_CANDIDATES.lastIndexOf(CJK_FONT_CANDIDATES.at(-1) as string);
    const firstLatin = SYSTEM_FONT_CANDIDATES.indexOf(LATIN_FONT_CANDIDATES[0]);
    expect(lastCjk).toBeLessThan(firstLatin);
    expect(SYSTEM_FONT_CANDIDATES).toEqual([...CJK_FONT_CANDIDATES, ...LATIN_FONT_CANDIDATES]);
  });
});
