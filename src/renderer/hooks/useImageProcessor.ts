import { useCallback, useEffect } from 'react';
import { useImageStore } from '../store/imageStore';
import { useFfmpegJob } from './useFfmpegJob';
import type { ImageFormatChoice } from '@shared/imageFormats';
import type { ImageJob, ImageProcessOptions, WatermarkOptions } from '@shared/types';

export function useImageProcessor() {
  const ffmpegJob = useFfmpegJob<ImageJob>({
    useStore: useImageStore,
    idPrefix: 'img',
    startJob: (job) => window.electronAPI.startImageJob(job),
    cancelJob: (jobId) => window.electronAPI.cancelImageJob(jobId),
    events: {
      onProgress: (cb) => window.electronAPI.onImageProgress(cb),
      onComplete: (cb) => window.electronAPI.onImageComplete(cb),
      onError: (cb) => window.electronAPI.onImageError(cb),
    },
    // Images are tiny compared to audio — pool them like the converter does.
    execution: 'parallel',
    dedupeInputs: true,
    createJob: (inputPath, options, id) => ({
      id,
      inputPath,
      fileName: inputPath.split('/').pop() || inputPath,
      options,
      status: 'pending',
      progress: 0,
    }),
    revealJob: async (job) => {
      if (job.outputPath) {
        await window.electronAPI.showItemInFolder(job.outputPath);
        return;
      }
      const dir = job.options.outputDir || job.inputPath.substring(0, job.inputPath.lastIndexOf('/'));
      if (dir) await window.electronAPI.revealInFinder(dir);
    },
  });

  // The shared hook only tracks status; sizes come from the completion payload.
  useEffect(() => {
    const removeComplete = window.electronAPI.onImageComplete((data) => {
      useImageStore.getState().updateJobResult(data.jobId, {
        outputPath: data.outputPath,
        inputSize: data.inputSize,
        outputSize: data.outputSize,
      });
    });
    return removeComplete;
  }, []);

  const buildOptions = useCallback(
    (
      format: ImageFormatChoice,
      quality: number,
      maxEdge: number,
      watermark: WatermarkOptions,
      outputDir: string
    ): ImageProcessOptions => ({
      format,
      quality,
      maxEdge,
      watermark,
      outputDir,
    }),
    []
  );

  return {
    jobs: ffmpegJob.jobs,
    isProcessing: ffmpegJob.isRunning,
    ffmpegReady: ffmpegJob.ffmpegReady,
    addFiles: ffmpegJob.addFiles,
    startProcessing: ffmpegJob.start,
    retryJob: ffmpegJob.retryJob,
    cancelJob: ffmpegJob.cancelJob,
    removeJob: ffmpegJob.removeJob,
    revealInFinder: ffmpegJob.revealInFinder,
    buildOptions,
  };
}
