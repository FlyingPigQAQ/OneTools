import { statusKey } from '@shared/i18n';
import type { ConversionJob } from '@shared/types';
import { useI18n } from '../../../hooks/useI18n';
import ProgressBar from '../../common/ProgressBar';
import styles from './ConversionQueue.module.css';

interface ConversionQueueProps {
  jobs: ConversionJob[];
  onCancel: (jobId: string) => void;
  onRemove?: (jobId: string) => void;
  onRetry?: (jobId: string) => void;
  onReveal?: (jobId: string) => void;
}

function ConversionQueue({ jobs, onCancel, onRemove, onRetry, onReveal }: ConversionQueueProps) {
  const { t, formatError } = useI18n();
  const activeJobs = jobs.filter(
    (j) => j.status === 'pending' || j.status === 'converting' || j.status === 'completed' || j.status === 'error'
  );

  if (activeJobs.length === 0) return null;

  const hasCompleted = activeJobs.some((j) => j.status === 'completed' || j.status === 'error' || j.status === 'cancelled');
  const completedCount = activeJobs.filter((j) => j.status === 'completed').length;
  const remainingCount = activeJobs.filter(
    (j) => j.status === 'pending' || j.status === 'converting'
  ).length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          {t('queue.conversion')}
          {activeJobs.length > 1 && (
            <span className={styles.summary}>
              {' '}· {t('queue.summary', { done: completedCount, remaining: remainingCount })}
            </span>
          )}
        </h3>
        {hasCompleted && onRemove && (
          <button
            className={styles.clearBtn}
            onClick={() =>
              activeJobs
                .filter((j) => j.status === 'completed' || j.status === 'error' || j.status === 'cancelled')
                .forEach((j) => onRemove(j.id))
            }
          >
            {t('queue.clearFinished')}
          </button>
        )}
      </div>
      <ul className={styles.list}>
        {activeJobs.map((job) => (
          <li key={job.id} className={styles.item}>
            <div className={styles.info}>
              <span className={styles.fileName}>{job.fileName}</span>
              <span className={`${styles.status} ${styles[job.status]}`}>{t(statusKey(job.status))}</span>
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
                <button className={styles.revealBtn} onClick={() => onReveal(job.id)} title={t('queue.showInFinder')}>
                  🔍
                </button>
              )}
              {(job.status === 'completed' || job.status === 'error') && onRemove && (
                <button className={styles.cancelBtn} onClick={() => onRemove(job.id)} title={t('files.remove')}>
                  🗑
                </button>
              )}
            </div>

            {job.error && (
              <p className={styles.error}>{job.error ? formatError(job.error) : null}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ConversionQueue;
