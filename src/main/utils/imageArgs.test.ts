import { describe, expect, it } from 'vitest';
import type { ImageProcessOptions, WatermarkOptions } from '@shared/types';
import {
  buildImageArgs,
  buildTextWatermarkFilter,
  qualityToJpgQscale,
  watermarkXY,
} from './imageArgs';

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

describe('qualityToJpgQscale', () => {
  it('maps the 1–100 slider onto MJPEG’s 2–31 scale, inverted', () => {
    expect(qualityToJpgQscale(100)).toBe(2);
    expect(qualityToJpgQscale(1)).toBe(31);
    expect(qualityToJpgQscale(85)).toBeLessThan(qualityToJpgQscale(50));
  });

  it('stays inside the encoder’s range for out-of-bounds input', () => {
    expect(qualityToJpgQscale(0)).toBeGreaterThanOrEqual(2);
    expect(qualityToJpgQscale(999)).toBeLessThanOrEqual(31);
  });
});

describe('watermarkXY', () => {
  it('anchors with overlay variables (w/h) by default', () => {
    expect(watermarkXY('bottom-right', 20)).toEqual({ x: 'W-w-20', y: 'H-h-20' });
    expect(watermarkXY('top-left', 10)).toEqual({ x: '10', y: '10' });
    expect(watermarkXY('center', 0)).toEqual({ x: '(W-w)/2', y: '(H-h)/2' });
  });

  it('uses drawtext’s text variables (tw/th) for text watermarks', () => {
    expect(watermarkXY('bottom-right', 20, true)).toEqual({ x: 'W-tw-20', y: 'H-th-20' });
    expect(watermarkXY('center', 0, true)).toEqual({ x: '(W-tw)/2', y: '(H-th)/2' });
  });

  it('never emits filtergraph-special characters', () => {
    for (const position of [
      'top-left',
      'top-center',
      'top-right',
      'center-left',
      'center',
      'center-right',
      'bottom-left',
      'bottom-center',
      'bottom-right',
    ] as const) {
      for (const forText of [true, false]) {
        const { x, y } = watermarkXY(position, 12, forText);
        expect(x + y).not.toMatch(/[,;:[\]'\\]/);
      }
    }
  });

  it('clamps negative margins to zero', () => {
    expect(watermarkXY('top-left', -5)).toEqual({ x: '0', y: '0' });
  });
});

describe('buildTextWatermarkFilter', () => {
  const ctx = { fontFile: '/System/Library/Fonts/PingFang.ttc', textFile: '/tmp/wm.txt' };

  it('builds a drawtext filter that bypasses text escaping', () => {
    const filter = buildTextWatermarkFilter(watermark({ mode: 'text', text: '© OneTools' }), ctx);
    expect(filter).toContain('textfile=/tmp/wm.txt');
    expect(filter).toContain('expansion=none');
    expect(filter).toContain('fontfile=/System/Library/Fonts/PingFang.ttc');
    // The raw text must never appear in the filtergraph.
    expect(filter).not.toContain('OneTools');
  });

  it('normalizes #rrggbb to 0xrrggbb', () => {
    const filter = buildTextWatermarkFilter(
      watermark({ mode: 'text', text: 'hi', color: '#ff3b30' }),
      ctx
    );
    expect(filter).toContain('fontcolor=0xff3b30');
  });

  it('returns null without text, without a font, or for other modes', () => {
    expect(buildTextWatermarkFilter(watermark({ mode: 'text', text: '   ' }), ctx)).toBeNull();
    expect(buildTextWatermarkFilter(watermark({ mode: 'text', text: 'hi' }), {})).toBeNull();
    expect(buildTextWatermarkFilter(watermark({ mode: 'image', imagePath: '/x.png' }), ctx)).toBeNull();
  });
});

describe('buildImageArgs', () => {
  const input = '/in/photo.png';
  const output = '/out/photo.jpg';

  it('is a plain re-encode when there is nothing to resize or stamp', () => {
    const args = buildImageArgs(input, output, options());
    expect(args.slice(0, 5)).toEqual(['-y', '-nostats', '-progress', 'pipe:1', '-i']);
    expect(args).not.toContain('-vf');
    expect(args).not.toContain('-filter_complex');
    expect(args.slice(-5)).toEqual(['-frames:v', '1', '-update', '1', output]);
  });

  it('downscales within a square box without upscaling', () => {
    const args = buildImageArgs(input, output, options({ maxEdge: 1920 }));
    const vf = args[args.indexOf('-vf') + 1];
    expect(vf).toContain("scale=w='min(iw,1920)':h='min(ih,1920)':force_original_aspect_ratio=decrease");
  });

  it('encodes per resolved format, not per option chip', () => {
    const jpg = buildImageArgs('/in/photo.gif', '/out/photo.jpg', options({ format: 'auto', quality: 100 }));
    expect(jpg).toContain('mjpeg');
    expect(jpg[jpg.indexOf('-q:v') + 1]).toBe('2');

    const webp = buildImageArgs('/in/photo.jpg', '/out/photo.webp', options({ format: 'webp', quality: 60 }));
    expect(webp).toContain('libwebp');
    expect(webp[webp.indexOf('-quality') + 1]).toBe('60');

    const png = buildImageArgs('/in/photo.jpg', '/out/photo.png', options({ format: 'png' }));
    expect(png).toContain('png');
    expect(png).not.toContain('-q:v');
  });

  it('draws a text watermark through -vf', () => {
    const args = buildImageArgs(
      input,
      output,
      options({ watermark: watermark({ mode: 'text', text: '© 2026' }) }),
      { fontFile: '/System/Library/Fonts/PingFang.ttc', textFile: '/tmp/wm.txt' }
    );
    const vf = args[args.indexOf('-vf') + 1];
    expect(vf).toContain('drawtext=');
    expect(args).not.toContain('-filter_complex');
  });

  it('skips an empty text watermark instead of spawning a broken filter', () => {
    const args = buildImageArgs(
      input,
      output,
      options({ watermark: watermark({ mode: 'text', text: '  ' }) }),
      { fontFile: '/f.ttf', textFile: '/tmp/wm.txt' }
    );
    expect(args).not.toContain('-vf');
  });

  it('adds a second input and a filter_complex for a logo watermark', () => {
    const args = buildImageArgs(
      input,
      output,
      options({ watermark: watermark({ mode: 'image', imagePath: '/in/logo.png' }) }),
      { logoPath: '/in/logo.png', logoWidth: 320 }
    );

    expect(args.filter((a) => a === '-i')).toHaveLength(2);
    expect(args).toContain('-filter_complex');
    const graph = args[args.indexOf('-filter_complex') + 1];
    expect(graph).toContain('scale=w=320:h=-1');
    expect(graph).toContain('[wm]overlay=x=W-w-20:y=H-h-20[out]');
    expect(args[args.indexOf('-map') + 1]).toBe('[out]');
    // No resize in the base chain → the graph starts straight from [0:v].
    expect(graph.startsWith('[1:v]')).toBe(true);
  });

  it('keeps the resize in the base chain when both resize and logo are set', () => {
    const args = buildImageArgs(
      input,
      output,
      options({
        maxEdge: 800,
        watermark: watermark({ mode: 'image', imagePath: '/in/logo.png', opacity: 0.5 }),
      }),
      { logoPath: '/in/logo.png', logoWidth: 200 }
    );
    const graph = args[args.indexOf('-filter_complex') + 1];
    expect(graph).toContain('[0:v]scale=w=\'min(iw,800)');
    expect(graph).toContain('colorchannelmixer=aa=0.5');
    expect(graph.indexOf('[base]')).toBeLessThan(graph.indexOf('[wm]overlay'));
  });

  it('falls back to scaling the logo relative to itself when width is unknown', () => {
    const args = buildImageArgs(
      input,
      output,
      options({ watermark: watermark({ mode: 'image', imagePath: '/in/logo.png', scale: 0.4 }) }),
      { logoPath: '/in/logo.png' }
    );
    const graph = args[args.indexOf('-filter_complex') + 1];
    expect(graph).toContain("scale=w='iw*0.4':h=-1");
  });

  it('skips the opacity mixer when the watermark is fully opaque', () => {
    const args = buildImageArgs(
      input,
      output,
      options({ watermark: watermark({ mode: 'image', imagePath: '/in/logo.png' }) }),
      { logoPath: '/in/logo.png', logoWidth: 100 }
    );
    expect(args[args.indexOf('-filter_complex') + 1]).not.toContain('colorchannelmixer');
  });
});
