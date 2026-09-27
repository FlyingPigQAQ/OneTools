import { create } from 'zustand';
import type { ConversionJob } from '@shared/types';
import { createJobStore, type JobStore } from './jobStore';

export const useConversionStore = create<JobStore<ConversionJob>>(createJobStore<ConversionJob>());
