import { existsSync } from 'fs';

/**
 * Fonts the text watermark can use, in preference order.
 *
 * Every entry in `CJK_FONT_CANDIDATES` renders Chinese, and they all come
 * before `LATIN_FONT_CANDIDATES`: `resolveFontFile()` returns the first
 * *existing* candidate, so a Latin-only font anywhere earlier in the list
 * silently turns Chinese watermark text into tofu boxes (`?`-marked squares)
 * — which is exactly what happened when `PingFang.ttc` (absent on newer
 * macOS) fell through to `Helvetica.ttc`.
 *
 * All candidates are system fonts, so nothing has to be bundled with the app.
 * The list is macOS-only by design (OneTools packages for macOS, see AGENTS.md
 * → Packaging).
 */
export const CJK_FONT_CANDIDATES = [
  // PingFang (苹方) ships on older macOS releases only.
  '/System/Library/Fonts/PingFang.ttc',
  // Present on current macOS; the first face renders simplified Chinese.
  '/System/Library/Fonts/Hiragino Sans GB.ttc',
  '/System/Library/Fonts/STHeiti Medium.ttc',
  '/System/Library/Fonts/STHeiti Light.ttc',
  '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
  '/System/Library/Fonts/Supplemental/Songti.ttc',
];

/** Latin-only fallbacks — reached only when no CJK font is installed at all. */
export const LATIN_FONT_CANDIDATES = [
  '/System/Library/Fonts/Helvetica.ttc',
  '/System/Library/Fonts/Supplemental/Arial.ttf',
  '/Library/Fonts/Arial.ttf',
];

export const SYSTEM_FONT_CANDIDATES = [...CJK_FONT_CANDIDATES, ...LATIN_FONT_CANDIDATES];

/** First existing candidate, or undefined when none can be found. */
export function resolveFontFile(
  exists: (path: string) => boolean = existsSync
): string | undefined {
  return SYSTEM_FONT_CANDIDATES.find((candidate) => exists(candidate));
}
