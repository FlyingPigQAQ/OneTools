import { useState, useEffect, useRef } from 'react';
import AppShell from './components/layout/AppShell';
import { getToolById } from './toolRegistry';
import { useAppStore } from './store/appStore';

function App() {
  const { activeTool } = useAppStore();
  const [displayedTool, setDisplayedTool] = useState(activeTool);
  const [transitioning, setTransitioning] = useState(false);
  const prevTool = useRef(activeTool);

  useEffect(() => {
    if (activeTool === prevTool.current) return;
    prevTool.current = activeTool;

    setTransitioning(true);
    const timeout = setTimeout(() => {
      setDisplayedTool(activeTool);
      setTransitioning(false);

      // Trigger page-turn animation on the new content
      requestAnimationFrame(() => {
        const main = document.querySelector('[data-main-content]');
        if (main) {
          main.classList.add('page-turn');
          const onEnd = () => {
            main.classList.remove('page-turn');
            main.removeEventListener('animationend', onEnd);
          };
          main.addEventListener('animationend', onEnd);
        }
      });
    }, 120); // Small delay so the outgoing content feels like it's being "covered"

    return () => clearTimeout(timeout);
  }, [activeTool]);

  const ToolComponent = getToolById(displayedTool)?.component;

  return (
    <AppShell>
      <div
        data-main-content
        key={displayedTool}
        style={{
          width: '100%',
          height: '100%',
          opacity: transitioning ? 0.4 : 1,
          transition: 'opacity 0.12s ease',
        }}
      >
        {ToolComponent && <ToolComponent />}
      </div>
    </AppShell>
  );
}

export default App;
