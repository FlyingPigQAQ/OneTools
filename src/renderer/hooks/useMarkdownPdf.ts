import { useCallback, useEffect, useRef, useState } from 'react';
import { useMarkdownPdfStore } from '../store/markdownPdfStore';
import type {
  MarkdownPdfJob,
  MarkdownPdfOptions,
  PdfPageSize,
  PdfOrientation,
  PdfMargin,
  MarkdownTheme,
  ProgressData,
} from '@shared/types';

let jobIdCounter = 0;

export function useMarkdownPdf() {
  const [isConverting, setIsConverting] = useState(false);
  const listenersRef = useRef<(() => void)[]>([]);

  const { jobs, addJobs, updateJobStatus, removeJob } = useMarkdownPdfStore();

  useEffect(() => {
    const removeProgress = window.electronAPI.onMarkdownPdfProgress((data: ProgressData) => {
      updateJobStatus(data.jobId, 'converting', data.progress);
    });

    const removeComplete = window.electronAPI.onMarkdownPdfComplete((data) => {
      updateJobStatus(data.jobId, 'completed', 100);
    });

    const removeError = window.electronAPI.onMarkdownPdfError((data) => {
      updateJobStatus(data.jobId, 'error', undefined, data.error);
    });

    listenersRef.current = [removeProgress, removeComplete, removeError];

    return () => {
      listenersRef.current.forEach((remove) => remove());
    };
  }, [updateJobStatus]);

  const addFiles = useCallback(
    async (filePaths: string[], options: MarkdownPdfOptions) => {
      const newJobs: MarkdownPdfJob[] = filePaths.map((path) => ({
        id: `mdpdf-${++jobIdCounter}`,
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

  const startConversion = useCallback(
    async (options?: MarkdownPdfOptions) => {
      const pending = useMarkdownPdfStore
        .getState()
        .jobs.filter((j) => j.status === 'pending');
      if (pending.length === 0) return;

      setIsConverting(true);

      for (const job of pending) {
        const jobWithOptions = options ? { ...job, options } : job;
        updateJobStatus(job.id, 'converting', 0);
        try {
          await window.electronAPI.startMarkdownPdf(jobWithOptions);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Conversion failed';
          updateJobStatus(job.id, 'error', undefined, errorMsg);
        }
      }

      setIsConverting(false);
    },
    [updateJobStatus]
  );

  const cancelJob = useCallback(
    async (jobId: string) => {
      await window.electronAPI.cancelMarkdownPdf(jobId);
      updateJobStatus(jobId, 'cancelled');
    },
    [updateJobStatus]
  );

  /** Retry a single failed conversion. */
  const retryJob = useCallback(
    async (jobId: string) => {
      const job = useMarkdownPdfStore.getState().jobs.find((j) => j.id === jobId);
      if (!job) return;
      updateJobStatus(jobId, 'converting', 0);
      setIsConverting(true);
      try {
        await window.electronAPI.startMarkdownPdf({ ...job, status: 'pending', progress: 0 });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Conversion failed';
        updateJobStatus(jobId, 'error', undefined, errorMsg);
      }
      setIsConverting(false);
    },
    [updateJobStatus]
  );

  /** Reveal a job's output folder in Finder. */
  const revealInFinder = useCallback(async (jobId: string) => {
    const job = useMarkdownPdfStore.getState().jobs.find((j) => j.id === jobId);
    if (!job) return;
    const dir = job.options.outputDir || job.inputPath.substring(0, job.inputPath.lastIndexOf('/'));
    if (dir) {
      await window.electronAPI.revealInFinder(dir);
    }
  }, []);

  const buildOptions = useCallback(
    (
      pageSize: PdfPageSize,
      orientation: PdfOrientation,
      margin: PdfMargin,
      theme: MarkdownTheme,
      outputDir: string
    ): MarkdownPdfOptions => ({
      pageSize,
      orientation,
      margin,
      theme,
      outputDir,
    }),
    []
  );

  return {
    jobs,
    isConverting,
    addFiles,
    startConversion,
    retryJob,
    cancelJob,
    removeJob,
    revealInFinder,
    buildOptions,
  };
}
