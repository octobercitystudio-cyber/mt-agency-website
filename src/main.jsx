import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import './i18n'; // Import i18n for translations

import { HelmetProvider } from 'react-helmet-async';
import ErrorBoundary from './components/ErrorBoundary';
import { capturePublicPrerender } from './seo/publicPrerender';

console.log("Cache buster: ", Date.now());

// Preserve the public document until Helmet has committed its replacement.
capturePublicPrerender();

// A user may keep the ERP open while a new build is deployed. If a lazy route
// still points at an old hashed file, refresh once so Vite can load the current
// asset map instead of leaving the requested page blank.
window.addEventListener('vite:preloadError', event => {
  const reloadKey = 'mta:stale-build-reload';
  let lastReload;
  try { lastReload = Number(window.sessionStorage.getItem(reloadKey) || 0); } catch { return; }
  if (Date.now() - lastReload < 30_000) return;
  try { window.sessionStorage.setItem(reloadKey, String(Date.now())); } catch { return; }
  event.preventDefault();
  window.location.reload();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(error => {
      console.warn('Service worker registration failed:', error);
    });
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <HelmetProvider>
        <App />
      </HelmetProvider>
    </ErrorBoundary>
  </StrictMode>,
)
