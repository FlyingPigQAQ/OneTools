import { useState, useMemo, useCallback, useRef } from 'react';
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
} from '@shared/jsonTools';
import styles from './JsonFormatter.module.css';

const INDENTS: { id: IndentOption; label: string }[] = [
  { id: 2, label: '2 spaces' },
  { id: 4, label: '4 spaces' },
  { id: 'tab', label: 'Tab' },
];

const SAMPLE = '{"name":"OneTools","tags":["json","formatter"],"nested":{"valid":true,"count":3}}';

type ValidationState =
  | { kind: 'idle' }
  | { kind: 'valid' }
  | { kind: 'invalid'; error: JsonValidationError };

function JsonFormatter() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [indent, setIndent] = useState<IndentOption>(2);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

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

  const applyResult = useCallback(
    (result: ReturnType<typeof formatJson>) => {
      if (result.ok) setOutput(result.output);
    },
    []
  );

  const handleFormat = useCallback(() => {
    applyResult(formatJson(input, indent));
  }, [applyResult, input, indent]);

  const handleMinify = useCallback(() => {
    applyResult(minifyJson(input));
  }, [applyResult, input]);

  const handleEscape = useCallback(() => {
    applyResult(escapeJson(input));
  }, [applyResult, input]);

  const handleUnescape = useCallback(() => {
    applyResult(unescapeJson(input));
  }, [applyResult, input]);

  const handleClear = useCallback(() => {
    setInput('');
    setOutput('');
    inputRef.current?.focus();
  }, []);

  const handleSample = useCallback(() => {
    setInput(SAMPLE);
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
  }, [output]);

  const handleIndentChange = useCallback(
    (next: IndentOption) => {
      setIndent(next);
      // Re-format with the new indent when there's already something to format.
      if (hasInput && validation.kind === 'valid') {
        applyResult(formatJson(input, next));
      }
    },
    [applyResult, hasInput, input, validation.kind]
  );

  // Keep the line-number gutter in sync with textarea scrolling.
  const handleScroll = useCallback(() => {
    if (gutterRef.current && inputRef.current) {
      gutterRef.current.scrollTop = inputRef.current.scrollTop;
    }
  }, []);

  const statusNode = useMemo(() => {
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
  }, [validation]);

  return (
    <div className={styles.container}>
      <ToolHeader
        title="JSON Formatter"
        subtitle="Format, validate, minify and escape JSON — entirely offline."
        number="05"
      />

      <div className={styles.toolbar}>
        <button
          className={`${styles.actionBtn} ${styles.primary}`}
          onClick={handleFormat}
          disabled={!hasInput}
        >
          Format
        </button>
        <button className={styles.actionBtn} onClick={handleMinify} disabled={!hasInput}>
          Minify
        </button>
        <button className={styles.actionBtn} onClick={handleEscape} disabled={!hasInput}>
          Escape
        </button>
        <button className={styles.actionBtn} onClick={handleUnescape} disabled={!hasInput}>
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
            <div className={styles.lineNumbers} ref={gutterRef} aria-hidden>
              {Array.from({ length: lineCount }, (_, i) => (
                <span key={i} className={i + 1 === errorLine ? styles.errorLine : undefined}>
                  {i + 1}
                </span>
              ))}
            </div>
            <textarea
              ref={inputRef}
              className={styles.textarea}
              value={input}
              onChange={(e) => setInput(e.target.value)}
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
              className={styles.textarea}
              value={output}
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
        “Unescape” unwraps one level of string encoding.
      </p>
    </div>
  );
}

export default JsonFormatter;
