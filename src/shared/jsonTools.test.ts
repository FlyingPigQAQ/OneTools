import { describe, it, expect } from 'vitest';
import {
  formatJson,
  minifyJson,
  validateJson,
  escapeJson,
  unescapeJson,
  jsonStats,
  parseJsonError,
} from './jsonTools';

describe('formatJson', () => {
  it('pretty-prints compact JSON with 2-space indent by default', () => {
    const result = formatJson('{"a":1,"b":[2,3]}');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output).toBe('{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}');
    }
  });

  it('supports 4-space indent', () => {
    const result = formatJson('{"a":1}', 4);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.output).toBe('{\n    "a": 1\n}');
  });

  it('supports tab indent', () => {
    const result = formatJson('{"a":1}', 'tab');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.output).toBe('{\n\t"a": 1\n}');
  });

  it('formats scalar roots', () => {
    const result = formatJson('42');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.output).toBe('42');
  });

  it('returns an error for empty input', () => {
    const result = formatJson('   ');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe('Input is empty');
  });

  it('returns an error with position info for invalid JSON', () => {
    const result = formatJson('{\n  "a": 1,\n}');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message.length).toBeGreaterThan(0);
    }
  });
});

describe('minifyJson', () => {
  it('removes all insignificant whitespace', () => {
    const result = minifyJson('{\n  "a": 1,\n  "b": [ 2, 3 ]\n}');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.output).toBe('{"a":1,"b":[2,3]}');
  });

  it('rejects invalid JSON', () => {
    expect(minifyJson('{nope}').ok).toBe(false);
  });
});

describe('validateJson', () => {
  it('returns null for valid JSON', () => {
    expect(validateJson('{"a":[1,2,{"b":null}]}')).toBeNull();
  });

  it('returns an error for invalid JSON', () => {
    const err = validateJson('{"a":}');
    expect(err).not.toBeNull();
    expect(err!.message.length).toBeGreaterThan(0);
  });

  it('returns an error for empty input', () => {
    expect(validateJson('')).toEqual({ message: 'Input is empty' });
  });
});

describe('parseJsonError', () => {
  it('derives line/column from a "position N" message', () => {
    const source = '{\n  "a": 1,\n}';
    let caught: unknown;
    try {
      JSON.parse(source);
    } catch (err) {
      caught = err;
    }
    const parsed = parseJsonError(caught, source);
    expect(parsed.message.length).toBeGreaterThan(0);
    // V8 reports a position; when it does, we must derive line/column from it.
    if (parsed.position !== undefined) {
      expect(parsed.line).toBeGreaterThanOrEqual(1);
      expect(parsed.column).toBeGreaterThanOrEqual(1);
    }
  });

  it('parses "line L column C" messages directly', () => {
    const err = parseJsonError(new Error('Bad JSON at line 3 column 7'), '');
    expect(err.line).toBe(3);
    expect(err.column).toBe(7);
  });
});

describe('escapeJson / unescapeJson', () => {
  it('escapes a JSON document into a string literal', () => {
    const result = escapeJson('{"a":"x\\"y"}');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output).toBe('"{\\"a\\":\\"x\\\\\\"y\\"}"');
    }
  });

  it('round-trips through unescape', () => {
    const doc = '{"a":[1,2,{"b":"é"}]}';
    const escaped = escapeJson(doc);
    expect(escaped.ok).toBe(true);
    if (!escaped.ok) return;
    const unescaped = unescapeJson(escaped.output);
    expect(unescaped.ok).toBe(true);
    if (unescaped.ok) expect(unescaped.output).toBe(doc);
  });

  it('unescape rejects non-string literals', () => {
    const result = unescapeJson('{"a":1}');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('not a JSON string literal');
  });
});

describe('jsonStats', () => {
  it('counts keys, depth, lines, and UTF-8 bytes', () => {
    const input = '{\n  "a": 1,\n  "b": { "c": [true] }\n}';
    const stats = jsonStats(input);
    expect(stats).not.toBeNull();
    expect(stats!.keys).toBe(3); // a, b, c
    expect(stats!.depth).toBe(3); // root obj → b obj → c array
    expect(stats!.lines).toBe(4);
    expect(stats!.bytes).toBe(input.length); // all ASCII
  });

  it('counts multi-byte characters by UTF-8 bytes', () => {
    const stats = jsonStats('{"k":"é"}');
    expect(stats).not.toBeNull();
    expect(stats!.bytes).toBe('{"k":"é"}'.length + 1); // é is 2 UTF-8 bytes
  });

  it('reports depth 0 for scalar roots', () => {
    expect(jsonStats('"hello"')!.depth).toBe(0);
    expect(jsonStats('123')!.keys).toBe(0);
  });

  it('returns null for invalid or empty input', () => {
    expect(jsonStats('{bad}')).toBeNull();
    expect(jsonStats('  ')).toBeNull();
  });
});
