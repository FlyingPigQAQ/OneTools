import { resolveImageFormat, type ImageOutputFormat } from '@shared/imageFormats';
import type { ImageProcessOptions, WatermarkOptions, WatermarkPosition } from '@shared/types';

/**
 * Everything `buildImageArgs` needs that it cannot derive from the job alone:
 * paths resolved by the caller (font, temp text file, logo) plus the probed
 * logo target width. Kept as a parameter so the builder stays pure and
 * unit-testable — no filesystem, no Electron, no ffmpeg.
 */
export interface ImageArgsContext {
  /** Font file used for the text watermark (resolved from system fonts). */
  fontFile?: string;
  /** UTF-8 file holding the watermark text (sidesteps all filtergraph escaping). */
  textFile?: string;
  /** Logo image path (image watermark). Its presence switches to a filter_complex. */
  logoPath?: string;
  /** Logo target width in px. When absent the logo is scaled relative to itself. */
  logoWidth?: number;
}

/**
 * Map the 1–100 quality slider onto MJPEG's quantizer scale (2 = best, 31 = worst).
 * WebP takes the slider value verbatim; PNG is lossless and ignores quality.
 */
export function qualityToJpgQscale(quality: number): number {
  const q = Math.round(31 - (Math.min(100, Math.max(1, quality)) / 100) * 29);
  return Math.min(31, Math.max(2, q));
}

/**
 * Anchor expressions for the nine watermark positions.
 *
 * `forText` switches between the two variable vocabularies: `overlay` measures
 * the watermark with `w`/`h`, while `drawtext` uses `w`/`h` for the *input*
 * image and `tw`/`th` for the rendered text. Getting this wrong silently
 * centres the text in the top-left corner.
 *
 * `W`/`H` (input size) and `w`/`h` or `tw`/`th` (watermark size) are the only
 * identifiers used, so the result never contains filtergraph-special characters.
 */
export function watermarkXY(
  position: WatermarkPosition,
  margin: number,
  forText = false
): { x: string; y: string } {
  const m = Math.max(0, Math.round(margin));
  const w = forText ? 'tw' : 'w';
  const h = forText ? 'th' : 'h';
  switch (position) {
    case 'top-left':
      return { x: `${m}`, y: `${m}` };
    case 'top-center':
      return { x: `(W-${w})/2`, y: `${m}` };
    case 'top-right':
      return { x: `W-${w}-${m}`, y: `${m}` };
    case 'center-left':
      return { x: `${m}`, y: `(H-${h})/2` };
    case 'center':
      return { x: `(W-${w})/2`, y: `(H-${h})/2` };
    case 'center-right':
      return { x: `W-${w}-${m}`, y: `(H-${h})/2` };
    case 'bottom-left':
      return { x: `${m}`, y: `H-${h}-${m}` };
    case 'bottom-center':
      return { x: `(W-${w})/2`, y: `H-${h}-${m}` };
    case 'bottom-right':
      return { x: `W-${w}-${m}`, y: `H-${h}-${m}` };
  }
}

/**
 * `drawtext` filter for a text watermark.
 *
 * The text itself is never inlined: it lives in `textFile` and is read with
 * `expansion=none`, so quotes, colons, commas and `%` in user text need no
 * escaping at all. Returns null when there is nothing to draw.
 */
export function buildTextWatermarkFilter(
  watermark: WatermarkOptions,
  ctx: ImageArgsContext
): string | null {
  if (watermark.mode !== 'text') return null;
  if (!watermark.text.trim()) return null;
  if (!ctx.fontFile || !ctx.textFile) return null;

  const { x, y } = watermarkXY(watermark.position, watermark.margin, true);
  const color = watermark.color.replace(/^#/, '0x');
  const opacity = clamp(watermark.opacity, 0, 1);

  return (
    `drawtext=fontfile=${ctx.fontFile}:textfile=${ctx.textFile}:expansion=none` +
    `:fontcolor=${color}:fontsize=${Math.round(watermark.fontSize)}:alpha=${opacity}` +
    `:x=${x}:y=${y}`
  );
}

/**
 * The full ffmpeg argument list for one image job.
 *
 * Chain order: resize → watermark → encode. The watermark decides the graph
 * shape: no watermark (or text) stays a simple `-vf` chain, a logo needs a
 * second input and therefore `-filter_complex` + an explicit `-map`.
 */
export function buildImageArgs(
  inputPath: string,
  outputPath: string,
  options: ImageProcessOptions,
  ctx: ImageArgsContext = {}
): string[] {
  const watermark = options.watermark;
  const useLogo = watermark.mode === 'image' && !!ctx.logoPath;

  const args = ['-y', '-nostats', '-progress', 'pipe:1', '-i', inputPath];
  if (useLogo) args.push('-i', ctx.logoPath as string);

  // Base chain: optional downscale, then an optional text watermark.
  const chain: string[] = [];
  const maxEdge = Math.round(options.maxEdge || 0);
  if (maxEdge > 0) {
    chain.push(
      `scale=w='min(iw,${maxEdge})':h='min(ih,${maxEdge})':force_original_aspect_ratio=decrease`
    );
  }
  const textFilter = buildTextWatermarkFilter(watermark, ctx);
  if (textFilter) chain.push(textFilter);

  if (useLogo) {
    const logoChain = [
      // Prefer the probed pixel width (stable across differently sized inputs);
      // otherwise fall back to a fraction of the logo's own width.
      ctx.logoWidth ? `scale=w=${Math.round(ctx.logoWidth)}:h=-1` : `scale=w='iw*${watermark.scale}':h=-1`,
    ];
    const opacity = clamp(watermark.opacity, 0, 1);
    if (opacity < 1) {
      logoChain.push('format=rgba', `colorchannelmixer=aa=${opacity}`);
    }
    const { x, y } = watermarkXY(watermark.position, watermark.margin);
    const parts: string[] = [];
    if (chain.length) parts.push(`[0:v]${chain.join(',')}[base]`);
    parts.push(`[1:v]${logoChain.join(',')}[wm]`);
    parts.push(`${chain.length ? '[base]' : '[0:v]'}[wm]overlay=x=${x}:y=${y}[out]`);
    args.push('-filter_complex', parts.join(';'), '-map', '[out]');
  } else if (chain.length) {
    args.push('-vf', chain.join(','));
  }

  appendEncoderArgs(args, resolveImageFormat(inputPath, options.format), options.quality);

  // `-update 1` keeps image2 from warning about a missing sequence pattern.
  args.push('-frames:v', '1', '-update', '1', outputPath);
  return args;
}

/** Encoder args for the resolved output format. */
export function appendEncoderArgs(
  args: string[],
  format: ImageOutputFormat,
  quality: number
): void {
  switch (format) {
    case 'jpg':
      // yuvj420p: the only full-range format MJPEG accepts; also the smallest.
      args.push('-c:v', 'mjpeg', '-q:v', String(qualityToJpgQscale(quality)), '-pix_fmt', 'yuvj420p');
      break;
    case 'png':
      args.push('-c:v', 'png');
      break;
    case 'webp':
      args.push('-c:v', 'libwebp', '-quality', String(Math.round(clamp(quality, 1, 100))));
      break;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
