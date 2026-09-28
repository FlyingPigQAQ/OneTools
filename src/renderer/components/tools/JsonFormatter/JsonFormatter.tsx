import { useState, useMemo, useCallback, useRef, useLayoutEffect, useEffect } from 'react';
import ToolHeader from '../../common/ToolHeader';
import {
  formatJson,
  minifyJson,
  escapeJson,
  unescapeJson,
  validateJson,
  jsonStats,
  type IndentOption,
  type JsonValidationError,
  type JsonResult,
} from '@shared/jsonTools';
import styles from './JsonFormatter.module.css';

const INDENTS: { id: IndentOption; label: string }[] = [
  { id: 2, label: '2 spaces' },
  { id: 4, label: '4 spaces' },
  { id: 'tab', label: 'Tab' },
];

const SAMPLE = '{"name":"OneTools","tags":["json","formatter"],"nested":{"valid":true,"count":3}}';

/** Heights of each logical line after soft-wrapping, so gutter numbers stay aligned. */
function measureWrappedLineHeights(textarea: HTMLTextAreaElement, text: string): number[] {
  const style = getComputedStyle(textarea);
  const width =
    textarea.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  probe.style.pointerEvents = 'none';
  probe.style.whiteSpace = 'pre-wrap';
  probe.style.overflowWrap = 'anywhere';
  probe.style.width = `${Math.max(0, width)}px`;
  probe.style.font = style.font;
  probe.style.lineHeight = style.lineHeight;
  probe.style.letterSpacing = style.letterSpacing;
  probe.style.padding = '0';
  probe.style.border = '0';
  document.body.appendChild(probe);
  const lines = text === '' ? [''] : text.split('\n');
  const heights = lines.map((line) => {
    probe.textContent = line.length === 0 ? ' ' : line;
    return probe.getBoundingClientRect().height;
  });
  probe.remove();
  return heights;
}

type ValidationState =
  | { kind: 'idle' }
  | { kind: 'valid' }
  | { kind: 'invalid'; error: JsonValidationError };

type ActionId = 'format' | 'minify' | 'escape' | 'unescape';

/** Textareas ignore flex-stretched width when wrapping, so pin the wrap width to the pane. */
function fitTextareaWidth(textarea: HTMLTextAreaElement) {
  const pane = textarea.parentElement;
  if (!pane) return;
  const gutter = pane.querySelector('[data-gutter]');
  const gutterWidth = gutter instanceof HTMLElement ? gutter.offsetWidth : 0;
  const width = Math.max(0, pane.clientWidth - gutterWidth);
  const next = `${width}px`;
  if (textarea.style.width !== next) textarea.style.width = next;
}

function JsonFormatter() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [indent, setIndent] = useState<IndentOption>(2);
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<ActionId | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const outputRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const [lineHeights, setLineHeights] = useState<number[]>([]);

  // Live validation — recomputed on every keystroke.
  const validation: ValidationState = useMemo(() => {
    if (input.trim() === '') return { kind: 'idle' };
    const error = validateJson(input);
    return error ? { kind: 'invalid', error } : { kind: 'valid' };
  }, [input]);

  const stats = useMemo(() => jsonStats(input), [input]);

  const lineCount = input === '' ? 1 : input.split('\n').length;
  const errorLine = validation.kind === 'invalid' ? validation.error.line : undefined;

  const hasInput = input.trim() !== '';
  const canFormat = validation.kind === 'valid';
  const canUnescape = useMemo(() => hasInput && unescapeJson(input).ok, [hasInput, input]);

  const applyResult = useCallback((result: JsonResult, action: ActionId) => {
    if (result.ok) {
      setActionError(null);
      setOutput(result.output);
      setActiveAction(action);
    } else {
      setActionError(result.error.message);
    }
  }, []);

  const handleFormat = useCallback(() => {
    applyResult(formatJson(input, indent), 'format');
  }, [applyResult, input, indent]);

  const handleMinify = useCallback(() => {
    applyResult(minifyJson(input), 'minify');
  }, [applyResult, input]);

  const handleEscape = useCallback(() => {
    applyResult(escapeJson(input), 'escape');
  }, [applyResult, input]);

  const handleUnescape = useCallback(() => {
    applyResult(unescapeJson(input), 'unescape');
  }, [applyResult, input]);

  const handleClear = useCallback(() => {
    setInput('');
    setOutput('');
    setActionError(null);
    setActiveAction(null);
    inputRef.current?.focus();
  }, []);

  const handleSample = useCallback(() => {
    setInput(SAMPLE);
    setActiveAction(null);
  }, []);

  const handleCopy = useCallback(async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can fail without focus; select as a fallback path.
    }
  }, [output]);

  const handleUseOutput = useCallback(() => {
    if (!output) return;
    setInput(output);
    setOutput('');
    setActiveAction(null);
  }, [output]);

  const handleIndentChange = useCallback(
    (next: IndentOption) => {
      setIndent(next);
      // Indent only restyles a result the user already asked to format.
      if (activeAction === 'format' && hasInput && validation.kind === 'valid') {
        applyResult(formatJson(input, next), 'format');
      }
    },
    [activeAction, applyResult, hasInput, input, validation.kind]
  );

  const syncLineHeights = useCallback(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    fitTextareaWidth(textarea);
    if (outputRef.current) fitTextareaWidth(outputRef.current);
    const next = measureWrappedLineHeights(textarea, input);
    setLineHeights((prev) =>
      prev.length === next.length && prev.every((height, index) => height === next[index])
        ? prev
        : next
    );
  }, [input]);

  useLayoutEffect(() => {
    syncLineHeights();
  }, [syncLineHeights]);

  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => syncLineHeights());
    observer.observe(textarea.parentElement ?? textarea);
    if (outputRef.current?.parentElement) observer.observe(outputRef.current.parentElement);
    return () => observer.disconnect();
  }, [syncLineHeights]);

  // Keep the line-number gutter in sync with textarea scrolling.
  const handleScroll = useCallback(() => {
    if (gutterRef.current && inputRef.current) {
      gutterRef.current.scrollTop = inputRef.current.scrollTop;
    }
  }, []);

  const statusNode = useMemo(() => {
    if (actionError) {
      return (
        <span className={styles.statusInvalid}>
          ✗ <span className={styles.statusError}>{actionError}</span>
        </span>
      );
    }
    switch (validation.kind) {
      case 'idle':
        return <span className={styles.statusIdle}>Paste JSON to validate</span>;
      case 'valid':
        return <span className={styles.statusValid}>✓ Valid JSON</span>;
      case 'invalid': {
        const { error } = validation;
        const where =
          error.line !== undefined
            ? ` at line ${error.line}${error.column !== undefined ? `, column ${error.column}` : ''}`
            : '';
        return (
          <span className={styles.statusInvalid}>
            ✗ Invalid JSON{where} — <span className={styles.statusError}>{error.message}</span>
          </span>
        );
      }
    }
  }, [actionError, validation]);

  return (
    <div className={styles.container}>
      <ToolHeader
        title="JSON Formatter"
        subtitle="Format, validate, minify and escape JSON — entirely offline."
        number="05"
      />

      <div className={styles.toolbar}>
        <button
          className={`${styles.actionBtn} ${activeAction === 'format' ? styles.primary : ''}`}
          onClick={handleFormat}
          disabled={!canFormat}
        >
          Format
        </button>
        <button
          className={`${styles.actionBtn} ${activeAction === 'minify' ? styles.primary : ''}`}
          onClick={handleMinify}
          disabled={!canFormat}
        >
          Minify
        </button>
        <button
          className={`${styles.actionBtn} ${activeAction === 'escape' ? styles.primary : ''}`}
          onClick={handleEscape}
          disabled={!canFormat}
        >
          Escape
        </button>
        <button
          className={`${styles.actionBtn} ${activeAction === 'unescape' ? styles.primary : ''}`}
          onClick={handleUnescape}
          disabled={!canUnescape}
        >
          Unescape
        </button>
        <div className={styles.toolbarDivider} />
        <button className={styles.actionBtn} onClick={handleClear} disabled={!hasInput && !output}>
          Clear
        </button>
        <button className={styles.actionBtn} onClick={handleSample}>
          Sample
        </button>

        <div className={styles.indentGroup}>
          <span className={styles.indentLabel}>Indent</span>
          {INDENTS.map((opt) => (
            <button
              key={String(opt.id)}
              className={`${styles.indentChip} ${indent === opt.id ? styles.active : ''}`}
              onClick={() => handleIndentChange(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.statusBar}>
        {statusNode}
        {stats && (
          <span className={styles.statusStats}>
            {stats.bytes} B · {stats.lines} lines · {stats.keys} keys · depth {stats.depth}
          </span>
        )}
      </div>

      <div className={styles.panes}>
        <div className={styles.pane}>
          <div className={styles.paneHeader}>
            <span className={styles.paneTitle}>Input</span>
          </div>
          <div className={styles.editorWrap}>
            <div className={styles.lineNumbers} ref={gutterRef} data-gutter aria-hidden>
              {Array.from({ length: lineCount }, (_, i) => (
                <span
                  key={i}
                  className={i + 1 === errorLine ? styles.errorLine : undefined}
                  style={lineHeights[i] ? { height: lineHeights[i] } : undefined}
                >
                  {i + 1}
                </span>
              ))}
            </div>
            <textarea
              ref={inputRef}
              className={styles.textarea}
              value={input}
              wrap="soft"
              onChange={(e) => {
                setInput(e.target.value);
                setActionError(null);
                setActiveAction(null);
              }}
              onScroll={handleScroll}
              placeholder='Paste JSON here, e.g. {"hello":"world"}'
              spellCheck={false}
              autoFocus
            />
          </div>
        </div>

        <div className={styles.pane}>
          <div className={styles.paneHeader}>
            <span className={styles.paneTitle}>Output</span>
            <span>
              <button
                className={styles.paneAction}
                onClick={handleUseOutput}
                disabled={!output}
                title="Move output back into the input editor"
              >
                ← Edit
              </button>
              <button className={styles.paneAction} onClick={handleCopy} disabled={!output}>
                {copied ? 'Copied ✓' : 'Copy'}
              </button>
            </span>
          </div>
          <div className={styles.editorWrap}>
            <textarea
              ref={outputRef}
              className={styles.textarea}
              value={output}
              wrap="soft"
              readOnly
              placeholder="Formatted output appears here"
              spellCheck={false}
            />
          </div>
        </div>
      </div>

      <p className={styles.hint}>
        Validation runs as you type; errors report the line and column when the engine
        provides them. “Escape” wraps the document in a JSON string literal for embedding;
        “Unescape” decodes one level of string escaping, including text that is not wrapped in quotes.
      </p>
    </div>
  );
}

export default JsonFormatter;
