import { unlinkSync } from 'fs';

/**
 * Best-effort delete of a file we own (a freshly created output, a temp file).
 * Missing files and permission problems are not errors here — the caller is
 * cleaning up after a cancel or a failure and must not throw.
 */
export function removeQuietly(filePath: string | undefined): void {
  if (!filePath) return;
  try {
    unlinkSync(filePath);
  } catch {
    /* already gone, or not removable — nothing to do */
  }
}
