import { hostingerClient } from './hostingerClient';

export async function articlesRequest(path, options) {
  const { data, error } = await hostingerClient.request(path, options);
  if (error) throw error;
  return data;
}

export function articleBootstrap(path, kind) {
  try {
    const value = JSON.parse(document.getElementById('articles-bootstrap')?.textContent || 'null');
    return value?.path === path && value?.kind === kind ? value.data : null;
  } catch { return null; }
}

export const articlesPath = (locale = 'ar', slug = '') => `/${locale === 'en' ? 'en' : 'ar'}/articles/${slug ? `${encodeURIComponent(slug)}/` : ''}`;

export function articlesListPath(locale, { q = '', category = '', page = 1 } = {}) {
  const query = new URLSearchParams();
  if (q) query.set('q', q);
  if (category) query.set('category', category);
  if (Number(page) > 1) query.set('page', String(page));
  return `${articlesPath(locale)}${query.size ? `?${query}` : ''}`;
}

export const articleDate = (date, locale = 'ar') => {
  if (!date) return '';
  const value = new Date(date);
  return Number.isNaN(value.getTime()) ? '' : value.toLocaleDateString(locale === 'en' ? 'en-GB' : 'ar-EG', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Africa/Cairo' });
};

export function articleVideo(url) {
  try {
    const value = new URL(url, 'https://multitaskagency.com');
    if (value.protocol !== 'https:') return null;
    if (['www.youtube.com', 'youtube.com', 'youtu.be'].includes(value.hostname)) {
      const id = value.hostname === 'youtu.be' ? value.pathname.slice(1) : value.searchParams.get('v') || value.pathname.match(/^\/embed\/([^/]+)$/)?.[1];
      if (id && /^[\w-]{11}$/.test(id)) return { type: 'youtube', src: `https://www.youtube.com/embed/${id}?playsinline=1` };
      return null;
    }
    if (value.hostname === 'multitaskagency.com' && /^\/api\/articles\/media\/[^/]+$/.test(value.pathname)) return { type: 'file', src: value.pathname + value.search };
  } catch { /* Unsupported media is never rendered as arbitrary HTML. */ }
  return null;
}

export function safeArticleLink(url) {
  const value = String(url || '');
  // Reject whitespace, control characters and backslashes in local URLs.
  // eslint-disable-next-line no-control-regex
  if (/^\/(?!\/)/.test(value) && !/[\\\u0000-\u0020]/.test(value)) return value;
  try { const parsed = new URL(value); return parsed.protocol === 'https:' ? parsed.href : ''; } catch { return ''; }
}

export const articleHeadings = blocks => (Array.isArray(blocks) ? blocks : []).flatMap((block, index) => block.type === 'heading' ? [{ id: `section-${index + 1}`, text: block.text, level: Number(block.level) === 3 ? 3 : 2 }] : []);
