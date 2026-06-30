import { describe, it, expect } from 'vitest';
import { buildFfmpegArgs, appendCodecArgs } from './codecArgs';
import type { ConversionOptions } from '@shared/types';

function opts(format: string, overrides: Partial<ConversionOptions> = {}): ConversionOptions {
  return {
    format,
    bitrate: 192,
    sampleRate: 44100,
    channels: 2,
    outputDir: '/out',
    ...overrides,
  };
}

describe('buildFfmpegArgs', () => {
  it('starts with global options and the input, ends with the output', () => {
    const args = buildFfmpegArgs('/in/foo.wav', '/out/foo.mp3', opts('mp3'));
    expect(args.slice(0, 5)).toEqual(['-y', '-nostats', '-progress', 'pipe:1', '-i', '/in/foo.wav'].slice(0, 5));
    expect(args.indexOf('-i')).toBe(4);
    expect(args[args.length - 1]).toBe('/out/foo.mp3');
  });

  it('always includes -i <input> before codec args', () => {
    const args = buildFfmpegArgs('/in.aiff', '/out.flac', opts('flac'));
    const inputIdx = args.indexOf('/in.aiff');
    const codecIdx = args.indexOf('-c:a');
    expect(inputIdx).toBeGreaterThan(-1);
    expect(codecIdx).toBeGreaterThan(inputIdx);
  });
});

describe('appendCodecArgs — per-format codec mapping', () => {
  it('mp3 → libmp3lame with bitrate', () => {
    const args: string[] = [];
    appendCodecArgs(args, opts('mp3', { bitrate: 320 }));
    expect(args).toContain('-c:a');
    expect(args[args.indexOf('-c:a') + 1]).toBe('libmp3lame');
    expect(args).toContain('-b:a');
    expect(args[args.indexOf('-b:a') + 1]).toBe('320k');
  });

  it('aac → aac codec', () => {
    const args: string[] = [];
    appendCodecArgs(args, opts('aac'));
    expect(args[args.indexOf('-c:a') + 1]).toBe('aac');
  });

  it('flac → flac codec and NO bitrate flag', () => {
    const args: string[] = [];
    appendCodecArgs(args, opts('flac'));
    expect(args[args.indexOf('-c:a') + 1]).toBe('flac');
    expect(args).not.toContain('-b:a');
  });

  it('wav → pcm_s16le and NO bitrate flag', () => {
    const args: string[] = [];
    appendCodecArgs(args, opts('wav'));
    expect(args[args.indexOf('-c:a') + 1]).toBe('pcm_s16le');
    expect(args).not.toContain('-b:a');
  });

  it('ogg → libvorbis with bitrate', () => {
    const args: string[] = [];
    appendCodecArgs(args, opts('ogg'));
    expect(args[args.indexOf('-c:a') + 1]).toBe('libvorbis');
    expect(args).toContain('-b:a');
  });

  it('opus → libopus; VBR toggle adds -vbr on', () => {
    const withVbr: string[] = [];
    appendCodecArgs(withVbr, opts('opus', { useVbr: true }));
    expect(withVbr[withVbr.indexOf('-c:a') + 1]).toBe('libopus');
    expect(withVbr).toContain('-vbr');
    expect(withVbr[withVbr.indexOf('-vbr') + 1]).toBe('on');

    const withoutVbr: string[] = [];
    appendCodecArgs(withoutVbr, opts('opus', { useVbr: false }));
    expect(withoutVbr).not.toContain('-vbr');
  });

  it('m4a → alac (lossless) and NO bitrate flag', () => {
    const args: string[] = [];
    appendCodecArgs(args, opts('m4a'));
    expect(args[args.indexOf('-c:a') + 1]).toBe('alac');
    expect(args).not.toContain('-b:a');
  });

  it('omits -b:a when bitrate is unset', () => {
    const args: string[] = [];
    appendCodecArgs(args, opts('mp3', { bitrate: undefined }));
    expect(args).not.toContain('-b:a');
  });

  it('appends sample-rate and channels when provided', () => {
    const args: string[] = [];
    appendCodecArgs(args, opts('mp3', { sampleRate: 48000, channels: 1 }));
    expect(args[args.indexOf('-ar') + 1]).toBe('48000');
    expect(args[args.indexOf('-ac') + 1]).toBe('1');
  });

  it('is a no-op for an unknown format', () => {
    const args: string[] = ['existing'];
    appendCodecArgs(args, opts('definitely-not-a-format'));
    expect(args).toEqual(['existing']);
  });
});
