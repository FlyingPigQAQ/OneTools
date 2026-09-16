import { platform, arch } from 'os';
import type { PlatformInfo } from '@shared/types';

export function getPlatformInfo(): PlatformInfo {
  return {
    platform: platform(),
    arch: arch(),
  };
}

export function isMacOS(): boolean {
  return platform() === 'darwin';
}

export function getProcessArch(): 'arm64' | 'x64' | string {
  return arch();
}

/**
 * Candidate sub-directory names of `resources/ffmpeg/<name>/ffmpeg`, in lookup
 * order, for the architecture this process is currently running as.
 *
 * macOS ships ffmpeg per architecture (arm64 / x86_64) because a self-contained
 * static binary is single-arch. `os.arch()` reports the architecture of the
 * *running process*, which is not always where the user's ffmpeg happens to be:
 *
 * - **Rosetta**: an arm64 Mac launches an x64 build (or vice versa) while
 *   `resources/ffmpeg/` only holds the native `arm64` folder.
 * - **Universal build**: electron-builder merges the arm64 and x64 .app bundles
 *   and the result carries *both* `Resources/ffmpeg/arm64/` and `x64/`. Whichever
 *   half `os.arch()` reports is then just as valid as the other.
 *
 * A binary of the other architecture still runs (the OS translates it), so
 * falling back keeps the audio tools working instead of failing with ENOENT.
 * These candidates are derived from `os.arch()`, so the function stays pure.
 */
export function getFfmpegArchCandidates(processArch: string): string[] {
  switch (processArch) {
    case 'arm64':
      return ['arm64', 'x64'];
    case 'x64':
      return ['x64', 'arm64'];
    default:
      // Unknown arch (e.g. tests on Linux): only the exact name can match.
      return [processArch];
  }
}
