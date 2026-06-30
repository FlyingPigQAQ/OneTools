export interface PlatformInfo {
  platform: string;
  arch: string;
}

export interface FFmpegStatus {
  available: boolean;
  path?: string;
  version?: string;
  error?: string;
}

export interface AudioFormat {
  id: string;
  name: string;
  extension: string;
  mimeType: string;
  defaultBitrate?: number;
  defaultSampleRate: number;
  defaultChannels: 1 | 2;
  supportsBitrate: boolean;
  supportsVbr: boolean;
}

export interface ConversionOptions {
  format: string;
  bitrate?: number;
  sampleRate: number;
  channels: 1 | 2;
  useVbr?: boolean;
  outputDir: string;
}

export interface ConversionJob {
  id: string;
  inputPath: string;
  outputPath: string;
  fileName: string;
  duration?: number;
  options: ConversionOptions;
  status: 'pending' | 'converting' | 'completed' | 'error' | 'cancelled';
  progress: number;
  error?: string;
}

export interface ProgressData {
  jobId: string;
  progress: number;
  speed?: string;
  eta?: string;
}

export interface ConversionResult {
  jobId: string;
  success: boolean;
  outputPath?: string;
  error?: string;
}

/**
 * Audio splitting options. Splitting is a separate tool from conversion:
 * it cuts an audio file into multiple parts by a target size or duration,
 * without changing the format.
 */
export type SplitMode = 'size' | 'duration';

export interface SplitOptions {
  /** 'size' splits by target MB per file; 'duration' splits by seconds per file. */
  mode: SplitMode;
  /** Target size in MB (used when mode === 'size'). */
  sizeMB?: number;
  /** Target duration in seconds (used when mode === 'duration'). */
  durationSec?: number;
  outputDir: string;
}

export interface SplitJob {
  id: string;
  inputPath: string;
  fileName: string;
  duration?: number;
  options: SplitOptions;
  status: 'pending' | 'converting' | 'completed' | 'error' | 'cancelled';
  progress: number;
  error?: string;
}

export interface ToolDefinition {
  id: string;
  name: string;
  icon: string;
  description: string;
}

/**
 * The renderer-facing API exposed by the preload script via contextBridge.
 * This is the single source of truth for the IPC contract; preload imports
 * it and the renderer consumes it via `window.electronAPI`.
 */
export interface ElectronAPI {
  // File dialogs
  selectInputFiles(): Promise<string[]>;
  selectOutputDir(): Promise<string | null>;

  // Resolve the real on-disk path for a File object received via drag-and-drop.
  getPathForFile(file: File): string;

  // Conversion
  startConversion(job: ConversionJob): Promise<string>;
  cancelConversion(jobId: string): Promise<boolean>;

  // Splitting (separate tool)
  startSplit(job: SplitJob): Promise<string>;
  cancelSplit(jobId: string): Promise<boolean>;

  // Event listeners (shared progress channel; complete/error carry jobId).
  onConversionProgress(callback: (data: ProgressData) => void): () => void;
  onConversionComplete(callback: (data: ConversionResult) => void): () => void;
  onConversionError(callback: (data: ConversionResult) => void): () => void;
  onSplitComplete(callback: (data: ConversionResult) => void): () => void;
  onSplitError(callback: (data: ConversionResult) => void): () => void;

  // App info
  getAppVersion(): Promise<string>;
  getPlatformInfo(): Promise<PlatformInfo>;
  checkFFmpeg(): Promise<FFmpegStatus>;
  getFfmpegVersion(): Promise<string | null>;

  // Filesystem helpers
  /** Highlight a file in Finder (reveals its containing folder). */
  showItemInFolder(fullPath: string): Promise<boolean>;
  /** Open a folder in Finder. */
  revealInFinder(folderPath: string): Promise<boolean>;
  /** Whether a path exists on disk (used for output-conflict detection). */
  fileExists(fullPath: string): Promise<boolean>;

  // Application menu events (main → renderer). The renderer subscribes to
  // these to react to menu/accelerator actions.
  onMenu(channel: string, callback: () => void): void;
  offMenu(channel: string, callback: () => void): void;
}
