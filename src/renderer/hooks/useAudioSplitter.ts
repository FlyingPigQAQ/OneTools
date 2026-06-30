import { useCallback, useEffect, useRef, useState } from 'react';
import { useSplitStore } from '../store/splitStore';
import type { SplitJob, SplitOptions, SplitMode, ProgressData } from '@shared/types';

let jobIdCounter = 0;

export function useAudioSplitter() {
  const [isSplitting, setIsSplitting] = useState(false);
  const [ffmpegReady, setFfmpegReady] = useState<boolean | null>(null);
  const listenersRef = useRef<(() => void)[]>([]);

  const { jobs, addJobs, updateJobStatus, removeJob } = useSplitStore();

  useEffect(() => {
    window.electronAPI.checkFFmpeg().then((status) => {
      setFfmpegReady(status.available);
    });

    const removeProgress = window.electronAPI.onConversionProgress((data: ProgressData) => {
      updateJobStatus(data.jobId, 'converting', data.progress);
    });

    const removeComplete = window.electronAPI.onSplitComplete((data) => {
      updateJobStatus(data.jobId, 'completed', 100);
    });

    const removeError = window.electronAPI.onSplitError((data) => {
      updateJobStatus(data.jobId, 'error', undefined, data.error);
    });

    listenersRef.current = [removeProgress, removeComplete, removeError];

    return () => {
      listenersRef.current.forEach((remove) => remove());
    };
  }, [updateJobStatus]);

  const addFiles = useCallback(
    async (filePaths: string[], options: SplitOptions) => {
      const newJobs: SplitJob[] = filePaths.map((path) => ({
        id: `split-${++jobIdCounter}`,
        inputPath: path,
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

  const startSplit = useCallback(
    async (options?: SplitOptions) => {
      const pending = useSplitStore.getState().jobs.filter((j) => j.status === 'pending');
      if (pending.length === 0) return;

      setIsSplitting(true);

      for (const job of pending) {
        const jobWithOptions = options ? { ...job, options } : job;
        updateJobStatus(job.id, 'converting', 0);
        try {
          await window.electronAPI.startSplit(jobWithOptions);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Split failed';
          updateJobStatus(job.id, 'error', undefined, errorMsg);
        }
      }

      setIsSplitting(false);
    },
    [updateJobStatus]
  );

  const cancelJob = useCallback(
    async (jobId: string) => {
      await window.electronAPI.cancelSplit(jobId);
      updateJobStatus(jobId, 'cancelled');
    },
    [updateJobStatus]
  );

  /** Retry a single failed split job. */
  const retryJob = useCallback(
    async (jobId: string) => {
      const job = useSplitStore.getState().jobs.find((j) => j.id === jobId);
      if (!job) return;
      updateJobStatus(jobId, 'converting', 0);
      setIsSplitting(true);
      try {
        await window.electronAPI.startSplit({ ...job, status: 'pending', progress: 0 });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Split failed';
        updateJobStatus(jobId, 'error', undefined, errorMsg);
      }
      setIsSplitting(false);
    },
    [updateJobStatus]
  );

  /** Reveal a split job's output folder in Finder. */
  const revealInFinder = useCallback(async (jobId: string) => {
    const job = useSplitStore.getState().jobs.find((j) => j.id === jobId);
    if (!job) return;
    const dir = job.options.outputDir || job.inputPath.substring(0, job.inputPath.lastIndexOf('/'));
    if (dir) {
      await window.electronAPI.revealInFinder(dir);
    }
  }, []);

  const buildOptions = useCallback(
    (mode: SplitMode, sizeMB: number, durationSec: number, outputDir: string): SplitOptions => {
      return {
        mode,
        sizeMB: mode === 'size' ? sizeMB : undefined,
        durationSec: mode === 'duration' ? durationSec : undefined,
        outputDir,
      };
    },
    []
  );

  return {
    jobs,
    isSplitting,
    ffmpegReady,
    addFiles,
    startSplit,
    retryJob,
    cancelJob,
    removeJob,
    revealInFinder,
    buildOptions,
  };
}
