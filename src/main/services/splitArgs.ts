/**
 * Safety margin applied to size-based splitting. Stream copy (`-c copy`) can
 * only cut on keyframe/packet boundaries, so a segment overshoots its
 * requested end time — and the byte-density estimate is itself an average.
 * Scaling the target down by this factor keeps output files at or under the
 * requested size instead of consistently over it.
 */
export const SIZE_SAFETY_MARGIN = 0.9;

/** Bytes in one megabyte — extracted so size-mode tests don't repeat the magic number. */
export const BYTES_PER_MB = 1024 * 1024;

/**
 * Convert a target size (MB) into a per-segment duration in seconds, given the
 * source file's average byte density. Applies the {@link SIZE_SAFETY_MARGIN}
 * so stream-copy segments stay at or under the requested size.
 *
 * Returns 0 when the inputs are unusable (the caller treats 0 as "give up").
 */
export function sizeToSegmentDuration(sizeMB: number, bytesPerSec: number): number {
  const targetBytes = sizeMB * BYTES_PER_MB * SIZE_SAFETY_MARGIN;
  if (!bytesPerSec || bytesPerSec <= 0 || targetBytes <= 0) return 0;
  return targetBytes / bytesPerSec;
}

/** Number of segments a split will produce: ceil(total / segDur), min 1. */
export function expectedSegmentCount(totalDuration: number, segDur: number): number {
  if (!totalDuration || totalDuration <= 0 || !segDur || segDur <= 0) return 0;
  return Math.max(1, Math.ceil(totalDuration / segDur));
}

/**
 * Args for one split segment: fast input-seek to `start`, then copy `dur`
 * seconds. Uses `-c copy` to avoid re-encoding — splitting preserves the
 * source codec.
 */
export function buildSegmentArgs(inputPath: string, outputPath: string, startSec: number, durSec: number): string[] {
  return [
    '-y', '-nostats', '-progress', 'pipe:1',
    '-ss', startSec.toFixed(3),
    '-i', inputPath,
    '-t', durSec.toFixed(3),
    '-c', 'copy',
    outputPath,
  ];
}

/**
 * Zero-padded part filename: `<baseName>_partNNN.<ext>` (NNN = 3 digits).
 * Extracted so the naming convention is unit-tested in one place.
 */
export function partFileName(baseName: string, index: number, ext: string): string {
  return `${baseName}_part${String(index).padStart(3, '0')}.${ext}`;
}
