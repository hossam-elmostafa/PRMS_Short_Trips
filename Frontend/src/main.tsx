import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Router from './Router.tsx';
import './index.css';
import { loadRuntimeConfig } from './config';

// Load runtime configuration (if present in /config.json) before mounting the app.
(async function init() {
  try {
    await loadRuntimeConfig();
  } catch (err) {
    // ignore
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Router />
    </StrictMode>
  );
})();
