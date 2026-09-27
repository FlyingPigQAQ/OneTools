import { create } from 'zustand';
import type { SplitJob } from '@shared/types';
import { createJobStore, type JobStore } from './jobStore';

export const useSplitStore = create<JobStore<SplitJob>>(createJobStore<SplitJob>());
