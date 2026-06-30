import { create } from 'zustand';
import type { ConversionJob } from '@shared/types';

interface ConversionState {
  jobs: ConversionJob[];
  addJobs: (jobs: ConversionJob[]) => void;
  removeJob: (jobId: string) => void;
  clearJobs: () => void;
  updateJobStatus: (jobId: string, status: ConversionJob['status'], progress?: number, error?: string) => void;
  updateJobOptions: (jobId: string, options: ConversionJob['options']) => void;
  getPendingJobs: () => ConversionJob[];
  getCompletedJobs: () => ConversionJob[];
}

export const useConversionStore = create<ConversionState>((set, get) => ({
  jobs: [],

  addJobs: (newJobs) =>
    set((state) => ({
      jobs: [...state.jobs, ...newJobs],
    })),

  removeJob: (jobId) =>
    set((state) => ({
      jobs: state.jobs.filter((j) => j.id !== jobId),
    })),

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

  updateJobOptions: (jobId, options) =>
    set((state) => ({
      jobs: state.jobs.map((job) => (job.id === jobId ? { ...job, options } : job)),
    })),

  getPendingJobs: () => get().jobs.filter((j) => j.status === 'pending' || j.status === 'converting'),

  getCompletedJobs: () => get().jobs.filter((j) => j.status === 'completed' || j.status === 'error' || j.status === 'cancelled'),
}));
