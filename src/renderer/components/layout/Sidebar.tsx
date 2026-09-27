import { useAppStore } from '../../store/appStore';
import { TOOL_REGISTRY } from '../../toolRegistry';
import styles from './Sidebar.module.css';

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
        {TOOL_REGISTRY.map((tool, index) => (
          <button
            key={tool.id}
            className={`${styles.toolButton} ${activeTool === tool.id ? styles.active : ''}`}
            onClick={() => setActiveTool(tool.id)}
            title={tool.description}
          >
            <span className={styles.number}>{String(index + 1).padStart(2, '0')}</span>
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