import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import type { ImageProcessOptions, WatermarkOptions } from '@shared/types';
import { buildImageArgs } from './imageArgs';
import { LATIN_FONT_CANDIDATES, resolveFontFile } from './fonts';

const BIN_DIR = resolve(__dirname, '../../../resources/ffmpeg', process.arch);
const FFMPEG = join(BIN_DIR, 'ffmpeg');
const FFPROBE = join(BIN_DIR, 'ffprobe');
const HAS_FFMPEG = existsSync(FFMPEG) && existsSync(FFPROBE);

let dir: string;
let base: string;
let logo: string;
let textFile: string;

function watermark(overrides: Partial<WatermarkOptions> = {}): WatermarkOptions {
  return {
    mode: 'none',
    text: '',
    imagePath: '',
    scale: 0.25,
    fontSize: 48,
    color: '#ffffff',
    position: 'bottom-right',
    margin: 20,
    opacity: 1,
    ...overrides,
  };
}

function options(overrides: Partial<ImageProcessOptions> = {}): ImageProcessOptions {
  return {
    format: 'auto',
    quality: 85,
    maxEdge: 0,
    watermark: watermark(),
    outputDir: '',
    ...overrides,
  };
}

function run(args: string[]): { code: number; stderr: string } {
  const res = spawnSync(FFMPEG, args, { encoding: 'utf8' });
  return { code: res.status ?? -1, stderr: res.stderr || '' };
}

function probeSize(file: string): string {
  const res = spawnSync(FFPROBE, [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=width,height',
    '-of',
    'csv=p=0',
    file,
  ], { encoding: 'utf8' });
  return String(res.stdout ?? '').trim();
}

/** Decode an image to raw RGB24 so placement can be asserted on pixels. */
function pixels(file: string): Buffer {
  const res = spawnSync(
    FFMPEG,
    ['-hide_banner', '-loglevel', 'error', '-y', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
    { maxBuffer: 1 << 28 }
  );
  return res.stdout as Buffer;
}

/** Average RGB of a `w×h` box at (x, y) of an 800×600 RGB24 image. */
function avgAt(buf: Buffer, x: number, y: number, w: number, h: number) {
  const W = 800;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let row = y; row < y + h; row++) {
    for (let col = x; col < x + w; col++) {
      const i = (row * W + col) * 3;
      r += buf[i];
      g += buf[i + 1];
      b += buf[i + 2];
      n++;
    }
  }
  return { r: r / n, g: g / n, b: b / n };
}

describe.skipIf(!HAS_FFMPEG)('buildImageArgs (runs the real ffmpeg)', () => {
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'onetools-image-'));
    base = join(dir, 'base.png');
    logo = join(dir, 'logo.png');
    textFile = join(dir, 'wm.txt');

    run([
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', 'color=c=0x1b3a6b:s=800x600',
      '-frames:v', '1', '-update', '1', base,
    ]);
    run([
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', 'color=c=0xff2d55:s=200x120',
      '-frames:v', '1', '-update', '1', logo,
    ]);
    writeFileSync(textFile, '版权力所 © 2026', 'utf8');
    expect(existsSync(base)).toBe(true);
    expect(existsSync(logo)).toBe(true);
  });

  afterAll(() => {
    // Temp fixtures only; leave cleanup to the OS temp sweeper.
  });

  it('resizes and encodes to JPG', () => {
    const out = join(dir, 'out1.jpg');
    const res = run(buildImageArgs(base, out, options({ maxEdge: 320, quality: 85 })));
    expect(res.stderr).not.toMatch(/Error|Invalid|No such filter|Unrecognized|Cannot|not found/i);
    expect(res.code).toBe(0);
    expect(existsSync(out)).toBe(true);
    expect(probeSize(out)).toBe('320,240');
  });

  it('stamps a CJK text watermark and writes WebP', () => {
    const fontFile = resolveFontFile();
    expect(fontFile).toBeDefined();
    const out = join(dir, 'out2.webp');
    const res = run(
      buildImageArgs(
        base,
        out,
        options({ format: 'webp', quality: 70, watermark: watermark({ mode: 'text', text: '版权力所 © 2026' }) }),
        { fontFile: fontFile as string, textFile }
      )
    );
    expect(res.code).toBe(0);
    expect(existsSync(out)).toBe(true);
    expect(probeSize(out)).toBe('800,600');

    // White text anchored bottom-right with margin 20 → the bottom band must
    // contain bright glyphs and the top band must stay pure background.
    const buf = pixels(out);
    const brightRows = (y0: number, y1: number) => {
      let count = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = 0; x < 800; x++) {
          const i = (y * 800 + x) * 3;
          const lum = 0.3 * buf[i] + 0.6 * buf[i + 1] + 0.1 * buf[i + 2];
          if (lum > 200) count++;
        }
      }
      return count;
    };
    expect(brightRows(530, 595)).toBeGreaterThan(50);
    expect(brightRows(0, 100)).toBe(0);
  });

  it('renders real Chinese glyphs, not tofu boxes', () => {
    // A Latin-only font draws `?`-marked boxes for Chinese, and the pixel
    // assertions above cannot tell those from real glyphs. Render the same
    // text with the resolved font and with a Latin-only font: the outputs
    // must differ, which fails if the candidate list ever puts a Latin-only
    // font ahead of a CJK one (the PingFang → Helvetica regression).
    const fontFile = resolveFontFile();
    const latinFont = LATIN_FONT_CANDIDATES.find((p) => existsSync(p));
    if (!fontFile || !latinFont) return; // environment cannot express the check
    const opts = options({
      watermark: watermark({ mode: 'text', text: '版权力所 © 2026' }),
    });
    const withCjk = join(dir, 'cjk-glyphs.png');
    const withLatin = join(dir, 'cjk-tofu.png');
    expect(run(buildImageArgs(base, withCjk, opts, { fontFile, textFile })).code).toBe(0);
    expect(run(buildImageArgs(base, withLatin, opts, { fontFile: latinFont, textFile })).code).toBe(0);
    expect(pixels(withCjk).equals(pixels(withLatin))).toBe(false);
  });

  it('stamps a logo watermark through filter_complex', () => {
    const out = join(dir, 'out3.png');
    const res = run(
      buildImageArgs(
        base,
        out,
        options({ watermark: watermark({ mode: 'image', imagePath: logo, opacity: 0.6 }) }),
        { logoPath: logo, logoWidth: 200 }
      )
    );
    expect(res.code).toBe(0);
    expect(existsSync(out)).toBe(true);
    expect(probeSize(out)).toBe('800,600');

    // 200px logo, margin 20 → occupies x 580..780, y 460..580 (60% opacity red
    // over the blue base), and must not touch the opposite corner.
    const buf = pixels(out);
    const inside = avgAt(buf, 650, 500, 40, 40);
    expect(inside.r).toBeGreaterThan(140);
    const corner = avgAt(buf, 40, 40, 40, 40);
    expect(corner.r).toBeLessThan(60);
    expect(corner.b).toBeGreaterThan(80);
  });

  it('combines resize + logo watermark', () => {
    const out = join(dir, 'out4.jpg');
    const res = run(
      buildImageArgs(
        base,
        out,
        options({ maxEdge: 400, watermark: watermark({ mode: 'image', imagePath: logo }) }),
        { logoPath: logo, logoWidth: 100 }
      )
    );
    expect(res.code).toBe(0);
    expect(probeSize(out)).toBe('400,300');
  });

  it('keeps PNG output lossless', () => {
    const out = join(dir, 'out5.png');
    const res = run(buildImageArgs(base, out, options({ format: 'png' })));
    expect(res.code).toBe(0);
    expect(probeSize(out)).toBe('800,600');
  });

  it('fails cleanly on a missing input', () => {
    const out = join(dir, 'out6.jpg');
    const res = run(buildImageArgs(join(dir, 'missing.png'), out, options()));
    expect(res.code).not.toBe(0);
    expect(existsSync(out)).toBe(false);
  });
});
