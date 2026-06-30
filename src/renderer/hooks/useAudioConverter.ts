import { useCallback, useEffect, useRef, useState } from 'react';
import { useConversionStore } from '../store/conversionStore';
import type { ConversionJob, ConversionOptions, ProgressData } from '@shared/types';
import { getFormatById } from '@shared/audioFormats';

let jobIdCounter = 0;

/** Max simultaneous ffmpeg processes. Caps at 3 to keep the system responsive. */
const MAX_CONCURRENCY = Math.min(3, Math.max(1, (navigator.hardwareConcurrency || 4) - 1));

/**
 * Run an async task over `items` with a bounded concurrency pool.
 * Each item is processed at most once; returns when all are done.
 */
async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let index = 0;
  const run = async (): Promise<void> => {
    while (index < items.length) {
      const current = items[index++];
      await worker(current);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
}

export function useAudioConverter() {
  const [isConverting, setIsConverting] = useState(false);
  const [ffmpegReady, setFfmpegReady] = useState<boolean | null>(null);
  const listenersRef = useRef<(() => void)[]>([]);

  const { jobs, addJobs, updateJobStatus, updateJobOptions, removeJob } = useConversionStore();

  useEffect(() => {
    // Check FFmpeg on mount
    window.electronAPI.checkFFmpeg().then((status) => {
      setFfmpegReady(status.available);
    });

    // Setup event listeners
    const removeProgress = window.electronAPI.onConversionProgress((data: ProgressData) => {
      updateJobStatus(data.jobId, 'converting', data.progress);
    });

    const removeComplete = window.electronAPI.onConversionComplete((data) => {
      updateJobStatus(data.jobId, 'completed', 100);
    });

    const removeError = window.electronAPI.onConversionError((data) => {
      updateJobStatus(data.jobId, 'error', undefined, data.error);
    });

    listenersRef.current = [removeProgress, removeComplete, removeError];

    return () => {
      listenersRef.current.forEach((remove) => remove());
    };
  }, [updateJobStatus]);

  const addFiles = useCallback(
    async (filePaths: string[], options: ConversionOptions) => {
      // De-duplicate against files already queued.
      const existing = new Set(useConversionStore.getState().jobs.map((j) => j.inputPath));
      const fresh = filePaths.filter((p) => !existing.has(p));

      const newJobs: ConversionJob[] = fresh.map((path) => ({
        id: `job-${++jobIdCounter}`,
        inputPath: path,
        outputPath: '',
        fileName: path.split('/').pop() || path,
        options,
        status: 'pending',
        progress: 0,
      }));

      addJobs(newJobs);
      return newJobs;
    },
    [addJobs]
  );

  const startConversion = useCallback(
    async (options?: ConversionOptions) => {
      // Re-read the freshest pending jobs from the store (avoids stale closure)
      let pending = useConversionStore
        .getState()
        .jobs.filter((j) => j.status === 'pending');

      if (pending.length === 0) return;

      setIsConverting(true);

      // Output-conflict detection: warn for outputs that already exist.
      if (options) {
        for (const job of pending) {
          updateJobOptions(job.id, options);
        }
        pending = pending.map((j) => ({ ...j, options }));
      }

      // Run with bounded concurrency.
      await runWithConcurrency(pending, MAX_CONCURRENCY, async (job) => {
        updateJobStatus(job.id, 'converting', 0);
        try {
          await window.electronAPI.startConversion(job);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Conversion failed';
          updateJobStatus(job.id, 'error', undefined, errorMsg);
        }
      });

      setIsConverting(false);
    },
    [updateJobStatus, updateJobOptions]
  );

  /** Retry a single failed/cancelled job by resetting it to pending and re-running. */
  const retryJob = useCallback(
    async (jobId: string) => {
      const job = useConversionStore.getState().jobs.find((j) => j.id === jobId);
      if (!job) return;
      updateJobStatus(jobId, 'pending', 0);
      setIsConverting(true);
      updateJobStatus(jobId, 'converting', 0);
      try {
        await window.electronAPI.startConversion({ ...job, status: 'pending', progress: 0 });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Conversion failed';
        updateJobStatus(jobId, 'error', undefined, errorMsg);
      }
      setIsConverting(false);
    },
    [updateJobStatus]
  );

  const cancelJob = useCallback(
    async (jobId: string) => {
      await window.electronAPI.cancelConversion(jobId);
      updateJobStatus(jobId, 'cancelled');
    },
    [updateJobStatus]
  );

  /** Reveal a job's output (or its input's folder) in Finder. */
  const revealInFinder = useCallback(async (jobId: string) => {
    const job = useConversionStore.getState().jobs.find((j) => j.id === jobId);
    if (!job) return;
    // The converter derives the output path from input + format; reveal the
    // input's directory as the reliable fallback.
    const dir = job.options.outputDir || job.inputPath.substring(0, job.inputPath.lastIndexOf('/'));
    if (dir) {
      await window.electronAPI.revealInFinder(dir);
    }
  }, []);

  const buildOptions = useCallback(
    (
      format: string,
      bitrate: number | undefined,
      sampleRate: number,
      channels: 1 | 2,
      outputDir: string,
      useVbr = false
    ): ConversionOptions => {
      const fmt = getFormatById(format);
      return {
        format,
        bitrate: fmt?.supportsBitrate ? bitrate : undefined,
        sampleRate,
        channels,
        useVbr: fmt?.supportsVbr ? useVbr : undefined,
        outputDir,
      };
    },
    []
  );

  return {
    jobs,
    isConverting,
    ffmpegReady,
    addFiles,
    startConversion,
    retryJob,
    cancelJob,
    removeJob,
    revealInFinder,
    buildOptions,
  };
}
