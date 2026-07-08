import { useCallback, useEffect, useRef } from 'react';
import { useRecorderStore } from '../store/recorderStore';
import type { RecordingTickData, RecordingResult, CompletedRecording } from '@shared/types';

let recordingIdCounter = 0;

export function useVoiceRecorder() {
  const store = useRecorderStore();
  const listenersRef = useRef<(() => void)[]>([]);

  // On mount: query the current recording state from the main process to handle
  // the case where a recording was started before this component mounted (e.g.
  // the user switched to another tool and back).
  // Also set up IPC event listeners for recording events.
  useEffect(() => {
    window.electronAPI.getRecordingState().then((state) => {
      if (state.isRecording && state.startTime) {
        store.setRecording(true, state.startTime);
      }
    });

    const removeTick = window.electronAPI.onRecordingTick((data: RecordingTickData) => {
      store.setElapsed(data.elapsedSec);
    });

    const removeStopped = window.electronAPI.onRecordingStopped((data: RecordingResult) => {
      store.stopRecording(data.fileName);
      const recording: CompletedRecording = {
        id: `rec-${++recordingIdCounter}`,
        filePath: data.filePath,
        fileName: data.fileName,
        duration: data.duration,
        createdAt: new Date().toISOString(),
      };
      store.addCompletedRecording(recording);
    });

    const removeError = window.electronAPI.onRecordingError((data) => {
      store.setError(data.error);
    });

    listenersRef.current = [removeTick, removeStopped, removeError];

    return () => {
      listenersRef.current.forEach((remove) => remove());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startRecording = useCallback(async () => {
    if (!store.outputDir) {
      store.setError('Please select an output directory first.');
      return;
    }
    try {
      store.clearError();
      await window.electronAPI.startRecording({ outputDir: store.outputDir, format: 'mp3' });
      store.setRecording(true, Date.now());
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to start recording';
      store.setError(errorMsg);
    }
  }, [store.outputDir]);

  const stopRecording = useCallback(async () => {
    try {
      store.clearError();
      await window.electronAPI.stopRecording();
      // The store update happens in the onRecordingStopped listener.
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to stop recording';
      store.setError(errorMsg);
    }
  }, []);

  const selectOutputDir = useCallback(async () => {
    const dir = await window.electronAPI.selectOutputDir();
    if (dir) store.setOutputDir(dir);
  }, []);

  const deleteRecording = useCallback(async (filePath: string, id: string) => {
    const success = await window.electronAPI.deleteRecording(filePath);
    if (success) {
      store.removeRecording(id);
    }
  }, []);

  const revealInFinder = useCallback(async (filePath: string) => {
    await window.electronAPI.showItemInFolder(filePath);
  }, []);

  const formatDuration = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return {
    isRecording: store.isRecording,
    elapsedSec: store.elapsedSec,
    outputFileName: store.outputFileName,
    outputDir: store.outputDir,
    error: store.error,
    recordings: store.recordings,
    startRecording,
    stopRecording,
    selectOutputDir,
    deleteRecording,
    revealInFinder,
    formatDuration,
    clearError: store.clearError,
  };
}