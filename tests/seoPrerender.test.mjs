import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { publicServiceCatalog } from '../src/data/publicServiceCatalog.js';
import { localizePublicPath, stripPublicLocale } from '../src/lib/publicRoutes.js';

const root = new URL('../', import.meta.url);
const load = file => readFile(new URL(file, root), 'utf8');
const localizedRoutes = ['index.html', 'services/index.html', ...publicServiceCatalog.map(service => `services/${service.slug}/index.html`), 'about/index.html', 'portfolio/index.html', 'studios/index.html', 'contact/index.html'];

const match = (html, pattern, label) => {
  const value = html.match(pattern)?.[1];
  assert.ok(value, label);
  return value;
};

test('public URL helpers preserve query strings and enforce one localized trailing-slash form', () => {
  assert.equal(localizePublicPath('/', 'ar'), '/ar/');
  assert.equal(localizePublicPath('/services/reels-production', 'en'), '/en/services/reels-production/');
  assert.equal(localizePublicPath('/contact?service=podcast-production', 'ar'), '/ar/contact/?service=podcast-production');
  assert.equal(stripPublicLocale('/en/services/reels-production/'), '/services/reels-production/');
});

test('build emits a complete crawlable Arabic and English HTML page for every public route', async () => {
  const canonicals = new Set();
  for (const locale of ['ar', 'en']) {
    for (const route of localizedRoutes) {
      const html = await load(`dist/${locale}/${route}`);
      assert.match(html, new RegExp(`<html lang="${locale}" dir="${locale === 'en' ? 'ltr' : 'rtl'}" data-public-prerender="true">`));
      assert.match(html, /<title>[^<]+\| Multi Task Agency<\/title>/);
      assert.match(html, /<meta name="description" content="[^"]+">/);
      assert.match(html, /<meta name="robots" content="index, follow">/);
      assert.match(html, /<h1>[^<]+<\/h1>/);
      assert.match(html, /hreflang="ar-EG"/);
      assert.match(html, /hreflang="en-EG"/);
      assert.match(html, /"@type":\["Organization","ProfessionalService"\]/);
      const canonical = match(html, /<link rel="canonical" href="([^"]+)">/, `${locale}/${route} canonical`);
      assert.ok(canonical.startsWith(`https://multitaskagency.com/${locale}/`));
      assert.equal(canonicals.has(canonical), false, `duplicate canonical ${canonical}`);
      canonicals.add(canonical);
    }
  }
  assert.equal(canonicals.size, 32);
});

test('service prerenders expose the same visible FAQ and Service schema in both languages', async () => {
  for (const locale of ['ar', 'en']) {
    for (const service of publicServiceCatalog) {
      const html = await load(`dist/${locale}/services/${service.slug}/index.html`);
      assert.match(html, /<section class="public-faq container">/);
      assert.match(html, /"@type":"Service"/);
      assert.match(html, /"@type":"FAQPage"/);
      assert.match(html, /"@type":"BreadcrumbList"/);
      for (const [question] of service[locale].faq) assert.ok(html.includes(question.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')));
    }
  }
});

test('priority service prerenders expose local proof and the complete Al Majd partner gallery', async () => {
  for (const locale of ['ar', 'en']) {
    for (const slug of ['commercial-video-production', 'reels-production', 'social-media-management']) {
      const html = await load(`dist/${locale}/services/${slug}/index.html`);
      assert.match(html, /class="public-local-expertise container"/);
      assert.match(html, /"serviceType":"[^"]+"/);
      assert.match(html, /class="public-seo-work-list"/);
    }

    const social = await load(`dist/${locale}/services/social-media-management/index.html`);
    assert.match(social, /class="public-success-partner"/);
    assert.match(social, /https:\/\/www\.almajdwoods\.com\//);
    assert.equal((social.match(/\/portfolio\/social-media\/al-majd\/[a-z0-9-]+\.webp/g) || []).length, 9);
    assert.equal((social.match(/loading="lazy" decoding="async"/g) || []).length, 9);
  }
});

test('web design prerender includes the visible decision guide, local expertise and related service links', async () => {
  for (const locale of ['ar', 'en']) {
    const html = await load(`dist/${locale}/services/web-design-development/index.html`);
    assert.match(html, /class="public-local-expertise container"/);
    assert.match(html, /class="public-decision-guide"/);
    assert.match(html, /class="public-related-services container"/);
    assert.match(html, /"serviceType":"[^"]+"/);
    for (const slug of ['creative-design-branding', 'social-media-management', 'software-development']) {
      assert.match(html, new RegExp(`/${locale}/services/${slug}/`));
    }
  }
});

test('private shell and unknown-route page are protected from indexing', async () => {
  const [app, notFound, htaccess, main] = await Promise.all([load('dist/app.html'), load('dist/404.html'), load('.htaccess'), load('src/main.jsx')]);
  assert.match(app, /<meta name="robots" content="noindex, nofollow, noarchive">/);
  assert.doesNotMatch(app, /<h1>/);
  assert.match(notFound, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(htaccess, /dist\/app\.html \[L,NC\]/);
  assert.match(htaccess, /ErrorDocument 404 \/dist\/404\.html/);
  assert.match(htaccess, /\[R=404,L\]/);
  assert.match(main, /hasAttribute\('data-public-prerender'\)/);
  assert.match(main, /script\[type="application\/ld\+json"\]/);
});

test('generated sitemap lists exactly the 32 canonical localized pages', async () => {
  const sitemap = await load('dist/sitemap.xml');
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(result => result[1]);
  assert.equal(locations.length, 32);
  assert.equal(new Set(locations).size, 32);
  assert.equal(locations.some(location => location.includes('/login') || location.includes('/dashboard') || location.includes('/erp')), false);
  assert.equal((sitemap.match(/hreflang="ar-EG"/g) || []).length, 32);
  assert.equal((sitemap.match(/hreflang="en-EG"/g) || []).length, 32);
});
