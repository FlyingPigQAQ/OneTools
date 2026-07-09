import styles from './ToolHeader.module.css';

interface ToolHeaderProps {
  title: string;
  subtitle: string;
  number: string;
}

const SEPIA_OVERLAY =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.06'/%3E%3C/svg%3E\")";

function ToolHeader({ title, subtitle, number }: ToolHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.bleedContainer}>
        <h2 className={styles.bleedTitle}>{title}</h2>
        <div className={styles.overlay} style={{ backgroundImage: SEPIA_OVERLAY }} />
      </div>
      <div className={styles.meta}>
        <span className={styles.number}>{number}</span>
        <span className={styles.subtitle}>{subtitle}</span>
      </div>
      <div className={styles.rule} />
    </header>
  );
}

export default ToolHeader;