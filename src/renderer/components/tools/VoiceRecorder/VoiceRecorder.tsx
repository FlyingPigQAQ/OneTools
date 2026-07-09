import { useCallback } from 'react';
import { useVoiceRecorder } from '../../../hooks/useVoiceRecorder';
import RecordingList from './RecordingList';
import ToolHeader from '../../common/ToolHeader';
import styles from './VoiceRecorder.module.css';

function VoiceRecorder() {
  const {
    isRecording,
    elapsedSec,
    outputDir,
    error,
    recordings,
    startRecording,
    stopRecording,
    selectOutputDir,
    deleteRecording,
    revealInFinder,
    formatDuration,
    clearError,
  } = useVoiceRecorder();

  const handleRecordClick = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return (
    <div className={styles.container}>
      <ToolHeader
        title="Voice Recorder"
        subtitle="Record audio from your microphone and save as MP3."
        number="03"
      />

      <div className={styles.content}>
        {/* Left Panel: Recording Controls */}
        <section className={styles.leftPanel}>
          <div className={styles.recordingSection}>
            <button
              className={`${styles.recordButton} ${isRecording ? styles.recording : ''}`}
              onClick={handleRecordClick}
              disabled={!outputDir && !isRecording}
              title={
                !outputDir && !isRecording
                  ? 'Select an output directory first'
                  : isRecording
                    ? 'Stop recording'
                    : 'Start recording'
              }
            >
              {isRecording ? (
                <span className={styles.recordIcon}>⏹</span>
              ) : (
                <span className={styles.recordIcon}>🎙️</span>
              )}
            </button>

            {isRecording && (
              <>
                <span className={styles.timer}>{formatDuration(elapsedSec)}</span>
                <span className={styles.recordingLabel}>Recording</span>
              </>
            )}

            {isRecording && (
              <button className={styles.stopButton} onClick={stopRecording}>
                Stop Recording
              </button>
            )}

            {!isRecording && !outputDir && (
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-caption)' }}>
                Select an output directory to start recording.
              </p>
            )}
          </div>

          {/* Output Directory */}
          <div className={styles.outputSection}>
            <label>Output Directory</label>
            <div className={styles.outputDir}>
              <span className={styles.dirPath}>
                {outputDir || 'No directory selected'}
              </span>
              <button onClick={selectOutputDir} disabled={isRecording}>
                {outputDir ? 'Change' : 'Choose...'}
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className={styles.error}>
              <span>{error}</span>
              <button className={styles.errorDismiss} onClick={clearError}>
                ×
              </button>
            </div>
          )}
        </section>

        {/* Right Panel: Recordings List */}
        <section className={styles.rightPanel}>
          <RecordingList
            recordings={recordings}
            formatDuration={formatDuration}
            onDelete={deleteRecording}
            onReveal={revealInFinder}
          />
        </section>
      </div>
    </div>
  );
}

export default VoiceRecorder;