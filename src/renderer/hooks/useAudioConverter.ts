import { useCallback } from 'react';
import { useConversionStore } from '../store/conversionStore';
import { useFfmpegJob } from './useFfmpegJob';
import type { ConversionJob, ConversionOptions } from '@shared/types';
import { getFormatById } from '@shared/audioFormats';

export function useAudioConverter() {
  const ffmpegJob = useFfmpegJob<ConversionJob>({
    useStore: useConversionStore,
    idPrefix: 'job',
    startJob: (job) => window.electronAPI.startConversion(job),
    cancelJob: (jobId) => window.electronAPI.cancelConversion(jobId),
    events: {
      onProgress: (cb) => window.electronAPI.onConversionProgress(cb),
      onComplete: (cb) => window.electronAPI.onConversionComplete(cb),
      onError: (cb) => window.electronAPI.onConversionError(cb),
    },
    execution: 'parallel',
    dedupeInputs: true,
    createJob: (inputPath, options, id) => ({
      id,
      inputPath,
      outputPath: '',
      fileName: inputPath.split('/').pop() || inputPath,
      options,
      status: 'pending',
      progress: 0,
    }),
  });

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
    jobs: ffmpegJob.jobs,
    isConverting: ffmpegJob.isRunning,
    ffmpegReady: ffmpegJob.ffmpegReady,
    addFiles: ffmpegJob.addFiles,
    startConversion: ffmpegJob.start,
    retryJob: ffmpegJob.retryJob,
    cancelJob: ffmpegJob.cancelJob,
    removeJob: ffmpegJob.removeJob,
    revealInFinder: ffmpegJob.revealInFinder,
    buildOptions,
  };
}
