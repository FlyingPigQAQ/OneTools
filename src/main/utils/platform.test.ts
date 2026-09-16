import { describe, expect, it } from 'vitest';
import { getFfmpegArchCandidates } from './platform';

describe('getFfmpegArchCandidates', () => {
  it('prefers the running process architecture', () => {
    expect(getFfmpegArchCandidates('arm64')[0]).toBe('arm64');
    expect(getFfmpegArchCandidates('x64')[0]).toBe('x64');
  });

  it('falls back to the other macOS architecture (Rosetta / universal build)', () => {
    expect(getFfmpegArchCandidates('arm64')).toEqual(['arm64', 'x64']);
    expect(getFfprobeFallback('x64')).toEqual(['x64', 'arm64']);
  });

  it('only reports the exact name for unknown architectures', () => {
    expect(getFfmpegArchCandidates('ia32')).toEqual(['ia32']);
    expect(getFfmpegArchCandidates('')).toEqual(['']);
  });

  it('returns a fresh array so callers cannot mutate shared state', () => {
    const a = getFfmpegArchCandidates('arm64');
    a.push('mutated');
    expect(getFfmpegArchCandidates('arm64')).toEqual(['arm64', 'x64']);
  });
});

// local alias to keep the expectation above readable
function getFfprobeFallback(arch: string): string[] {
  return getFfmpegArchCandidates(arch);
}
