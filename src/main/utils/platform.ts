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
