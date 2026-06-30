import { create } from 'zustand';
import type { SplitJob } from '@shared/types';

interface SplitState {
  jobs: SplitJob[];
  addJobs: (jobs: SplitJob[]) => void;
  removeJob: (jobId: string) => void;
  clearJobs: () => void;
  updateJobStatus: (jobId: string, status: SplitJob['status'], progress?: number, error?: string) => void;
}

export const useSplitStore = create<SplitState>((set) => ({
  jobs: [],

  addJobs: (newJobs) =>
    set((state) => ({ jobs: [...state.jobs, ...newJobs] })),

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
