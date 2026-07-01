import type { MarkdownPdfJob } from '@shared/types';
import ProgressBar from '../../common/ProgressBar';
import styles from './MarkdownPdfQueue.module.css';

interface MarkdownPdfQueueProps {
  jobs: MarkdownPdfJob[];
  onCancel: (jobId: string) => void;
  onRemove?: (jobId: string) => void;
  onRetry?: (jobId: string) => void;
  onReveal?: (jobId: string) => void;
}

function MarkdownPdfQueue({ jobs, onCancel, onRemove, onRetry, onReveal }: MarkdownPdfQueueProps) {
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
        <h3 className={styles.title}>Conversion Queue</h3>
        {hasFinished && onRemove && (
          <button
            className={styles.clearBtn}
            onClick={() =>
              activeJobs
                .filter((j) => j.status === 'completed' || j.status === 'error' || j.status === 'cancelled')
                .forEach((j) => onRemove(j.id))
            }
          >
            Clear Finished
          </button>
        )}
      </div>
      <ul className={styles.list}>
        {activeJobs.map((job) => (
          <li key={job.id} className={styles.item}>
            <div className={styles.info}>
              <span className={styles.fileName}>{job.fileName}</span>
              <span className={`${styles.status} ${styles[job.status]}`}>{job.status}</span>
            </div>

            <div className={styles.progress}>
              <ProgressBar progress={job.progress} status={job.status} />
              {(job.status === 'converting' || job.status === 'pending') && (
                <button className={styles.cancelBtn} onClick={() => onCancel(job.id)} title="Cancel">
                  ✕
                </button>
              )}
              {job.status === 'error' && onRetry && (
                <button className={styles.retryBtn} onClick={() => onRetry(job.id)} title="Retry">
                  ↻
                </button>
              )}
              {job.status === 'completed' && onReveal && (
                <button className={styles.revealBtn} onClick={() => onReveal(job.id)} title="Show in Finder">
                  🔍
                </button>
              )}
              {(job.status === 'completed' || job.status === 'error') && onRemove && (
                <button className={styles.cancelBtn} onClick={() => onRemove(job.id)} title="Remove">
                  🗑
                </button>
              )}
            </div>

            {job.error && <p className={styles.error}>{job.error}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default MarkdownPdfQueue;
