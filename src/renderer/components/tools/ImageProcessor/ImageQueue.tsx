import { statusKey } from '@shared/i18n';
import type { ImageJob } from '@shared/types';
import { useI18n } from '../../../hooks/useI18n';
import ProgressBar from '../../common/ProgressBar';
import styles from './ImageQueue.module.css';

interface ImageQueueProps {
  jobs: ImageJob[];
  onCancel: (jobId: string) => void;
  onRemove?: (jobId: string) => void;
  onRetry?: (jobId: string) => void;
  onReveal?: (jobId: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** "1.2 MB → 340 KB (−72%)" — the whole point of the 瘦身 tool. */
function sizeSummary(job: ImageJob, t: ReturnType<typeof useI18n>['t']): string | undefined {
  if (job.inputSize === undefined || job.outputSize === undefined) return undefined;
  const before = formatBytes(job.inputSize);
  const after = formatBytes(job.outputSize);
  if (job.inputSize === 0) return t('image.sizesNoChange', { before, after });

  const pct = Math.round((job.outputSize / job.inputSize - 1) * 100);
  if (pct === 0) return t('image.sizesNoChange', { before, after });
  const delta = pct > 0 ? `+${pct}%` : `−${Math.abs(pct)}%`;
  return t('image.sizes', { before, after, delta });
}

function ImageQueue({ jobs, onCancel, onRemove, onRetry, onReveal }: ImageQueueProps) {
  const { t, formatError } = useI18n();

  const activeJobs = jobs.filter(
    (j) =>
      j.status === 'pending' ||
      j.status === 'converting' ||
      j.status === 'completed' ||
      j.status === 'error'
  );

  if (activeJobs.length === 0) return null;

  const hasFinished = activeJobs.some(
    (j) => j.status === 'completed' || j.status === 'error' || j.status === 'cancelled'
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>{t('queue.image')}</h3>
        {hasFinished && onRemove && (
          <button
            className={styles.clearBtn}
            onClick={() =>
              activeJobs
                .filter(
                  (j) => j.status === 'completed' || j.status === 'error' || j.status === 'cancelled'
                )
                .forEach((j) => onRemove(j.id))
            }
          >
            {t('queue.clearFinished')}
          </button>
        )}
      </div>
      <ul className={styles.list}>
        {activeJobs.map((job) => {
          const sizes = job.status === 'completed' ? sizeSummary(job, t) : undefined;
          return (
          <li key={job.id} className={styles.item}>
            <div className={styles.info}>
              <span className={styles.fileName}>{job.fileName}</span>
              <span className={`${styles.status} ${styles[job.status]}`}>
                {job.status === 'converting' ? t('image.statusProcessing') : t(statusKey(job.status))}
              </span>
            </div>

            <div className={styles.progress}>
              <ProgressBar progress={job.progress} status={job.status} />
              {(job.status === 'converting' || job.status === 'pending') && (
                <button className={styles.cancelBtn} onClick={() => onCancel(job.id)} title={t('queue.cancel')}>
                  ✕
                </button>
              )}
              {job.status === 'error' && onRetry && (
                <button className={styles.retryBtn} onClick={() => onRetry(job.id)} title={t('queue.retry')}>
                  ↻
                </button>
              )}
              {job.status === 'completed' && onReveal && (
                <button
                  className={styles.revealBtn}
                  onClick={() => onReveal(job.id)}
                  title={t('queue.showInFinder')}
                >
                  🔍
                </button>
              )}
              {(job.status === 'completed' || job.status === 'error') && onRemove && (
                <button className={styles.cancelBtn} onClick={() => onRemove(job.id)} title={t('files.remove')}>
                  🗑
                </button>
              )}
            </div>

            {sizes && <p className={styles.sizes}>{sizes}</p>}
            {job.error && <p className={styles.error}>{formatError(job.error)}</p>}
          </li>
          );
        })}
      </ul>
    </div>
  );
}

export default ImageQueue;
