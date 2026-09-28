import { useState, useRef, useCallback, useEffect } from 'react';
import type { AppError } from '@shared/i18n';
import type { CompletedRecording } from '@shared/types';
import { useI18n } from '../../../hooks/useI18n';
import styles from './VoiceRecorder.module.css';

interface RecordingListProps {
  recordings: CompletedRecording[];
  formatDuration: (seconds: number) => string;
  onDelete: (filePath: string, id: string) => void;
  onReveal: (filePath: string) => void;
}

const LOAD_TIMEOUT_MS = 15_000;

function isAppError(value: unknown): value is AppError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'key' in value &&
    typeof (value as { key: unknown }).key === 'string'
  );
}

function RecordingList({ recordings, formatDuration, onDelete, onReveal }: RecordingListProps) {
  const { t, formatError } = useI18n();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [playError, setPlayError] = useState<AppError | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCleanupRef = useRef<(() => void) | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const playingIdRef = useRef<string | null>(null);
  const loadingIdRef = useRef<string | null>(null);

  const revokeBlobUrl = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  const detachAudioListeners = useCallback(() => {
    if (audioCleanupRef.current) {
      audioCleanupRef.current();
      audioCleanupRef.current = null;
    }
  }, []);

  const stopPlayback = useCallback(() => {
    detachAudioListeners();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
      audioRef.current = null;
    }
    revokeBlobUrl();
    setPlayingId(null);
    setLoadingId(null);
    setCurrentTime(0);
    setDuration(0);
    playingIdRef.current = null;
    loadingIdRef.current = null;
  }, [detachAudioListeners, revokeBlobUrl]);

  useEffect(() => {
    return () => {
      detachAudioListeners();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
        audioRef.current.load();
        audioRef.current = null;
      }
      revokeBlobUrl();
    };
  }, [detachAudioListeners, revokeBlobUrl]);

  const waitForCanPlay = useCallback((audio: HTMLAudioElement) => {
    return new Promise<void>((resolve, reject) => {
      if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
        resolve();
        return;
      }

      const timeoutId = window.setTimeout(() => {
        cleanup();
        reject({ key: 'errors.audioLoadTimeout' });
      }, LOAD_TIMEOUT_MS);

      const onCanPlay = () => {
        cleanup();
        resolve();
      };

      const onLoadError = () => {
        cleanup();
        reject({ key: 'errors.audioLoadFailed' });
      };

      const cleanup = () => {
        window.clearTimeout(timeoutId);
        audio.removeEventListener('canplay', onCanPlay);
        audio.removeEventListener('error', onLoadError);
      };

      audio.addEventListener('canplay', onCanPlay);
      audio.addEventListener('error', onLoadError);
    });
  }, []);

  const handlePlay = useCallback(
    async (id: string, filePath: string) => {
      if (playingIdRef.current === id) {
        audioRef.current?.pause();
        setPlayingId(null);
        playingIdRef.current = null;
        return;
      }

      // Tear down the previous track but keep loadingIdRef unset until we
      // assign the new target below.
      detachAudioListeners();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
        audioRef.current.load();
        audioRef.current = null;
      }
      revokeBlobUrl();
      setPlayingId(null);
      setCurrentTime(0);
      setDuration(0);
      playingIdRef.current = null;

      setLoadingId(id);
      loadingIdRef.current = id;

      try {
        const bytes = await window.electronAPI.readAudioFile(filePath);
        if (loadingIdRef.current !== id) return;

        const blob = new Blob([bytes], { type: 'audio/mpeg' });
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;

        const audio = new Audio(blobUrl);

        const onLoadedMetadata = () => {
          setDuration(audio.duration);
        };

        const onTimeUpdate = () => {
          setCurrentTime(audio.currentTime);
        };

        const onEnded = () => {
          stopPlayback();
        };

        const onError = (e: Event) => {
          console.error('[OneTools] Audio playback error:', e);
          stopPlayback();
        };

        audio.addEventListener('loadedmetadata', onLoadedMetadata);
        audio.addEventListener('timeupdate', onTimeUpdate);
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('error', onError);

        audioCleanupRef.current = () => {
          audio.removeEventListener('loadedmetadata', onLoadedMetadata);
          audio.removeEventListener('timeupdate', onTimeUpdate);
          audio.removeEventListener('ended', onEnded);
          audio.removeEventListener('error', onError);
        };

        await waitForCanPlay(audio);
        if (loadingIdRef.current !== id) return;

        await audio.play();

        audioRef.current = audio;
        setLoadingId(null);
        loadingIdRef.current = null;
        setPlayingId(id);
        playingIdRef.current = id;
        setPlayError(null);
      } catch (err) {
        console.error('[OneTools] Audio load/play failed:', err);
        if (isAppError(err)) setPlayError(err);
        stopPlayback();
      }
    },
    [detachAudioListeners, revokeBlobUrl, stopPlayback, waitForCanPlay]
  );

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!audioRef.current || !duration) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      audioRef.current.currentTime = fraction * duration;
    },
    [duration]
  );

  return (
    <div className={styles.recordingsPanel}>
      <h3>
        {recordings.length === 0
          ? t('recorder.recordings')
          : t('recorder.recordingsCount', { count: recordings.length })}
      </h3>
      {playError ? <p className={styles.playError}>{formatError(playError)}</p> : null}
      {recordings.length === 0 ? (
        <p className={styles.emptyHint}>{t('recorder.empty')}</p>
      ) : (
      <div className={styles.recordingsList}>
        {recordings.map((rec) => {
          const isPlaying = playingId === rec.id;
          const isLoading = loadingId === rec.id;
          const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

          return (
            <div key={rec.id} className={styles.recordingItem}>
              <div className={styles.recordingInfo}>
                <span className={styles.recordingName} title={rec.fileName}>
                  {rec.fileName}
                </span>
                <div className={styles.recordingActions}>
                  <button
                    className={`${styles.playBtn} ${isPlaying ? styles.playing : ''}`}
                    onClick={() => handlePlay(rec.id, rec.filePath)}
                    disabled={isLoading}
                    title={isPlaying ? t('recorder.pause') : t('recorder.play')}
                  >
                    {isLoading ? '⏳' : isPlaying ? '⏸' : '▶'}
                  </button>
                  <button
                    className={styles.actionBtn}
                    onClick={() => onReveal(rec.filePath)}
                    title={t('recorder.reveal')}
                  >
                    🔍
                  </button>
                  <button
                    className={`${styles.actionBtn} ${styles.deleteBtn}`}
                    onClick={() => {
                      if (isPlaying) stopPlayback();
                      onDelete(rec.filePath, rec.id);
                    }}
                    title={t('recorder.delete')}
                  >
                    🗑
                  </button>
                </div>
              </div>

              {isPlaying && (
                <div className={styles.progressRow}>
                  <span className={styles.timeLabel}>{formatDuration(Math.floor(currentTime))}</span>
                  <div className={styles.progressTrack} onClick={handleSeek}>
                    <div className={styles.progressFill} style={{ width: `${progress}%` }} />
                  </div>
                  <span className={styles.timeLabel}>{formatDuration(Math.floor(duration))}</span>
                </div>
              )}

              <div className={styles.recordingMeta}>
                {!isPlaying && <span>{formatDuration(rec.duration)}</span>}
                {!isPlaying && <span>·</span>}
                <span>{new Date(rec.createdAt).toLocaleString()}</span>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}

export default RecordingList;
