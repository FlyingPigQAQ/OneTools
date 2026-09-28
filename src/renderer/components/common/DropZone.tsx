import { useI18n } from '../../hooks/useI18n';
import styles from './DropZone.module.css';

interface DropZoneProps {
  isDragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onClick: () => void;
  disabled?: boolean;
  /** Emoji shown at the top of the zone. Defaults to 📁. */
  icon?: string;
  /** Main instruction line. Defaults to the audio-tool wording. */
  label?: string;
  /** Format badges shown at the bottom. Defaults to the audio formats. */
  formats?: string[];
}

function DropZone({
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onClick,
  disabled,
  icon = '📁',
  label,
  formats = ['MP3', 'AAC', 'FLAC', 'WAV', 'OGG', 'Opus', 'M4A', 'WMA'],
}: DropZoneProps) {
  const { t } = useI18n();

  return (
    <div
      className={`${styles.container} ${isDragging ? styles.dragging : ''} ${disabled ? styles.disabled : ''}`}
      onDragOver={disabled ? undefined : onDragOver}
      onDragLeave={disabled ? undefined : onDragLeave}
      onDrop={disabled ? undefined : onDrop}
      onClick={disabled ? undefined : onClick}
    >
      <div className={styles.icon}>{icon}</div>
      <p className={styles.text}>{label ?? t('dropzone.audioLabel')}</p>
      <p className={styles.subtext}>{t('dropzone.browse')}</p>
      <div className={styles.formats}>
        {formats.map((fmt) => (
          <span key={fmt} className={styles.badge}>{fmt}</span>
        ))}
      </div>
    </div>
  );
}

export default DropZone;
