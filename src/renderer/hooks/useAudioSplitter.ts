import { useCallback } from 'react';
import { useSplitStore } from '../store/splitStore';
import { useFfmpegJob } from './useFfmpegJob';
import type { SplitJob, SplitOptions, SplitMode } from '@shared/types';

export function useAudioSplitter() {
  const ffmpegJob = useFfmpegJob<SplitJob>({
    useStore: useSplitStore,
    idPrefix: 'split',
    startJob: (job) => window.electronAPI.startSplit(job),
    cancelJob: (jobId) => window.electronAPI.cancelSplit(jobId),
    events: {
      // Split progress reuses the shared conversion progress channel.
      onProgress: (cb) => window.electronAPI.onConversionProgress(cb),
      onComplete: (cb) => window.electronAPI.onSplitComplete(cb),
      onError: (cb) => window.electronAPI.onSplitError(cb),
    },
    execution: 'sequential',
    createJob: (inputPath, options, id) => ({
      id,
      inputPath,
      fileName: inputPath.split('/').pop() || inputPath,
      options,
      status: 'pending',
      progress: 0,
    }),
  });

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
    jobs: ffmpegJob.jobs,
    isSplitting: ffmpegJob.isRunning,
    ffmpegReady: ffmpegJob.ffmpegReady,
    addFiles: ffmpegJob.addFiles,
    startSplit: ffmpegJob.start,
    retryJob: ffmpegJob.retryJob,
    cancelJob: ffmpegJob.cancelJob,
    removeJob: ffmpegJob.removeJob,
    revealInFinder: ffmpegJob.revealInFinder,
    buildOptions,
  };
}
