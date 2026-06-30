import AppShell from './components/layout/AppShell';
import AudioConverter from './components/tools/AudioConverter/AudioConverter';
import AudioSplitter from './components/tools/AudioSplitter/AudioSplitter';
import { useAppStore } from './store/appStore';

function App() {
  const { activeTool } = useAppStore();

  return (
    <AppShell>
      {activeTool === 'audio-converter' && <AudioConverter />}
      {activeTool === 'audio-splitter' && <AudioSplitter />}
    </AppShell>
  );
}

export default App;
