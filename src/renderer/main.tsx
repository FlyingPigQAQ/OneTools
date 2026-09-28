import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { useLocaleStore } from './store/localeStore';
import './styles/global.css';

window.electronAPI.onLocaleChanged((locale) => {
  useLocaleStore.setState({ locale });
});

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
