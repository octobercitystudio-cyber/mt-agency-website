import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import './i18n'; // Import i18n for translations

import { HelmetProvider } from 'react-helmet-async';
import ErrorBoundary from './components/ErrorBoundary';

console.log("Cache buster: ", Date.now());

// A user may keep the ERP open while a new build is deployed. If a lazy route
// still points at an old hashed file, refresh once so Vite can load the current
// asset map instead of leaving the requested page blank.
window.addEventListener('vite:preloadError', event => {
  event.preventDefault();
  const reloadKey = 'mta:stale-build-reload';
  const lastReload = Number(window.sessionStorage.getItem(reloadKey) || 0);
  if (Date.now() - lastReload < 30_000) return;
  window.sessionStorage.setItem(reloadKey, String(Date.now()));
  window.location.reload();
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <HelmetProvider>
        <App />
      </HelmetProvider>
    </ErrorBoundary>
  </StrictMode>,
)
