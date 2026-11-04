import { useSyncExternalStore } from 'react';

let snapshot = { path: '', translations: {} };
const listeners = new Set();
const subscribe = listener => { listeners.add(listener); return () => listeners.delete(listener); };
const getSnapshot = () => snapshot;

export function setArticleNavigation(path, translations = {}) {
  snapshot = { path, translations };
  listeners.forEach(listener => listener());
}

export function useArticleNavigation(path) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  if (state.path === path) return state.translations;
  try {
    const initial = JSON.parse(document.getElementById('articles-bootstrap')?.textContent || 'null');
    if (initial?.kind === 'detail' && initial?.path?.split('?')[0] === path) return initial.data?.translations || initial.data?.article?.translations || {};
  } catch { /* Header safely falls back to the destination-language library. */ }
  return {};
}
