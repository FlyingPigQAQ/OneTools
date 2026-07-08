import { create } from 'zustand';
import type { CompletedRecording } from '@shared/types';

interface RecorderState {
  isRecording: boolean;
  startTime: number | null;
  elapsedSec: number;
  outputFileName: string | null;
  outputDir: string;
  error: string | null;
  recordings: CompletedRecording[];

  setOutputDir: (dir: string) => void;
  setRecording: (isRecording: boolean, startTime: number | null, outputDir?: string) => void;
  setElapsed: (sec: number) => void;
  stopRecording: (fileName: string) => void;
  setError: (error: string) => void;
  clearError: () => void;
  addCompletedRecording: (recording: CompletedRecording) => void;
  removeRecording: (id: string) => void;
}

export const useRecorderStore = create<RecorderState>((set) => ({
  isRecording: false,
  startTime: null,
  elapsedSec: 0,
  outputFileName: null,
  outputDir: '',
  error: null,
  recordings: [],

  setOutputDir: (dir) => set({ outputDir: dir }),

  setRecording: (isRecording, startTime, outputDir) =>
    set({
      isRecording,
      startTime,
      elapsedSec: 0,
      error: null,
      outputFileName: null,
      ...(outputDir !== undefined && { outputDir }),
    }),

  setElapsed: (sec) => set({ elapsedSec: sec }),

  stopRecording: (fileName) =>
    set({ isRecording: false, startTime: null, elapsedSec: 0, outputFileName: fileName }),

  setError: (error) => set({ error, isRecording: false }),

  clearError: () => set({ error: null }),

  addCompletedRecording: (recording) =>
    set((state) => ({
      recordings: [recording, ...state.recordings],
    })),

  removeRecording: (id) =>
    set((state) => ({
      recordings: state.recordings.filter((r) => r.id !== id),
    })),
}));