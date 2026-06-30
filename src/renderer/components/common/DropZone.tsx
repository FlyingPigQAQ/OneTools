import styles from './DropZone.module.css';

interface DropZoneProps {
  isDragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onClick: () => void;
  disabled?: boolean;
}

function DropZone({
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onClick,
  disabled,
}: DropZoneProps) {
  return (
    <div
      className={`${styles.container} ${isDragging ? styles.dragging : ''} ${disabled ? styles.disabled : ''}`}
      onDragOver={disabled ? undefined : onDragOver}
      onDragLeave={disabled ? undefined : onDragLeave}
      onDrop={disabled ? undefined : onDrop}
      onClick={disabled ? undefined : onClick}
    >
      <div className={styles.icon}>📁</div>
      <p className={styles.text}>Drag &amp; drop audio files here</p>
      <p className={styles.subtext}>or click to browse</p>
      <div className={styles.formats}>
        {['MP3', 'AAC', 'FLAC', 'WAV', 'OGG', 'Opus', 'M4A', 'WMA'].map((fmt) => (
          <span key={fmt} className={styles.badge}>{fmt}</span>
        ))}
      </div>
    </div>
  );
}

export default DropZone;
