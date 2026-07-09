import { useAppStore } from '../../store/appStore';
import styles from './Sidebar.module.css';

const TOOLS = [
  {
    id: 'audio-converter',
    number: '01',
    name: 'Audio Converter',
    description: 'Convert audio files between formats',
  },
  {
    id: 'audio-splitter',
    number: '02',
    name: 'Audio Splitter',
    description: 'Split audio into parts by size or duration',
  },
  {
    id: 'voice-recorder',
    number: '03',
    name: 'Voice Recorder',
    description: 'Record audio from your microphone',
  },
  {
    id: 'markdown-pdf',
    number: '04',
    name: 'Markdown to PDF',
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
      <div className={styles.masthead}>
        <p className={styles.issue}>Vol. I &mdash; No. 1</p>
        <h1 className={styles.title}>OneTools</h1>
        <p className={styles.subtitle}>A compendium of utilities for the modern artisan</p>
        <div className={styles.rule} />
      </div>

      <nav className={styles.nav}>
        <p className={styles.sectionLabel}>Contents</p>
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            className={`${styles.toolButton} ${activeTool === tool.id ? styles.active : ''}`}
            onClick={() => setActiveTool(tool.id)}
            title={tool.description}
          >
            <span className={styles.number}>{tool.number}</span>
            <div className={styles.entry}>
              <span className={styles.label}>{tool.name}</span>
              <span className={styles.desc}>{tool.description}</span>
            </div>
          </button>
        ))}
      </nav>

      <div className={styles.colophon}>
        <div className={styles.rule} />
        <p className={styles.colophonText}>
          Printed on the finest recycled electrons. All rights reserved.
        </p>
      </div>
    </aside>
  );
}

export default Sidebar;