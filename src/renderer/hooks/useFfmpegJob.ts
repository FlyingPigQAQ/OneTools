import { useCallback, useEffect, useRef, useState } from 'react';
import type { BaseJob, JobStoreApi } from '../store/jobStore';
import type { ConversionResult, ProgressData } from '@shared/types';

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

export interface FfmpegJobEvents {
  onProgress: (callback: (data: ProgressData) => void) => () => void;
  onComplete: (callback: (data: ConversionResult) => void) => () => void;
  onError: (callback: (data: ConversionResult) => void) => () => void;
}

export interface FfmpegJobConfig<TJob extends BaseJob & { options: unknown }> {
  /** The tool's zustand job store (from `createJobStore`). */
  useStore: JobStoreApi<TJob>;
  /** Prefix for generated job ids, e.g. 'job' or 'split'. */
  idPrefix: string;
  /** Start the ffmpeg job in the main process. */
  startJob: (job: TJob) => Promise<unknown>;
  /** Cancel a running job in the main process. */
  cancelJob: (jobId: string) => Promise<unknown>;
  /** Main → renderer event subscriptions for this tool's channels. */
  events: FfmpegJobEvents;
  /** Label used in generic error fallbacks, e.g. 'Conversion' or 'Split'. */
  errorLabel: string;
  /** 'parallel' pools pending jobs (converter); 'sequential' runs one at a time (splitter). */
  execution: 'parallel' | 'sequential';
  /** De-duplicate dropped files against already-queued inputs. */
  dedupeInputs?: boolean;
  /** Build a job from a dropped/picked file path. */
  createJob: (inputPath: string, options: TJob['options'], id: string) => TJob;
}

/**
 * Shared lifecycle for ffmpeg-backed tools: FFmpeg availability check,
 * progress/complete/error event wiring, queueing files, running pending
 * jobs, retry, cancel, and reveal-in-Finder. Tool hooks wrap this with
 * their own IPC channels, store, and option builders.
 */
export function useFfmpegJob<TJob extends BaseJob & { options: unknown }>(
  config: FfmpegJobConfig<TJob>
) {
  const [isRunning, setIsRunning] = useState(false);
  const [ffmpegReady, setFfmpegReady] = useState<boolean | null>(null);
  const idCounterRef = useRef(0);
  // Keep the latest config in a ref so the one-time effect subscriptions
  // always dispatch to the current store/actions.
  const configRef = useRef(config);
  configRef.current = config;

  const jobs = config.useStore((s) => s.jobs);
  const addJobs = config.useStore((s) => s.addJobs);
  const updateJobStatus = config.useStore((s) => s.updateJobStatus);
  const removeJob = config.useStore((s) => s.removeJob);

  useEffect(() => {
    window.electronAPI.checkFFmpeg().then((status) => {
      setFfmpegReady(status.available);
    });

    const { events, useStore } = configRef.current;
    const removeProgress = events.onProgress((data) => {
      useStore.getState().updateJobStatus(data.jobId, 'converting', data.progress);
    });
    const removeComplete = events.onComplete((data) => {
      useStore.getState().updateJobStatus(data.jobId, 'completed', 100);
    });
    const removeError = events.onError((data) => {
      useStore.getState().updateJobStatus(data.jobId, 'error', undefined, data.error);
    });

    return () => {
      removeProgress();
      removeComplete();
      removeError();
    };
  }, []);

  const addFiles = useCallback(
    async (filePaths: string[], options: TJob['options']) => {
      let paths = filePaths;
      if (configRef.current.dedupeInputs) {
        const existing = new Set(configRef.current.useStore.getState().jobs.map((j) => j.inputPath));
        paths = filePaths.filter((p) => !existing.has(p));
      }

      const newJobs = paths.map((path) =>
        configRef.current.createJob(path, options, `${config.idPrefix}-${++idCounterRef.current}`)
      );
      addJobs(newJobs);
      return newJobs;
    },
    [addJobs, config.idPrefix]
  );

  const start = useCallback(
    async (options?: TJob['options']) => {
      const store = configRef.current.useStore.getState();
      let pending = store.jobs.filter((j) => j.status === 'pending');
      if (pending.length === 0) return;

      setIsRunning(true);

      if (options) {
        for (const job of pending) {
          store.updateJobOptions(job.id, options);
        }
        pending = pending.map((j) => ({ ...j, options }));
      }

      const runJob = async (job: TJob) => {
        updateJobStatus(job.id, 'converting', 0);
        try {
          await configRef.current.startJob(job);
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : `${configRef.current.errorLabel} failed`;
          updateJobStatus(job.id, 'error', undefined, errorMsg);
        }
      };

      if (config.execution === 'parallel') {
        await runWithConcurrency(pending, MAX_CONCURRENCY, runJob);
      } else {
        for (const job of pending) {
          await runJob(job);
        }
      }

      setIsRunning(false);
    },
    [config.execution, updateJobStatus]
  );

  /** Retry a single failed/cancelled job by resetting it and re-running. */
  const retryJob = useCallback(
    async (jobId: string) => {
      const job = configRef.current.useStore.getState().jobs.find((j) => j.id === jobId);
      if (!job) return;
      setIsRunning(true);
      updateJobStatus(jobId, 'converting', 0);
      try {
        await configRef.current.startJob({ ...job, status: 'pending', progress: 0 });
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : `${configRef.current.errorLabel} failed`;
        updateJobStatus(jobId, 'error', undefined, errorMsg);
      }
      setIsRunning(false);
    },
    [updateJobStatus]
  );

  const cancelJob = useCallback(
    async (jobId: string) => {
      await configRef.current.cancelJob(jobId);
      updateJobStatus(jobId, 'cancelled');
    },
    [updateJobStatus]
  );

  /** Reveal a job's output directory (or its input's folder) in Finder. */
  const revealInFinder = useCallback(async (jobId: string) => {
    const job = configRef.current.useStore.getState().jobs.find((j) => j.id === jobId);
    if (!job) return;
    const options = job.options as { outputDir?: string };
    const dir = options.outputDir || job.inputPath.substring(0, job.inputPath.lastIndexOf('/'));
    if (dir) {
      await window.electronAPI.revealInFinder(dir);
    }
  }, []);

  return {
    jobs,
    isRunning,
    ffmpegReady,
    addFiles,
    start,
    retryJob,
    cancelJob,
    removeJob,
    revealInFinder,
  };
}
