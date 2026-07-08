import AppShell from './components/layout/AppShell';
import AudioConverter from './components/tools/AudioConverter/AudioConverter';
import AudioSplitter from './components/tools/AudioSplitter/AudioSplitter';
import VoiceRecorder from './components/tools/VoiceRecorder/VoiceRecorder';
import MarkdownPdf from './components/tools/MarkdownPdf/MarkdownPdf';
import { useAppStore } from './store/appStore';

function App() {
  const { activeTool } = useAppStore();

  return (
    <AppShell>
      {activeTool === 'audio-converter' && <AudioConverter />}
      {activeTool === 'audio-splitter' && <AudioSplitter />}
      {activeTool === 'voice-recorder' && <VoiceRecorder />}
      {activeTool === 'markdown-pdf' && <MarkdownPdf />}
    </AppShell>
  );
}

export default App;
