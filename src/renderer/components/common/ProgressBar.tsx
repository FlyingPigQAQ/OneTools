import styles from './ProgressBar.module.css';

interface ProgressBarProps {
  progress: number;
  status?: 'pending' | 'converting' | 'completed' | 'error' | 'cancelled';
  label?: string;
}

function ProgressBar({ progress, status = 'converting', label }: ProgressBarProps) {
  const isError = status === 'error';
  const isComplete = status === 'completed';

  return (
    <div className={styles.container}>
      <div className={styles.track}>
        <div
          className={`${styles.fill} ${isError ? styles.error : ''} ${isComplete ? styles.complete : ''}`}
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
      <div className={styles.info}>
        <span className={styles.percentage}>{Math.round(progress)}%</span>
        {label && <span className={styles.label}>{label}</span>}
      </div>
    </div>
  );
}

export default ProgressBar;
