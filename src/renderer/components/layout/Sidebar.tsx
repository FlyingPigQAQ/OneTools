import { useI18n } from '../../hooks/useI18n';
import { useAppStore } from '../../store/appStore';
import { TOOL_REGISTRY } from '../../toolRegistry';
import styles from './Sidebar.module.css';

interface SidebarProps {
  width: number;
}

function Sidebar({ width }: SidebarProps) {
  const { activeTool, setActiveTool } = useAppStore();
  const { locale, setLocale, t } = useI18n();

  return (
    <aside className={styles.sidebar} style={{ width }}>
      <div className={styles.masthead}>
        <p className={styles.issue}>{t('sidebar.issue')}</p>
        <h1 className={styles.title}>OneTools</h1>
        <p className={styles.subtitle}>{t('sidebar.subtitle')}</p>
        <div className={styles.rule} />
      </div>

      <nav className={styles.nav}>
        <p className={styles.sectionLabel}>{t('sidebar.contents')}</p>
        {TOOL_REGISTRY.map((tool, index) => (
          <button
            key={tool.id}
            className={`${styles.toolButton} ${activeTool === tool.id ? styles.active : ''}`}
            onClick={() => setActiveTool(tool.id)}
            title={t(tool.description)}
          >
            <span className={styles.number}>{String(index + 1).padStart(2, '0')}</span>
            <div className={styles.entry}>
              <span className={styles.label}>{t(tool.name)}</span>
              <span className={styles.desc}>{t(tool.description)}</span>
            </div>
          </button>
        ))}
      </nav>

      <div className={styles.colophon}>
        <div className={styles.rule} />
        <div className={styles.langRow}>
          <button
            type="button"
            className={`${styles.langBtn} ${locale === 'zh' ? styles.langBtnActive : ''}`}
            aria-pressed={locale === 'zh'}
            onClick={() => setLocale('zh')}
          >
            中文
          </button>
          <button
            type="button"
            className={`${styles.langBtn} ${locale === 'en' ? styles.langBtnActive : ''}`}
            aria-pressed={locale === 'en'}
            onClick={() => setLocale('en')}
          >
            English
          </button>
        </div>
        <p className={styles.colophonText}>{t('sidebar.colophon')}</p>
      </div>
    </aside>
  );
}

export default Sidebar;
