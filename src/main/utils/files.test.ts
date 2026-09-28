import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, existsSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { removeQuietly } from './files';

describe('removeQuietly', () => {
  it('deletes an existing file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'onetools-files-'));
    try {
      const file = join(dir, 'out.mp3');
      writeFileSync(file, 'x');
      removeQuietly(file);
      expect(existsSync(file)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('ignores a missing file, an empty path and undefined', () => {
    expect(() => removeQuietly(join(tmpdir(), 'definitely-not-here.mp3'))).not.toThrow();
    expect(() => removeQuietly('')).not.toThrow();
    expect(() => removeQuietly(undefined)).not.toThrow();
  });
});
