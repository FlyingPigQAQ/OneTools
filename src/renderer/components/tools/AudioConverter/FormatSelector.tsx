import { AUDIO_FORMATS } from '@shared/audioFormats';
import { useI18n } from '../../../hooks/useI18n';
import styles from './FormatSelector.module.css';

interface FormatSelectorProps {
  value: string;
  onChange: (format: string) => void;
}

function FormatSelector({ value, onChange }: FormatSelectorProps) {
  const { t } = useI18n();

  return (
    <div className={styles.container}>
      <label className={styles.label}>{t('parameters.outputFormat')}</label>
      <div className={styles.grid}>
        {AUDIO_FORMATS.map((fmt) => (
          <button
            key={fmt.id}
            className={`${styles.formatBtn} ${value === fmt.id ? styles.active : ''}`}
            onClick={() => onChange(fmt.id)}
            title={fmt.name}
          >
            <span className={styles.formatName}>{fmt.name}</span>
            <span className={styles.formatExt}>.{fmt.extension}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default FormatSelector;
