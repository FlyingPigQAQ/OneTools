import { useState, useCallback } from 'react';
import { useAudioSplitter } from '../../../hooks/useAudioSplitter';
import { useFileDrop } from '../../../hooks/useFileDrop';
import DropZone from '../../common/DropZone';
import FileList from '../../common/FileList';
import SplitQueue from './SplitQueue';
import type { SplitMode } from '@shared/types';
import styles from './AudioSplitter.module.css';

function AudioSplitter() {
  const {
    jobs,
    isSplitting,
    ffmpegReady,
    addFiles,
    startSplit,
    retryJob,
    cancelJob,
    removeJob,
    revealInFinder,
    buildOptions,
  } = useAudioSplitter();

  const [mode, setMode] = useState<SplitMode>('size');
  const [sizeMB, setSizeMB] = useState(10);
  const [durationSec, setDurationSec] = useState(60);
  const [outputDir, setOutputDir] = useState('');

  const handleFilesDrop = useCallback(
    async (droppedFiles: { path: string; name: string }[]) => {
      const options = buildOptions(mode, sizeMB, durationSec, outputDir || '');
      await addFiles(
        droppedFiles.map((f) => f.path),
        options
      );
    },
    [addFiles, buildOptions, mode, sizeMB, durationSec, outputDir]
  );

  const handleBrowse = useCallback(async () => {
    const files = await window.electronAPI.selectInputFiles();
    if (files.length > 0) {
      const options = buildOptions(mode, sizeMB, durationSec, outputDir || '');
      await addFiles(files, options);
    }
  }, [addFiles, buildOptions, mode, sizeMB, durationSec, outputDir]);

  const handleSelectOutputDir = useCallback(async () => {
    const dir = await window.electronAPI.selectOutputDir();
    if (dir) setOutputDir(dir);
  }, []);

  const handleSplit = useCallback(() => {
    const options = buildOptions(mode, sizeMB, durationSec, outputDir || '');
    startSplit(options);
  }, [startSplit, buildOptions, mode, sizeMB, durationSec, outputDir]);

  const { isDragging, handleDragOver, handleDragLeave, handleDrop } = useFileDrop(handleFilesDrop);

  const pendingFiles = jobs
    .filter((j) => j.status === 'pending')
    .map((j) => ({ id: j.id, name: j.fileName }));

  const hasPending = jobs.some((j) => j.status === 'pending');

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2>Audio Splitter</h2>
        <p>Split an audio file into parts by size or duration — no re-encoding.</p>
        {ffmpegReady === false && (
          <div className={styles.warning}>⚠️ FFmpeg not found. Some features may not work.</div>
        )}
      </header>

      <div className={styles.content}>
        <section className={styles.leftPanel}>
          <DropZone
            isDragging={isDragging}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleBrowse}
            disabled={isSplitting}
          />

          <FileList
            files={pendingFiles}
            onRemove={(id) => removeJob(id)}
            onClear={() => jobs.filter((j) => j.status === 'pending').forEach((j) => removeJob(j.id))}
          />

          {jobs.length === 0 && (
            <p className={styles.emptyHint}>
              No files added yet. Drag audio files above or click to browse.
            </p>
          )}

          {jobs.length > 0 && (
            <div className={styles.outputSection}>
              <label>Output Directory</label>
              <div className={styles.outputDir}>
                <span className={styles.dirPath}>{outputDir || 'Same as input'}</span>
                <button onClick={handleSelectOutputDir}>Change</button>
              </div>
            </div>
          )}

          {hasPending && (
            <button
              className={styles.splitBtn}
              onClick={handleSplit}
              disabled={isSplitting}
            >
              {isSplitting ? 'Splitting...' : `Split ${jobs.filter((j) => j.status === 'pending').length} file(s)`}
            </button>
          )}
        </section>

        <section className={styles.rightPanel}>
          <div className={styles.panel}>
            <label className={styles.sectionLabel}>Split Mode</label>
            <div className={styles.modeRow}>
              <button
                className={`${styles.modeBtn} ${mode === 'size' ? styles.active : ''}`}
                onClick={() => setMode('size')}
              >
                By Size
              </button>
              <button
                className={`${styles.modeBtn} ${mode === 'duration' ? styles.active : ''}`}
                onClick={() => setMode('duration')}
              >
                By Duration
              </button>
            </div>

            {mode === 'size' ? (
              <div className={styles.group}>
                <label className={styles.label}>Target size per file (MB)</label>
                <div className={styles.inputRow}>
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    className={styles.numberInput}
                    value={sizeMB}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setSizeMB(isNaN(v) ? 0 : v);
                    }}
                  />
                  <span className={styles.unit}>MB</span>
                </div>
                <p className={styles.hint}>
                  Approximate. Files stay at or under this size; exact size isn&apos;t
                  possible because splitting preserves the original codec (no re-encode)
                  and cuts only on keyframe boundaries.
                </p>
              </div>
            ) : (
              <div className={styles.group}>
                <label className={styles.label}>Duration per file (seconds)</label>
                <div className={styles.inputRow}>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    className={styles.numberInput}
                    value={durationSec}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setDurationSec(isNaN(v) ? 0 : v);
                    }}
                  />
                  <span className={styles.unit}>sec</span>
                </div>
                <p className={styles.hint}>Each output file will be roughly this long.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {jobs.some((j) => j.status === 'converting' || j.status === 'completed' || j.status === 'error') && (
        <SplitQueue
          jobs={jobs}
          onCancel={cancelJob}
          onRemove={removeJob}
          onRetry={retryJob}
          onReveal={revealInFinder}
        />
      )}
    </div>
  );
}

export default AudioSplitter;
