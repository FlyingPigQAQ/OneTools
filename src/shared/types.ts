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
 * Markdown → PDF conversion. A separate tool from the audio tools: it renders a
 * Markdown document to a styled PDF via Electron's bundled Chromium
 * (`webContents.printToPDF`), so no external binary (ffmpeg) is involved.
 */
export type PdfPageSize = 'A4' | 'Letter' | 'Legal';
export type PdfOrientation = 'portrait' | 'landscape';
export type PdfMargin = 'normal' | 'narrow' | 'none';
export type MarkdownTheme = 'light' | 'sepia' | 'dark';

export interface MarkdownPdfOptions {
  pageSize: PdfPageSize;
  orientation: PdfOrientation;
  margin: PdfMargin;
  /** Visual theme applied to the rendered HTML before printing. */
  theme: MarkdownTheme;
  outputDir: string;
}

export interface MarkdownPdfJob {
  id: string;
  inputPath: string;
  fileName: string;
  options: MarkdownPdfOptions;
  status: 'pending' | 'converting' | 'completed' | 'error' | 'cancelled';
  progress: number;
  error?: string;
}

/**
 * Voice Recorder tool. Records audio from the default microphone via FFmpeg
 * (avfoundation on macOS) and saves as MP3. Recording runs in the main process
 * so it survives tool switches in the renderer.
 */
export interface RecordingOptions {
  outputDir: string;
  /** Output format extension (e.g. 'mp3'). */
  format: string;
}

export interface RecordingState {
  isRecording: boolean;
  /** Date.now() timestamp when recording started. */
  startTime?: number;
  /** Elapsed seconds since recording started. */
  elapsedSec: number;
  /** Output file name (set once recording stops). */
  outputFileName?: string;
  /** Unique job identifier. */
  jobId?: string;
}

export interface RecordingTickData {
  jobId: string;
  elapsedSec: number;
}

export interface RecordingResult {
  jobId: string;
  filePath: string;
  fileName: string;
  /** Duration in seconds. */
  duration: number;
}

export interface CompletedRecording {
  id: string;
  filePath: string;
  fileName: string;
  /** Duration in seconds. */
  duration: number;
  /** ISO-8601 timestamp of when the recording was created. */
  createdAt: string;
}

/**
 * The renderer-facing API exposed by the preload script via contextBridge.
 * This is the single source of truth for the IPC contract; preload imports
 * it and the renderer consumes it via `window.electronAPI`.
 */
export interface ElectronAPI {
  // File dialogs
  /** `kind` selects the open-dialog filter set; defaults to 'audio'. */
  selectInputFiles(kind?: 'audio' | 'markdown'): Promise<string[]>;
  selectOutputDir(): Promise<string | null>;

  // Resolve the real on-disk path for a File object received via drag-and-drop.
  getPathForFile(file: File): string;

  // Conversion
  startConversion(job: ConversionJob): Promise<string>;
  cancelConversion(jobId: string): Promise<boolean>;

  // Splitting (separate tool)
  startSplit(job: SplitJob): Promise<string>;
  cancelSplit(jobId: string): Promise<boolean>;

  // Markdown → PDF (separate tool)
  startMarkdownPdf(job: MarkdownPdfJob): Promise<string>;
  cancelMarkdownPdf(jobId: string): Promise<boolean>;

  // Event listeners (shared progress channel; complete/error carry jobId).
  onConversionProgress(callback: (data: ProgressData) => void): () => void;
  onConversionComplete(callback: (data: ConversionResult) => void): () => void;
  onConversionError(callback: (data: ConversionResult) => void): () => void;
  onSplitComplete(callback: (data: ConversionResult) => void): () => void;
  onSplitError(callback: (data: ConversionResult) => void): () => void;
  onMarkdownPdfProgress(callback: (data: ProgressData) => void): () => void;
  onMarkdownPdfComplete(callback: (data: ConversionResult) => void): () => void;
  onMarkdownPdfError(callback: (data: ConversionResult) => void): () => void;

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

  // Voice Recorder (separate tool)
  startRecording(options: RecordingOptions): Promise<string>;
  stopRecording(): Promise<RecordingResult>;
  getRecordingState(): Promise<RecordingState>;
  deleteRecording(filePath: string): Promise<boolean>;
  readAudioFile(filePath: string): Promise<Uint8Array>;
  onRecordingTick(callback: (data: RecordingTickData) => void): () => void;
  onRecordingStopped(callback: (data: RecordingResult) => void): () => void;
  onRecordingError(callback: (data: { jobId: string; error: string }) => void): () => void;
}
