import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBanner } from './components/ErrorBanner';
import { UpdateBanner } from './components/UpdateBanner';
import './styles.css';
import { applyTheme, followSystemTheme } from './theme';

applyTheme();
followSystemTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <UpdateBanner />
    <ErrorBanner />
  </StrictMode>,
);
