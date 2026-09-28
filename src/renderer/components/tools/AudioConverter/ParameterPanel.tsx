import { getFormatById, BITRATE_PRESETS, SAMPLE_RATES } from '@shared/audioFormats';
import { useI18n } from '../../../hooks/useI18n';
import styles from './ParameterPanel.module.css';

interface ParameterPanelProps {
  format: string;
  bitrate: number;
  sampleRate: number;
  channels: 1 | 2;
  useVbr?: boolean;
  onBitrateChange: (bitrate: number) => void;
  onSampleRateChange: (rate: number) => void;
  onChannelsChange: (channels: 1 | 2) => void;
  onUseVbrChange?: (useVbr: boolean) => void;
}

function ParameterPanel({
  format,
  bitrate,
  sampleRate,
  channels,
  useVbr,
  onBitrateChange,
  onSampleRateChange,
  onChannelsChange,
  onUseVbrChange,
}: ParameterPanelProps) {
  const { t } = useI18n();
  const fmt = getFormatById(format);
  const supportsBitrate = fmt?.supportsBitrate ?? false;
  const supportsVbr = fmt?.supportsVbr ?? false;

  return (
    <div className={styles.container}>
      <label className={styles.sectionLabel}>{t('parameters.title')}</label>

      {supportsBitrate && (
        <div className={styles.group}>
          <label className={styles.label}>{t('parameters.bitrate')}</label>
          <div className={styles.options}>
            {BITRATE_PRESETS.map((b) => (
              <button
                key={b}
                className={`${styles.optionBtn} ${bitrate === b ? styles.active : ''}`}
                onClick={() => onBitrateChange(b)}
              >
                {b}
              </button>
            ))}
          </div>
        </div>
      )}

      {supportsVbr && onUseVbrChange && (
        <div className={styles.group}>
          <label className={styles.vbrRow}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={!!useVbr}
              onChange={(e) => onUseVbrChange(e.target.checked)}
            />
            <span>{t('parameters.vbr')}</span>
          </label>
        </div>
      )}

      <div className={styles.group}>
        <label className={styles.label}>{t('parameters.sampleRate')}</label>
        <div className={styles.options}>
          {SAMPLE_RATES.map((rate) => (
            <button
              key={rate}
              className={`${styles.optionBtn} ${sampleRate === rate ? styles.active : ''}`}
              onClick={() => onSampleRateChange(rate)}
            >
              {rate >= 1000
                ? t('parameters.khz', { n: rate / 1000 })
                : t('parameters.hz', { n: rate })}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.group}>
        <label className={styles.label}>{t('parameters.channels')}</label>
        <div className={styles.options}>
          <button
            className={`${styles.optionBtn} ${channels === 1 ? styles.active : ''}`}
            onClick={() => onChannelsChange(1)}
          >
            {t('parameters.mono')}
          </button>
          <button
            className={`${styles.optionBtn} ${channels === 2 ? styles.active : ''}`}
            onClick={() => onChannelsChange(2)}
          >
            {t('parameters.stereo')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ParameterPanel;
