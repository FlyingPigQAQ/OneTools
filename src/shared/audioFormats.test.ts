import { describe, it, expect } from 'vitest';
import { AUDIO_FORMATS, getFormatById, BITRATE_PRESETS, SAMPLE_RATES } from './audioFormats';

describe('audioFormats', () => {
  it('every format has a unique id', () => {
    // Extensions may repeat across formats (aac and m4a both use .m4a), so we
    // only assert ids are unique — that's the key the codec switch keys on.
    const ids = AUDIO_FORMATS.map(f => f.id);
    expect(new Set(ids).size).toBe(AUDIO_FORMATS.length);
  });

  it('exposes the core set of formats', () => {
    const ids = AUDIO_FORMATS.map(f => f.id);
    for (const id of ['mp3', 'aac', 'flac', 'wav', 'ogg', 'opus', 'm4a']) {
      expect(ids).toContain(id);
    }
  });

  it('lossless formats do not advertise bitrate support', () => {
    const flac = getFormatById('flac')!;
    const wav = getFormatById('wav')!;
    const m4a = getFormatById('m4a')!; // ALAC = lossless
    expect(flac.supportsBitrate).toBe(false);
    expect(wav.supportsBitrate).toBe(false);
    expect(m4a.supportsBitrate).toBe(false);
    expect(flac.defaultBitrate).toBeUndefined();
  });

  it('only Opus advertises VBR support', () => {
    for (const f of AUDIO_FORMATS) {
      expect(f.supportsVbr).toBe(f.id === 'opus');
    }
  });

  it('Opus defaults to 48 kHz; everything else defaults to 44.1 kHz', () => {
    for (const f of AUDIO_FORMATS) {
      if (f.id === 'opus') expect(f.defaultSampleRate).toBe(48000);
      else expect(f.defaultSampleRate).toBe(44100);
    }
  });

  it('getFormatById returns undefined for unknown ids', () => {
    expect(getFormatById('nope')).toBeUndefined();
  });

  it('bitrate presets are sorted ascending and include 192', () => {
    for (let i = 1; i < BITRATE_PRESETS.length; i++) {
      expect(BITRATE_PRESETS[i]).toBeGreaterThan(BITRATE_PRESETS[i - 1]);
    }
    expect(BITRATE_PRESETS).toContain(192);
  });

  it('sample rates are sorted ascending', () => {
    expect(SAMPLE_RATES).toEqual([...SAMPLE_RATES].sort((a, b) => a - b));
  });
});
