import { useCallback } from 'react';
import { useI18n } from '../../../hooks/useI18n';
import { useVoiceRecorder } from '../../../hooks/useVoiceRecorder';
import RecordingList from './RecordingList';
import ToolHeader from '../../common/ToolHeader';
import styles from './VoiceRecorder.module.css';

function VoiceRecorder() {
  const { t, formatError } = useI18n();
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
        title={t('tools.voiceRecorder.title')}
        subtitle={t('tools.voiceRecorder.subtitle')}
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
                  ? t('recorder.selectDirFirst')
                  : isRecording
                    ? t('recorder.stop')
                    : t('recorder.start')
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
                <span className={styles.recordingLabel}>{t('recorder.recording')}</span>
              </>
            )}

            {isRecording && (
              <button className={styles.stopButton} onClick={stopRecording}>
                {t('recorder.stopButton')}
              </button>
            )}

            {!isRecording && !outputDir && (
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-caption)' }}>
                {t('recorder.selectDirHint')}
              </p>
            )}
          </div>

          {/* Output Directory */}
          <div className={styles.outputSection}>
            <label>{t('output.directory')}</label>
            <div className={styles.outputDir}>
              <span className={styles.dirPath}>
                {outputDir || t('output.noneSelected')}
              </span>
              <button onClick={selectOutputDir} disabled={isRecording}>
                {outputDir ? t('output.change') : t('output.choose')}
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className={styles.error}>
              <span>{formatError(error)}</span>
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