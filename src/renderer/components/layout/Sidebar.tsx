import { useAppStore } from '../../store/appStore';
import styles from './Sidebar.module.css';

const TOOLS = [
  {
    id: 'audio-converter',
    name: 'Audio Converter',
    icon: '🎵',
    description: 'Convert audio files between formats',
  },
  {
    id: 'audio-splitter',
    name: 'Audio Splitter',
    icon: '✂️',
    description: 'Split audio into parts by size or duration',
  },
  {
    id: 'markdown-pdf',
    name: 'Markdown to PDF',
    icon: '📄',
    description: 'Render Markdown documents to PDF',
  },
];

interface SidebarProps {
  width: number;
}

function Sidebar({ width }: SidebarProps) {
  const { activeTool, setActiveTool } = useAppStore();

  return (
    <aside className={styles.sidebar} style={{ width }}>
      <div className={styles.header}>
        <h1 className={styles.title}>OneTools</h1>
        <p className={styles.subtitle}>All-in-one utilities</p>
      </div>

      <nav className={styles.nav}>
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            className={`${styles.toolButton} ${activeTool === tool.id ? styles.active : ''}`}
            onClick={() => setActiveTool(tool.id)}
            title={tool.description}
          >
            <span className={styles.icon}>{tool.icon}</span>
            <span className={styles.label}>{tool.name}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;
