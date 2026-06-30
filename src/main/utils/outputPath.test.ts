import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { resolveUniqueOutputPath } from './outputPath';

describe('resolveUniqueOutputPath', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'onetools-out-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns the plain path when nothing collides', () => {
    const out = resolveUniqueOutputPath(dir, 'track', 'mp3');
    expect(out).toBe(join(dir, 'track.mp3'));
  });

  it('appends (1) when the base name already exists', () => {
    writeFileSync(join(dir, 'track.mp3'), 'x');
    const out = resolveUniqueOutputPath(dir, 'track', 'mp3');
    expect(out).toBe(join(dir, 'track (1).mp3'));
  });

  it('counts up past existing (1), (2), … to the first free slot', () => {
    writeFileSync(join(dir, 'track.mp3'), 'x');
    writeFileSync(join(dir, 'track (1).mp3'), 'x');
    writeFileSync(join(dir, 'track (2).mp3'), 'x');
    const out = resolveUniqueOutputPath(dir, 'track', 'mp3');
    expect(out).toBe(join(dir, 'track (3).mp3'));
  });

  it('treats different extensions as independent namespaces', () => {
    writeFileSync(join(dir, 'track.mp3'), 'x');
    // A .flac output should not be displaced by an existing .mp3 of the same base name.
    const out = resolveUniqueOutputPath(dir, 'track', 'flac');
    expect(out).toBe(join(dir, 'track.flac'));
  });

  it('preserves spaces in the base name', () => {
    const out = resolveUniqueOutputPath(dir, 'my song', 'm4a');
    expect(out).toBe(join(dir, 'my song.m4a'));
  });
});
