import { join } from 'path';
import { existsSync } from 'fs';

/**
 * Resolve an output path that doesn't collide with an existing file. If
 * `dir/baseName.ext` exists, tries `baseName (1).ext`, `(2)`, etc.
 *
 * Pure of Electron/ffmpeg concerns — only touches the filesystem via
 * `existsSync`, so it can be unit-tested directly.
 */
export function resolveUniqueOutputPath(dir: string, baseName: string, ext: string): string {
  const candidate = join(dir, `${baseName}.${ext}`);
  if (!existsSync(candidate)) return candidate;
  for (let i = 1; i < 1000; i++) {
    const next = join(dir, `${baseName} (${i}).${ext}`);
    if (!existsSync(next)) return next;
  }
  return candidate;
}
