import { create } from 'zustand';
import type { MarkdownPdfJob } from '@shared/types';

interface MarkdownPdfState {
  jobs: MarkdownPdfJob[];
  addJobs: (jobs: MarkdownPdfJob[]) => void;
  removeJob: (jobId: string) => void;
  clearJobs: () => void;
  updateJobStatus: (
    jobId: string,
    status: MarkdownPdfJob['status'],
    progress?: number,
    error?: string
  ) => void;
}

export const useMarkdownPdfStore = create<MarkdownPdfState>((set) => ({
  jobs: [],

  addJobs: (newJobs) => set((state) => ({ jobs: [...state.jobs, ...newJobs] })),

  removeJob: (jobId) =>
    set((state) => ({ jobs: state.jobs.filter((j) => j.id !== jobId) })),

  clearJobs: () => set({ jobs: [] }),

  updateJobStatus: (jobId, status, progress, error) =>
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === jobId
          ? {
              ...job,
              status,
              ...(progress !== undefined && { progress }),
              ...(error !== undefined && { error }),
            }
          : job
      ),
    })),
}));
