// Keep the server-rendered public document available if the interactive app
// fails. These snapshots contain only the same public HTML served to everyone.
const seoSelector = 'title,meta[name="description"],meta[name="author"],meta[name="robots"],meta[property^="og:"],meta[name^="twitter:"],link[rel="canonical"],link[rel="alternate"],script[type="application/ld+json"]';
let initialPage = null;
const normalizedPath = value => value.replace(/\/+$/, '') || '/';

function snapshot(doc, pathname) {
  if (!/^\/(?:ar|en)(?:\/|$)/.test(pathname) && pathname !== '/') return null;
  if (!doc.documentElement.hasAttribute('data-public-prerender') || !doc.querySelector('#root #main-content')) return null;
  return {
    pathname: normalizedPath(pathname),
    lang: doc.documentElement.lang,
    dir: doc.documentElement.dir,
    html: doc.getElementById('root').innerHTML,
    head: [...doc.head.querySelectorAll(seoSelector)].map(element => element.cloneNode(true)),
  };
}

export function capturePublicPrerender() {
  initialPage = snapshot(document, window.location.pathname);
  if (initialPage) document.head.querySelectorAll(seoSelector).forEach(element => element.setAttribute('data-static-seo', ''));
}

// Run from the SEO layout effect, after React has committed replacement metadata.
// Older Helmet versions reuse the title node; React 19 creates a replacement.
export function releasePrerenderMetadata() {
  document.head.querySelectorAll('[data-static-seo]').forEach(element => {
    if (element.tagName === 'TITLE' && document.head.querySelectorAll('title').length === 1) element.removeAttribute('data-static-seo');
    else element.remove();
  });
}

export function initialPublicPrerender(pathname = window.location.pathname) {
  return initialPage?.pathname === normalizedPath(pathname) ? initialPage : null;
}

export async function recoverPublicPrerender(pathname, signal) {
  // Never request or snapshot a private account or an arbitrary destination.
  if (!/^\/(?:ar|en)(?:\/|$)/.test(pathname) && pathname !== '/') return null;
  const saved = initialPublicPrerender(pathname);
  if (saved) return saved;
  const response = await fetch(pathname, { signal, cache: 'no-cache', credentials: 'omit' });
  if (!response.ok || new URL(response.url).origin !== window.location.origin || !response.headers.get('content-type')?.includes('text/html')) return null;
  const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
  return snapshot(doc, pathname);
}

export function restorePrerenderMetadata(page) {
  document.head.querySelectorAll(seoSelector).forEach(element => element.remove());
  for (const element of page.head) document.head.appendChild(element.cloneNode(true));
  document.documentElement.lang = page.lang;
  document.documentElement.dir = page.dir;
}
