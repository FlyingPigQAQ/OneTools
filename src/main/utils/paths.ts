import { app } from 'electron';
import { join } from 'path';

export function getResourcesPath(): string {
  if (app.isPackaged) {
    return process.resourcesPath;
  }
  // In development, resources are relative to the project root
  return join(process.cwd(), 'resources');
}

export function getFfmpegBinaryPath(): string {
  const resourcesPath = getResourcesPath();
  return join(resourcesPath, 'ffmpeg');
}
