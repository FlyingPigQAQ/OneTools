import type { AppError, Locale } from '@shared/i18n';
import type { ImageFormatChoice } from '@shared/imageFormats';

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
  error?: AppError;
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
  error?: AppError;
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
  error?: AppError;
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
  outputPath?: string;
  fileName: string;
  options: MarkdownPdfOptions;
  status: 'pending' | 'converting' | 'completed' | 'error' | 'cancelled';
  progress: number;
  error?: AppError;
}

/**
 * Image processing tool (compress + watermark in one pass). A separate tool
 * from the audio tools: it shrinks images (resize + quality) and optionally
 * stamps a text or logo watermark, both applied in a single ffmpeg run.
 */
export type WatermarkMode = 'none' | 'text' | 'image';

/** Nine anchor points, shared by the text and logo watermark. */
export type WatermarkPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export interface WatermarkOptions {
  mode: WatermarkMode;
  /** Text content (mode === 'text'). */
  text: string;
  /** Logo file path (mode === 'image'). */
  imagePath: string;
  /** Logo width as a fraction of the base image width (mode === 'image'). */
  scale: number;
  /** Font size in px (mode === 'text'). */
  fontSize: number;
  /** '#rrggbb' (mode === 'text'). */
  color: string;
  position: WatermarkPosition;
  /** Distance from the anchored edge, in px. */
  margin: number;
  /** 0–1. */
  opacity: number;
}

export interface ImageProcessOptions {
  /** 'auto' keeps the input format; see `resolveImageFormat`. */
  format: ImageFormatChoice;
  /** 1–100. Honored by JPG/WebP; PNG is lossless and ignores it. */
  quality: number;
  /** Fit inside this square box (px) preserving aspect. 0 = keep original size. */
  maxEdge: number;
  watermark: WatermarkOptions;
  outputDir: string;
}

export interface ImageJob {
  id: string;
  inputPath: string;
  outputPath?: string;
  fileName: string;
  options: ImageProcessOptions;
  status: 'pending' | 'converting' | 'completed' | 'error' | 'cancelled';
  progress: number;
  error?: AppError;
  /** Byte sizes captured on completion, used for the "before → after" delta. */
  inputSize?: number;
  outputSize?: number;
}

/** Completion payload of one image job; adds the size delta to ConversionResult. */
export interface ImageResult extends ConversionResult {
  inputSize?: number;
  outputSize?: number;
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

export type RecordingStartResult =
  | { ok: true; jobId: string }
  | { ok: false; error: AppError };

export type RecordingStopResult =
  | { ok: true; result: RecordingResult }
  | { ok: false; error: AppError };

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
  // Locale. The initial value is read synchronously in preload before first paint.
  getInitialLocale(): Locale;
  setLocale(locale: Locale): Promise<Locale>;
  onLocaleChanged(callback: (locale: Locale) => void): () => void;

  // File dialogs
  /** `kind` selects the open-dialog filter set; defaults to 'audio'. */
  selectInputFiles(kind?: 'audio' | 'markdown' | 'image'): Promise<string[]>;
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

  // Image processing (separate tool)
  startImageJob(job: ImageJob): Promise<string>;
  cancelImageJob(jobId: string): Promise<boolean>;

  // Event listeners (shared progress channel; complete/error carry jobId).
  onConversionProgress(callback: (data: ProgressData) => void): () => void;
  onConversionComplete(callback: (data: ConversionResult) => void): () => void;
  onConversionError(callback: (data: ConversionResult) => void): () => void;
  onSplitComplete(callback: (data: ConversionResult) => void): () => void;
  onSplitError(callback: (data: ConversionResult) => void): () => void;
  onMarkdownPdfProgress(callback: (data: ProgressData) => void): () => void;
  onMarkdownPdfComplete(callback: (data: ConversionResult) => void): () => void;
  onMarkdownPdfError(callback: (data: ConversionResult) => void): () => void;
  onImageProgress(callback: (data: ProgressData) => void): () => void;
  onImageComplete(callback: (data: ImageResult) => void): () => void;
  onImageError(callback: (data: ConversionResult) => void): () => void;

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
  startRecording(options: RecordingOptions): Promise<RecordingStartResult>;
  stopRecording(): Promise<RecordingStopResult>;
  getRecordingState(): Promise<RecordingState>;
  deleteRecording(filePath: string): Promise<boolean>;
  readAudioFile(filePath: string): Promise<Uint8Array<ArrayBuffer>>;
  onRecordingTick(callback: (data: RecordingTickData) => void): () => void;
  onRecordingStopped(callback: (data: RecordingResult) => void): () => void;
  onRecordingError(callback: (data: { jobId: string; error: AppError }) => void): () => void;
}
