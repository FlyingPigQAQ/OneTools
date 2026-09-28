/**
 * Image formats shared by the renderer (drag-and-drop filtering, format chips)
 * and the main process (open-dialog filters, ffmpeg encoder selection). Kept in
 * `shared` so both sides agree on which extensions count as image input and on
 * what "keep the original format" means.
 */
export const IMAGE_INPUT_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'tif', 'tiff'];

/** Encoders the image tool can actually write. */
export type ImageOutputFormat = 'jpg' | 'png' | 'webp';

/** 'auto' keeps the input's format (falling back to JPG for formats we don't write). */
export type ImageFormatChoice = 'auto' | ImageOutputFormat;

export const IMAGE_FORMAT_CHOICES: ImageFormatChoice[] = ['auto', 'jpg', 'png', 'webp'];

/**
 * Resolve the format chip choice against a concrete input file. PNG/WebP round-trip
 * losslessly; everything else (jpg, gif, bmp, tiff, …) becomes JPG — we don't write
 * those containers, and JPG is the format users reach for when shrinking images.
 */
export function resolveImageFormat(inputPath: string, choice: ImageFormatChoice): ImageOutputFormat {
  if (choice !== 'auto') return choice;
  const ext = inputPath.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'png':
      return 'png';
    case 'webp':
      return 'webp';
    case 'jpg':
    case 'jpeg':
      return 'jpg';
    default:
      return 'jpg';
  }
}
