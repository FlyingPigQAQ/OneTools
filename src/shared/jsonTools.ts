/**
 * Pure, Electron-free JSON utilities for the JSON Formatter tool.
 * Everything here is renderer-safe (no Node APIs) so it can also be unit-tested
 * by Vitest without a DOM.
 */

export type IndentOption = 2 | 4 | 'tab';

export interface JsonValidationError {
  message: string;
  line?: number;
  column?: number;
  /** Character offset into the source text, when it could be determined. */
  position?: number;
}

export type JsonResult =
  | { ok: true; output: string }
  | { ok: false; error: JsonValidationError };

export interface JsonStats {
  /** UTF-8 byte length. */
  bytes: number;
  lines: number;
  keys: number;
  /** Maximum object/array nesting depth (a scalar root is 0). */
  depth: number;
}

/** Extract line/column from a native `JSON.parse` error message, when present. */
export function parseJsonError(err: unknown, source: string): JsonValidationError {
  const message = err instanceof Error ? err.message : String(err);

  // V8/Chromium: "... at position 123" or "... at line 2 column 3"
  let position: number | undefined;
  let line: number | undefined;
  let column: number | undefined;

  const lineCol = message.match(/line (\d+) column (\d+)/i);
  if (lineCol) {
    line = Number(lineCol[1]);
    column = Number(lineCol[2]);
  } else {
    const pos = message.match(/position (\d+)/i);
    if (pos) {
      position = Number(pos[1]);
      let l = 1;
      let lastNl = -1;
      for (let i = 0; i < position && i < source.length; i++) {
        if (source.charCodeAt(i) === 10) {
          l++;
          lastNl = i;
        }
      }
      line = l;
      column = position - lastNl;
    }
  }

  return { message, line, column, position };
}

/** Parse and re-serialize with the given indent. */
export function formatJson(input: string, indent: IndentOption = 2): JsonResult {
  if (input.trim() === '') {
    return { ok: false, error: { message: 'Input is empty' } };
  }
  try {
    const value = JSON.parse(input);
    return { ok: true, output: JSON.stringify(value, null, indent === 'tab' ? '\t' : indent) };
  } catch (err) {
    return { ok: false, error: parseJsonError(err, input) };
  }
}

/** Parse and re-serialize with no whitespace. */
export function minifyJson(input: string): JsonResult {
  if (input.trim() === '') {
    return { ok: false, error: { message: 'Input is empty' } };
  }
  try {
    const value = JSON.parse(input);
    return { ok: true, output: JSON.stringify(value) };
  } catch (err) {
    return { ok: false, error: parseJsonError(err, input) };
  }
}

/** Validate only — returns null when the input is valid JSON. */
export function validateJson(input: string): JsonValidationError | null {
  if (input.trim() === '') {
    return { message: 'Input is empty' };
  }
  try {
    JSON.parse(input);
    return null;
  } catch (err) {
    return parseJsonError(err, input);
  }
}

/** Escape a parsed value into a JSON string literal (double-encoded). */
export function escapeJson(input: string): JsonResult {
  if (input.trim() === '') {
    return { ok: false, error: { message: 'Input is empty' } };
  }
  try {
    const value = JSON.parse(input);
    // Re-serialize minified, then wrap in a string literal so the result can be
    // pasted into another JSON document as a string value.
    return { ok: true, output: JSON.stringify(JSON.stringify(value)) };
  } catch (err) {
    return { ok: false, error: parseJsonError(err, input) };
  }
}

/** Unwrap one level of string encoding. Input must be a JSON string literal. */
export function unescapeJson(input: string): JsonResult {
  if (input.trim() === '') {
    return { ok: false, error: { message: 'Input is empty' } };
  }
  try {
    const value: unknown = JSON.parse(input);
    if (typeof value !== 'string') {
      return {
        ok: false,
        error: { message: 'Input is not a JSON string literal — nothing to unescape' },
      };
    }
    return { ok: true, output: value };
  } catch (err) {
    return { ok: false, error: parseJsonError(err, input) };
  }
}

function walk(value: unknown, depth: number, acc: { keys: number; depth: number }): void {
  if (depth > acc.depth) acc.depth = depth;
  if (Array.isArray(value)) {
    for (const item of value) walk(item, depth + 1, acc);
  } else if (value !== null && typeof value === 'object') {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      acc.keys++;
      walk((value as Record<string, unknown>)[key], depth + 1, acc);
    }
  }
}

/** Document statistics for valid JSON. Returns null when the input is invalid. */
export function jsonStats(input: string): JsonStats | null {
  if (input.trim() === '') return null;
  let value: unknown;
  try {
    value = JSON.parse(input);
  } catch {
    return null;
  }
  const acc = { keys: 0, depth: 0 };
  walk(value, 0, acc);
  return {
    bytes: new TextEncoder().encode(input).length,
    lines: input === '' ? 0 : input.split('\n').length,
    keys: acc.keys,
    depth: acc.depth,
  };
}
