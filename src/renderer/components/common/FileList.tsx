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
  if (files.length === 0) return null;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.count}>{files.length} file{files.length !== 1 ? 's' : ''}</span>
        <button className={styles.clearBtn} onClick={onClear}>Clear All</button>
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
              title="Remove"
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
