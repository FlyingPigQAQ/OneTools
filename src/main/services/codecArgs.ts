import type { ConversionOptions } from '@shared/types';
import { getFormatById } from '@shared/audioFormats';

/**
 * Build the full ffmpeg argument list for one conversion: global options,
 * input, codec args, then the output path.
 *
 * Extracted from `AudioConverter` so the codec-mapping logic is unit-testable
 * without spawning ffmpeg or importing Electron.
 */
export function buildFfmpegArgs(inputPath: string, outputPath: string, options: ConversionOptions): string[] {
  // Global options first: overwrite, suppress stats, machine-readable progress on stdout
  const args = ['-y', '-nostats', '-progress', 'pipe:1', '-i', inputPath];
  appendCodecArgs(args, options);
  args.push(outputPath);
  return args;
}

/**
 * Append the codec + audio-parameter args for the chosen format onto `args`.
 * Mirrors the per-format switch documented in CLAUDE.md — lossless formats
 * (flac/wav/m4a-alac) ignore bitrate; Opus honors a VBR toggle.
 */
export function appendCodecArgs(args: string[], options: ConversionOptions): void {
  const format = getFormatById(options.format);
  if (!format) return;

  switch (options.format) {
    case 'mp3':
      args.push('-c:a', 'libmp3lame');
      if (options.bitrate) args.push('-b:a', `${options.bitrate}k`);
      break;
    case 'aac':
      args.push('-c:a', 'aac');
      if (options.bitrate) args.push('-b:a', `${options.bitrate}k`);
      break;
    case 'flac':
      args.push('-c:a', 'flac');
      break;
    case 'wav':
      args.push('-c:a', 'pcm_s16le');
      break;
    case 'ogg':
      args.push('-c:a', 'libvorbis');
      if (options.bitrate) args.push('-b:a', `${options.bitrate}k`);
      break;
    case 'opus':
      args.push('-c:a', 'libopus');
      if (options.useVbr) {
        args.push('-vbr', 'on');
      }
      if (options.bitrate) args.push('-b:a', `${options.bitrate}k`);
      break;
    case 'm4a':
      args.push('-c:a', 'alac');
      break;
  }

  if (options.sampleRate) {
    args.push('-ar', `${options.sampleRate}`);
  }
  if (options.channels) {
    args.push('-ac', `${options.channels}`);
  }
}
