import '@tally/ui/styles.css';
import './app.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { loadDemoConfig } from './api/config';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App createConfig={(onFallback) => loadDemoConfig(import.meta.env, onFallback)} />
  </StrictMode>,
);
