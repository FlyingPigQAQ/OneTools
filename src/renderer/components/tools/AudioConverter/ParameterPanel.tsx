import { getFormatById, BITRATE_PRESETS, SAMPLE_RATES } from '@shared/audioFormats';
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
  const fmt = getFormatById(format);
  const supportsBitrate = fmt?.supportsBitrate ?? false;
  const supportsVbr = fmt?.supportsVbr ?? false;

  return (
    <div className={styles.container}>
      <label className={styles.sectionLabel}>Parameters</label>

      {supportsBitrate && (
        <div className={styles.group}>
          <label className={styles.label}>Bitrate (kbps)</label>
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
            <span>Variable bitrate (VBR)</span>
          </label>
        </div>
      )}

      <div className={styles.group}>
        <label className={styles.label}>Sample Rate</label>
        <div className={styles.options}>
          {SAMPLE_RATES.map((rate) => (
            <button
              key={rate}
              className={`${styles.optionBtn} ${sampleRate === rate ? styles.active : ''}`}
              onClick={() => onSampleRateChange(rate)}
            >
              {rate >= 1000 ? `${rate / 1000} kHz` : `${rate} Hz`}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.group}>
        <label className={styles.label}>Channels</label>
        <div className={styles.options}>
          <button
            className={`${styles.optionBtn} ${channels === 1 ? styles.active : ''}`}
            onClick={() => onChannelsChange(1)}
          >
            Mono
          </button>
          <button
            className={`${styles.optionBtn} ${channels === 2 ? styles.active : ''}`}
            onClick={() => onChannelsChange(2)}
          >
            Stereo
          </button>
        </div>
      </div>
    </div>
  );
}

export default ParameterPanel;
