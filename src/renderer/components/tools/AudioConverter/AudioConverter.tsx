import { useState, useCallback, useEffect } from 'react';
import { useAudioConverter } from '../../../hooks/useAudioConverter';
import { useFileDrop } from '../../../hooks/useFileDrop';
import DropZone from '../../common/DropZone';
import FileList from '../../common/FileList';
import FormatSelector from './FormatSelector';
import ParameterPanel from './ParameterPanel';
import ConversionQueue from './ConversionQueue';
import styles from './AudioConverter.module.css';

function AudioConverter() {
  const {
    jobs,
    isConverting,
    ffmpegReady,
    addFiles,
    startConversion,
    retryJob,
    cancelJob,
    removeJob,
    revealInFinder,
    buildOptions,
  } = useAudioConverter();

  const [outputFormat, setOutputFormat] = useState('mp3');
  const [bitrate, setBitrate] = useState(192);
  const [sampleRate, setSampleRate] = useState(44100);
  const [channels, setChannels] = useState<1 | 2>(2);
  const [useVbr, setUseVbr] = useState(false);
  const [outputDir, setOutputDir] = useState('');

  const buildCurrentOptions = useCallback(
    () => buildOptions(outputFormat, bitrate, sampleRate, channels, outputDir || '', useVbr),
    [buildOptions, outputFormat, bitrate, sampleRate, channels, outputDir, useVbr]
  );

  const handleFilesDrop = useCallback(
    async (droppedFiles: { path: string; name: string }[]) => {
      const options = buildCurrentOptions();
      await addFiles(
        droppedFiles.map((f) => f.path),
        options
      );
    },
    [addFiles, buildCurrentOptions]
  );

  const handleBrowse = useCallback(async () => {
    const files = await window.electronAPI.selectInputFiles();
    if (files.length > 0) {
      await addFiles(files, buildCurrentOptions());
    }
  }, [addFiles, buildCurrentOptions]);

  const handleSelectOutputDir = useCallback(async () => {
    const dir = await window.electronAPI.selectOutputDir();
    if (dir) setOutputDir(dir);
  }, []);

  const handleConvert = useCallback(() => {
    startConversion(buildCurrentOptions());
  }, [startConversion, buildCurrentOptions]);

  // Menu accelerators
  useEffect(() => {
    const onOpenFiles = () => handleBrowse();
    const onRevealOutput = () => {
      const done = jobs.find((j) => j.status === 'completed');
      if (done) revealInFinder(done.id);
    };
    const onPreferences = () => {
      // Placeholder — no settings panel yet.
      console.log('Preferences: not implemented');
    };
    window.electronAPI.onMenu?.('menu:openFiles', onOpenFiles);
    window.electronAPI.onMenu?.('menu:revealOutput', onRevealOutput);
    window.electronAPI.onMenu?.('menu:preferences', onPreferences);
    return () => {
      window.electronAPI.offMenu?.('menu:openFiles', onOpenFiles);
      window.electronAPI.offMenu?.('menu:revealOutput', onRevealOutput);
      window.electronAPI.offMenu?.('menu:preferences', onPreferences);
    };
  }, [handleBrowse, jobs, revealInFinder]);

  const { isDragging, handleDragOver, handleDragLeave, handleDrop } = useFileDrop(handleFilesDrop);

  const pendingFiles = jobs
    .filter((j) => j.status === 'pending')
    .map((j) => ({
      id: j.id,
      name: j.fileName,
    }));

  const hasPending = jobs.some((j) => j.status === 'pending');
  const hasActivity = jobs.some(
    (j) => j.status === 'converting' || j.status === 'completed' || j.status === 'error'
  );

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2>Audio Converter</h2>
        <p>Convert audio files between different formats</p>
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
            disabled={isConverting}
          />

          {jobs.length === 0 && (
            <p className={styles.emptyHint}>
              No files added yet. Drag audio files above or click to browse.
            </p>
          )}

          <FileList
            files={pendingFiles}
            onRemove={(id) => removeJob(id)}
            onClear={() => jobs.filter((j) => j.status === 'pending').forEach((j) => removeJob(j.id))}
          />

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
              className={styles.convertBtn}
              onClick={handleConvert}
              disabled={isConverting}
            >
              {isConverting ? 'Converting...' : `Convert ${jobs.filter((j) => j.status === 'pending').length} file(s)`}
            </button>
          )}
        </section>

        <section className={styles.rightPanel}>
          <FormatSelector value={outputFormat} onChange={setOutputFormat} />

          <ParameterPanel
            format={outputFormat}
            bitrate={bitrate}
            sampleRate={sampleRate}
            channels={channels}
            useVbr={useVbr}
            onBitrateChange={setBitrate}
            onSampleRateChange={setSampleRate}
            onChannelsChange={setChannels}
            onUseVbrChange={setUseVbr}
          />
        </section>
      </div>

      {hasActivity && (
        <ConversionQueue
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

export default AudioConverter;
