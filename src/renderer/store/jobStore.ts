import type { StateCreator, StoreApi, UseBoundStore } from 'zustand';
import type { AppError } from '@shared/i18n';

/** Fields every ffmpeg-style job shares across the audio tools. */
export interface BaseJob {
  id: string;
  inputPath: string;
  fileName: string;
  status: 'pending' | 'converting' | 'completed' | 'error' | 'cancelled';
  progress: number;
  error?: AppError;
}

/**
 * The store shape the shared `useFfmpegJob` hook needs. Every tool's job
 * store implements this over its own job type; `createJobStore` builds the
 * common actions so individual stores only declare their extra fields.
 */
export interface JobStore<TJob extends BaseJob & { options: unknown }> {
  jobs: TJob[];
  addJobs: (jobs: TJob[]) => void;
  removeJob: (jobId: string) => void;
  clearJobs: () => void;
  updateJobStatus: (
    jobId: string,
    status: TJob['status'],
    progress?: number,
    error?: AppError
  ) => void;
  updateJobOptions: (jobId: string, options: TJob['options']) => void;
  getPendingJobs: () => TJob[];
  getCompletedJobs: () => TJob[];
}

export type JobStoreApi<TJob extends BaseJob & { options: unknown }> = UseBoundStore<
  StoreApi<JobStore<TJob>>
>;

/** Builds the shared state/actions for a tool's job store. */
export function createJobStore<TJob extends BaseJob & { options: unknown }>(): StateCreator<
  JobStore<TJob>,
  [],
  []
> {
  return (set, get) => ({
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

    getCompletedJobs: () =>
      get().jobs.filter(
        (j) => j.status === 'completed' || j.status === 'error' || j.status === 'cancelled'
      ),
  });
}
