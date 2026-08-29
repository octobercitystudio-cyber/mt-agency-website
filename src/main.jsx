import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import './i18n'; // Import i18n for translations

import { HelmetProvider } from 'react-helmet-async';
import ErrorBoundary from './components/ErrorBoundary';

console.log("Cache buster: ", Date.now());

// Public build pages contain crawlable SEO tags before JavaScript runs. Once
// React starts, remove only those build-time tags so Helmet becomes the single
// live source and rendered crawlers never see duplicate metadata or JSON-LD.
if (document.documentElement.hasAttribute('data-public-prerender')) {
  document.head.querySelectorAll([
    'title',
    'meta[name="description"]',
    'meta[name="author"]',
    'meta[name="robots"]',
    'meta[property^="og:"]',
    'meta[name^="twitter:"]',
    'link[rel="canonical"]',
    'link[rel="alternate"]',
    'script[type="application/ld+json"]',
  ].join(',')).forEach(element => element.remove());
}

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
