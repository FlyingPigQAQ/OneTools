import { describe, it, expect } from 'vitest';
import { renderMarkdownToHtml, buildHtmlDocument, renderMarkdownDocument } from './markdownRender';

describe('renderMarkdownToHtml', () => {
  it('converts headings', () => {
    expect(renderMarkdownToHtml('# Title').trim()).toBe('<h1>Title</h1>');
    expect(renderMarkdownToHtml('### Sub').trim()).toBe('<h3>Sub</h3>');
  });

  it('converts emphasis and strong', () => {
    const html = renderMarkdownToHtml('_italic_ and **bold**');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<strong>bold</strong>');
  });

  it('renders fenced code blocks', () => {
    const html = renderMarkdownToHtml('```\nconst x = 1;\n```');
    expect(html).toContain('<pre>');
    expect(html).toContain('<code>');
    expect(html).toContain('const x = 1;');
  });

  it('renders inline code', () => {
    const html = renderMarkdownToHtml('Use `npm install`.');
    expect(html).toContain('<code>npm install</code>');
  });

  it('renders GFM tables and task lists', () => {
    const md = [
      '| a | b |',
      '| --- | --- |',
      '| 1 | 2 |',
      '',
      '- [x] done',
      '- [ ] todo',
    ].join('\n');
    const html = renderMarkdownToHtml(md);
    expect(html).toContain('<table>');
    expect(html).toContain('<th>a</th>');
    expect(html).toContain('checked');
  });

  it('treats a single newline as a line break (breaks: true)', () => {
    const html = renderMarkdownToHtml('line one\nline two');
    expect(html).toContain('<br>');
  });
});

describe('buildHtmlDocument', () => {
  it('wraps body in a full HTML document with the theme', () => {
    const doc = buildHtmlDocument('<p>hi</p>', 'dark');
    expect(doc).toContain('<!DOCTYPE html>');
    expect(doc).toContain('<p>hi</p>');
    expect(doc).toContain('--bg: #0d1117;');
  });

  it('falls back to the light theme for an unknown theme id', () => {
    const doc = buildHtmlDocument('<p>hi</p>', 'sepia');
    expect(doc).toContain('#f4ecd8'); // sepia background
  });

  it('includes print-color-adjust so backgrounds survive printToPDF', () => {
    const doc = buildHtmlDocument('', 'light');
    expect(doc).toContain('print-color-adjust: exact');
  });
});

describe('renderMarkdownDocument', () => {
  it('end-to-end renders markdown to a themed document', () => {
    const doc = renderMarkdownDocument('# Hello', 'light');
    expect(doc).toContain('<h1>Hello</h1>');
    expect(doc).toContain('<!DOCTYPE html>');
    expect(doc).toContain('--bg: #ffffff;');
  });
});
