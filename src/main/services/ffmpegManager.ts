import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { existsSync } from 'fs';
import { chmod } from 'fs/promises';
import { getFfmpegBinaryPath } from '../utils/paths';
import { getFfmpegArchCandidates, getProcessArch } from '../utils/platform';
import type { FFmpegStatus } from '@shared/types';

const execFileAsync = promisify(execFile);

class FFmpegManager {
  private resolvedPath: string | null = null;

  async resolveBinary(): Promise<string | null> {
    if (this.resolvedPath) return this.resolvedPath;

    // Try the bundled binary first. On macOS the binary is stored per
    // architecture; the candidate list handles Rosetta and the universal build,
    // where resources/ffmpeg holds both arm64/ and x64/.
    for (const arch of getFfmpegArchCandidates(getProcessArch())) {
      const bundledPath = join(getFfmpegBinaryPath(), arch, 'ffmpeg');

      if (!existsSync(bundledPath)) continue;

      try {
        await chmod(bundledPath, 0o755);
        await execFileAsync(bundledPath, ['-version']);
        this.resolvedPath = bundledPath;
        return bundledPath;
      } catch {
        // Bundled binary doesn't work, try the next candidate
      }
    }

    // Try system ffmpeg in PATH
    try {
      await execFileAsync('ffmpeg', ['-version']);
      this.resolvedPath = 'ffmpeg';
      return 'ffmpeg';
    } catch {
      // Not available in PATH
    }

    return null;
  }

  getPath(): string | null {
    return this.resolvedPath;
  }

  async checkStatus(): Promise<FFmpegStatus> {
    const path = await this.resolveBinary();
    if (!path) {
      return { available: false, error: 'FFmpeg not found. Please ensure FFmpeg is installed.' };
    }

    try {
      const { stdout } = await execFileAsync(path, ['-version']);
      const version = stdout.split('\n')[0];
      return { available: true, path, version };
    } catch (error) {
      return {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error checking FFmpeg',
      };
    }
  }

  async getVersion(): Promise<string | null> {
    const path = await this.resolveBinary();
    if (!path) return null;

    try {
      const { stdout } = await execFileAsync(path, ['-version']);
      return stdout.split('\n')[0];
    } catch {
      return null;
    }
  }

  spawn(args: string[]): ReturnType<typeof spawn> {
    const path = this.getPath();
    if (!path) {
      throw new Error('FFmpeg binary not resolved');
    }
    return spawn(path, args);
  }
}

export const ffmpegManager = new FFmpegManager();
