import { create } from 'zustand';
import type { ImageJob, ImageResult } from '@shared/types';
import { createJobStore, type JobStore } from './jobStore';

/** Per-job extras the image tool adds on top of the shared job store. */
export interface ImageStoreExtras {
  /** Record the completion payload (output path + byte sizes) for the size delta. */
  updateJobResult: (
    jobId: string,
    result: Pick<ImageResult, 'outputPath' | 'inputSize' | 'outputSize'>
  ) => void;
}

export type ImageStore = JobStore<ImageJob> & ImageStoreExtras;

const jobState = createJobStore<ImageJob>();

export const useImageStore = create<ImageStore>((set, get, api) => ({
  ...jobState(set, get, api),
  updateJobResult: (jobId, result) =>
    set((state) => ({
      jobs: state.jobs.map((job) => (job.id === jobId ? { ...job, ...result } : job)),
    })),
}));
