import { useI18n } from '../../hooks/useI18n';
import styles from './FileList.module.css';

interface FileItem {
  id: string;
  name: string;
  status?: string;
}

interface FileListProps {
  files: FileItem[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

function FileList({ files, onRemove, onClear }: FileListProps) {
  const { t } = useI18n();
  if (files.length === 0) return null;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.count}>{t('files.count', { count: files.length })}</span>
        <button className={styles.clearBtn} onClick={onClear}>{t('files.clearAll')}</button>
      </div>
      <ul className={styles.list}>
        {files.map((file) => (
          <li key={file.id} className={styles.item}>
            <span className={styles.name}>{file.name}</span>
            {file.status && (
              <span className={styles.status}>{file.status}</span>
            )}
            <button
              className={styles.removeBtn}
              onClick={() => onRemove(file.id)}
              title={t('files.remove')}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default FileList;
