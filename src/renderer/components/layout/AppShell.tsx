import { useCallback, useEffect, useRef } from 'react';
import Sidebar from './Sidebar';
import { useAppStore } from '../../store/appStore';
import styles from './AppShell.module.css';

const MAX_WIDTH = 480;

interface AppShellProps {
  children: React.ReactNode;
}

function AppShell({ children }: AppShellProps) {
  const {
    sidebarWidth,
    sidebarCollapsed,
    setSidebarWidth,
    collapseSidebar,
    expandSidebar,
  } = useAppStore();

  const draggingRef = useRef(false);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      draggingRef.current = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    []
  );

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      // Sidebar width = distance from window left edge to cursor.
      const newWidth = Math.min(MAX_WIDTH, Math.max(0, e.clientX));
      setSidebarWidth(newWidth);
    };

    const onMouseUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [setSidebarWidth]);

  return (
    <div className={styles.container}>
      <div className={styles.dragBar} />
      <div className={styles.body}>
        {!sidebarCollapsed && (
          <>
            <Sidebar width={sidebarWidth} />
            <div
              className={styles.resizer}
              onMouseDown={onMouseDown}
              onDoubleClick={collapseSidebar}
              title="Drag to resize · Double-click to hide"
            />
          </>
        )}
        {sidebarCollapsed && (
          <button
            className={styles.expandBtn}
            onClick={expandSidebar}
            title="Show sidebar"
            aria-label="Show sidebar"
          >
            ▶
          </button>
        )}
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}

export default AppShell;
