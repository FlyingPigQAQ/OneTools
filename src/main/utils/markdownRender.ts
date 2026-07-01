import { marked } from 'marked';
import type { MarkdownTheme } from '@shared/types';

/**
 * Pure Markdown → HTML rendering. Extracted from the Electron-dependent
 * `MarkdownPdfConverter` so it can be unit-tested without spawning a
 * BrowserWindow or importing Electron.
 *
 * `marked` is configured for GitHub-flavored Markdown (line breaks, tables,
 * strikethrough). The returned string is the full document body only — the
 * caller wraps it in the themed HTML shell via `buildHtmlDocument`.
 */
marked.setOptions({
  gfm: true,
  breaks: true,
});

export function renderMarkdownToHtml(markdown: string): string {
  return marked.parse(markdown, { async: false }) as string;
}

/**
 * Map a theme id to the CSS that styles the printed page. Each theme defines a
 * background, text color, and link/accent colors; `printBackground: true` in
 * printToPDF ensures these are preserved in the PDF (otherwise Chromium drops
 * backgrounds).
 */
function themeCss(theme: MarkdownTheme): string {
  const themes: Record<MarkdownTheme, string> = {
    light: `
      --bg: #ffffff;
      --text: #24292f;
      --accent: #0969da;
      --border: #d0d7de;
      --code-bg: #f6f8fa;
      --code-text: #24292f;
      --quote-text: #57606a;
    `,
    sepia: `
      --bg: #f4ecd8;
      --text: #3a3326;
      --accent: #9a6a3a;
      --border: #d8c9a8;
      --code-bg: #ebe0c8;
      --code-text: #3a3326;
      --quote-text: #6b5d44;
    `,
    dark: `
      --bg: #0d1117;
      --text: #c9d1d9;
      --accent: #58a6ff;
      --border: #30363d;
      --code-bg: #161b22;
      --code-text: #c9d1d9;
      --quote-text: #8b949e;
    `,
  };
  return themes[theme] ?? themes.light;
}

/**
 * Wrap rendered HTML body in a themed document with print-friendly typography.
 * Margins are handled by printToPDF, so the page itself only carries content
 * padding (kept at zero so the PDF margins are exact).
 */
export function buildHtmlDocument(bodyHtml: string, theme: MarkdownTheme): string {
  const themeVars = themeCss(theme);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root { ${themeVars} }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    font-size: 14px;
    line-height: 1.6;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .md-page {
    padding: 0;
  }
  h1, h2, h3, h4, h5, h6 {
    margin: 24px 0 16px;
    font-weight: 600;
    line-height: 1.25;
  }
  h1 { font-size: 2em; padding-bottom: 0.3em; border-bottom: 1px solid var(--border); }
  h2 { font-size: 1.5em; padding-bottom: 0.3em; border-bottom: 1px solid var(--border); }
  h3 { font-size: 1.25em; }
  h4 { font-size: 1em; }
  p { margin: 0 0 16px; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  ul, ol { margin: 0 0 16px; padding-left: 2em; }
  li { margin: 4px 0; }
  blockquote {
    margin: 0 0 16px;
    padding: 0 1em;
    color: var(--quote-text);
    border-left: 0.25em solid var(--border);
  }
  code {
    font-family: 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
    font-size: 0.85em;
    background: var(--code-bg);
    color: var(--code-text);
    padding: 0.2em 0.4em;
    border-radius: 4px;
  }
  pre {
    margin: 0 0 16px;
    padding: 12px 16px;
    background: var(--code-bg);
    color: var(--code-text);
    border-radius: 6px;
    overflow: hidden;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
  pre code {
    background: transparent;
    padding: 0;
    font-size: 0.85em;
    white-space: pre-wrap;
  }
  table {
    border-collapse: collapse;
    margin: 0 0 16px;
    width: 100%;
    overflow: hidden;
    display: block;
  }
  table th, table td {
    border: 1px solid var(--border);
    padding: 6px 13px;
  }
  table th { font-weight: 600; background: var(--code-bg); }
  table tr { background: var(--bg); }
  img { max-width: 100%; height: auto; }
  hr { height: 1px; border: 0; background: var(--border); margin: 24px 0; }
  /* Avoid breaking inside these blocks when paginating to PDF. */
  pre, blockquote, table, tr { page-break-inside: avoid; }
  h1, h2, h3, h4, h5, h6 { page-break-after: avoid; }
</style>
</head>
<body>
<div class="md-page">
${bodyHtml}
</div>
</body>
</html>`;
}

/** Render Markdown source to a full themed HTML document ready for printToPDF. */
export function renderMarkdownDocument(markdown: string, theme: MarkdownTheme): string {
  return buildHtmlDocument(renderMarkdownToHtml(markdown), theme);
}
