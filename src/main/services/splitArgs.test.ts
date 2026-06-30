import { describe, it, expect } from 'vitest';
import {
  buildSegmentArgs,
  expectedSegmentCount,
  partFileName,
  sizeToSegmentDuration,
  SIZE_SAFETY_MARGIN,
} from './splitArgs';

describe('buildSegmentArgs', () => {
  it('seeks with -ss before input, copies with -t and -c copy', () => {
    const args = buildSegmentArgs('/in.mp3', '/out_part000.mp3', 12.5, 30);
    expect(args.indexOf('-ss')).toBeLessThan(args.indexOf('-i'));
    expect(args[args.indexOf('-ss') + 1]).toBe('12.500');
    expect(args[args.indexOf('-i') + 1]).toBe('/in.mp3');
    expect(args[args.indexOf('-t') + 1]).toBe('30.000');
    expect(args).toContain('-c');
    expect(args[args.indexOf('-c') + 1]).toBe('copy');
    expect(args[args.length - 1]).toBe('/out_part000.mp3');
  });

  it('zeroes the seek time for the first segment', () => {
    const args = buildSegmentArgs('/in.mp3', '/out.mp3', 0, 10);
    expect(args[args.indexOf('-ss') + 1]).toBe('0.000');
  });

  it('always uses stream copy (never re-encodes)', () => {
    const args = buildSegmentArgs('/in.flac', '/out.flac', 5, 5);
    expect(args).toContain('copy');
    expect(args).not.toContain('libmp3lame');
    expect(args).not.toContain('aac');
  });
});

describe('partFileName', () => {
  it('zero-pads the index to 3 digits', () => {
    expect(partFileName('track', 0, 'mp3')).toBe('track_part000.mp3');
    expect(partFileName('track', 7, 'mp3')).toBe('track_part007.mp3');
    expect(partFileName('track', 42, 'm4a')).toBe('track_part042.m4a');
  });

  it('keeps 3 digits for indices ≥ 100', () => {
    expect(partFileName('track', 123, 'flac')).toBe('track_part123.flac');
  });
});

describe('expectedSegmentCount', () => {
  it('is ceil(total / segDur)', () => {
    expect(expectedSegmentCount(100, 30)).toBe(4); // 30+30+30+10
    expect(expectedSegmentCount(100, 25)).toBe(4);
    expect(expectedSegmentCount(60, 60)).toBe(1);
    expect(expectedSegmentCount(61, 60)).toBe(2);
  });

  it('returns at least 1 for a clean fit', () => {
    expect(expectedSegmentCount(30, 30)).toBe(1);
  });

  it('returns 0 for non-positive inputs', () => {
    expect(expectedSegmentCount(0, 30)).toBe(0);
    expect(expectedSegmentCount(100, 0)).toBe(0);
    expect(expectedSegmentCount(-5, 30)).toBe(0);
  });
});

describe('sizeToSegmentDuration', () => {
  it('divides target bytes by byte-density, applying the safety margin', () => {
    // 10 MB target, 200_000 bytes/sec → 10*1024*1024*0.9 / 200000 ≈ 471.86s
    const dur = sizeToSegmentDuration(10, 200_000);
    const expected = (10 * 1024 * 1024 * SIZE_SAFETY_MARGIN) / 200_000;
    expect(dur).toBeCloseTo(expected, 5);
    expect(dur).toBeLessThan((10 * 1024 * 1024) / 200_000); // margin shrinks it
  });

  it('returns 0 when byte-density is unusable', () => {
    expect(sizeToSegmentDuration(10, 0)).toBe(0);
    expect(sizeToSegmentDuration(10, -1)).toBe(0);
  });

  it('returns 0 when the target size is non-positive', () => {
    expect(sizeToSegmentDuration(0, 200_000)).toBe(0);
    expect(sizeToSegmentDuration(-5, 200_000)).toBe(0);
  });

  it('the safety margin keeps segments under the requested size', () => {
    // A 1 MB target at 1 MB/s would be exactly 1s without the margin; with it,
    // the segment duration (and thus the stream-copied file size) shrinks.
    const dur = sizeToSegmentDuration(1, 1024 * 1024);
    expect(dur).toBeLessThan(1);
    expect(dur).toBeCloseTo(SIZE_SAFETY_MARGIN, 5);
  });
});
