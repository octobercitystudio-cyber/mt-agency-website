import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { getPublicService, getServicePortfolio, portfolioMatchesService, publicServiceCatalog, publicServiceSlugs } from '../src/data/publicServiceCatalog.js';
import { VERIFIED_PORTFOLIO, withVerifiedPortfolioServiceLinks } from '../src/data/verifiedPortfolio.js';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');

test('public catalog has ten stable unique service slugs and complete bilingual content', () => {
  assert.equal(publicServiceCatalog.length, 10);
  assert.equal(new Set(publicServiceSlugs).size, 10);
  assert.equal(publicServiceSlugs.includes('custom'), false);
  const requiredText = ['title', 'navLabel', 'eyebrow', 'heroSummary', 'introduction', 'seoTitle', 'metaDescription'];
  const requiredLists = ['outcomes', 'deliverables', 'process', 'suitableFor', 'faq', 'keywords'];
  for (const service of publicServiceCatalog) {
    assert.match(service.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(service.erpServiceType && service.icon && service.group);
    for (const locale of ['ar', 'en']) {
      for (const field of requiredText) assert.ok(service[locale][field]?.trim(), `${service.slug}.${locale}.${field}`);
      for (const field of requiredLists) assert.ok(Array.isArray(service[locale][field]) && service[locale][field].length >= (field === 'faq' ? 3 : 1), `${service.slug}.${locale}.${field}`);
      for (const faq of service[locale].faq) assert.equal(faq.length, 2);
    }
    assert.equal(getPublicService(service.slug), service);
  }
});

test('portfolio linkage honors explicit assignments and keeps legacy fallbacks service-specific', () => {
  const explicit = { category: 'video', title: 'إعلان وفعالية', serviceSlugs: ['ai-video-production'] };
  assert.equal(portfolioMatchesService(explicit, 'ai-video-production'), true);
  assert.equal(portfolioMatchesService(explicit, 'commercial-video-production'), false, 'explicit service assignment blocks legacy cross-noise');
  assert.equal(portfolioMatchesService({ category: 'reels', title: 'Shorts' }, 'reels-production'), true);
  assert.equal(portfolioMatchesService({ category: 'reels', title: 'Shorts' }, 'social-media-management'), true);
  assert.equal(portfolioMatchesService({ category: 'podcast', title: 'Episode' }, 'podcast-production'), true);
  assert.equal(portfolioMatchesService({ category: 'web', title: 'Company website' }, 'web-design-development'), true);
  assert.equal(portfolioMatchesService({ category: 'web', title: 'Client Portal' }, 'software-development'), true);
  assert.equal(portfolioMatchesService({ category: 'design', title: 'Identity' }, 'creative-design-branding'), true);
  assert.equal(portfolioMatchesService({ category: 'video', title: 'إعلان تجاري' }, 'commercial-video-production'), true);
  assert.equal(portfolioMatchesService({ category: 'video', title: 'فيديو عام' }, 'commercial-video-production'), true, 'legacy commercial videos without keywords remain visible');
  assert.equal(portfolioMatchesService({ category: 'video', title: 'إعلان تجاري' }, 'event-coverage'), false);
  assert.equal(portfolioMatchesService({ category: 'video', title: 'فيديو عام' }, 'studio-content-production'), false, 'generic video is not copied into every service');
  assert.equal(portfolioMatchesService({ category: 'تغطية فعاليات', title: 'Sanofi' }, 'event-coverage'), true);
  assert.equal(portfolioMatchesService({ category: 'محتوى تعليمي', title: 'محتوى على سمارت بورد' }, 'studio-content-production'), true);
  assert.deepEqual(getServicePortfolio([explicit, { id: 2, category: 'podcast' }], 'ai-video-production'), [explicit]);
});

test('all verified legacy work is linked to the correct public service pages', () => {
  const expectedCounts = {
    'studio-content-production': 9,
    'reels-production': 6,
    'commercial-video-production': 9,
    'podcast-production': 4,
    'event-coverage': 10,
    'social-media-management': 6,
    'web-design-development': 3,
    'software-development': 0,
  };
  for (const [slug, count] of Object.entries(expectedCounts)) {
    assert.equal(getServicePortfolio(VERIFIED_PORTFOLIO, slug).length, count, slug);
  }

  const legacyRemoteItems = VERIFIED_PORTFOLIO.map(({ serviceSlugs, ...item }) => item);
  const hydrated = withVerifiedPortfolioServiceLinks(legacyRemoteItems);
  assert.deepEqual(hydrated.map(item => item.serviceSlugs), VERIFIED_PORTFOLIO.map(item => item.serviceSlugs));
});

test('public routes use one persistent shell and preserve private route boundaries', async () => {
  const [app, layout, home, pages] = await Promise.all(['src/App.jsx', 'src/layouts/PublicLayout.jsx', 'src/pages/HomePage.jsx', 'src/pages/PublicPages.jsx'].map(load));
  assert.match(app, /<Route element=\{<PublicLayout \/>\}>/);
  for (const route of ['services', 'services/:slug', 'about', 'portfolio', 'studios', 'contact', '*']) assert.ok(app.includes(`path="${route}"`), route);
  for (const privateRoute of ['/login', '/change-password', '/dashboard', '/erp/*', '/adminmt/*']) assert.ok(app.includes(`path="${privateRoute}"`), privateRoute);
  assert.equal((layout.match(/<Header \/>/g) || []).length, 1);
  assert.equal((layout.match(/<PublicPromotions \/>/g) || []).length, 1);
  assert.equal((layout.match(/<Footer \/>/g) || []).length, 1);
  assert.equal(home.includes('<Header'), false); assert.equal(home.includes('<PublicPromotions'), false); assert.equal(home.includes('<Footer'), false);
  assert.match(pages, /export function PublicNotFound/); assert.match(app, /<Route path="\*" element=\{<PublicNotFound \/>\}/);
  assert.match(app, /<PrivateSurface><UnifiedLogin/); assert.match(app, /<PrivateSurface><ErpProtectedRoute/);
});

test('legacy hashes scroll gracefully while canonical homepage navigation remains route based', async () => {
  const [layout, app, header, footer] = await Promise.all(['src/layouts/PublicLayout.jsx', 'src/App.jsx', 'src/components/Header.jsx', 'src/components/Footer.jsx'].map(load));
  assert.match(layout, /legacySections = new Set\(\['home', 'about', 'services', 'portfolio', 'studio', 'contact'\]\)/);
  assert.match(layout, /pathname === '\/' && legacySections\.has\(section\)/); assert.match(layout, /scrollIntoView/);
  assert.match(app, /pathname === '\/' && window\.location\.hash/); assert.equal(app.includes('replaceState(null'), false);
  for (const route of ['/', '/about', '/portfolio', '/studios', '/contact']) assert.ok(header.includes(`to: '${route}'`) || header.includes(`to="${route}"`), route);
  assert.match(header, /<Link to="\/services"/);
  assert.equal(footer.includes('href="#services"'), false); assert.match(footer, /<Link to="\/services">/);
});

test('services navigation supports desktop keyboard controls and a mobile accordion', async () => {
  const [header, css] = await Promise.all(['src/components/Header.jsx', 'src/components/Header.css'].map(load));
  assert.match(header, /aria-expanded=\{servicesOpen\}/); assert.match(header, /aria-controls="services-mega-menu"/); assert.match(header, /event\.key === 'Escape'/); assert.match(header, /servicesTriggerRef\.current\?\.focus\(\)/); assert.match(header, /document\.addEventListener\('pointerdown', outside\)/);
  assert.match(header, /publicServiceGroups\.map/); assert.match(header, /publicServiceCatalog\.filter/); assert.match(header, /setServicesOpen\(open => !open\)/); assert.match(header, /setIsMenuOpen\(false\)/);
  assert.match(css, /\.services-mega-menu__groups\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(max-width:769px\).*\.services-mega-menu\{position:static/s); assert.match(css, /\.services-mega-menu\.open\{max-height:1050px/); assert.match(css, /min-height:44px/); assert.match(css, /max-width:94vw/);
});

test('standalone About and Contact expose verified data and service-preselected safe inquiries', async () => {
  const pages = await load('src/pages/PublicPages.jsx');
  assert.match(pages, /export function AboutPage/); assert.match(pages, /about\.yearsOfExperience/); assert.match(pages, /about\.successfulProjects/); assert.match(pages, /about\.expertsCount/); assert.match(pages, /siteData\.about/);
  assert.match(pages, /export function ContactPage/); assert.match(pages, /new URLSearchParams\(location\.search\)\.get\('service'\)/); assert.match(pages, /location\.state\?\.service/); assert.match(pages, /value=\{service\}/); assert.match(pages, /encodeURIComponent\(receivingEmail\)/); assert.match(pages, /info@multitaskagency\.com/); assert.match(pages, /siteData\.formSettings\?\.receivingEmail/);
});

test('route SEO, schemas, sitemap and robots remain unique and private-safe', async () => {
  const [seo, layout, pages, index, sitemap, robots] = await Promise.all(['src/components/SEO.jsx', 'src/layouts/PublicLayout.jsx', 'src/pages/PublicPages.jsx', 'index.html', 'public/sitemap.xml', 'public/robots.txt'].map(load));
  assert.match(seo, /<link rel="canonical" href=\{canonicalUrl\}/); assert.match(seo, /og:url/); assert.match(seo, /twitter:title/); assert.equal(seo.includes('hreflang'), false);
  assert.equal((layout.match(/type="application\/ld\+json"/g) || []).length, 1); assert.match(layout, /'@type': \['ProfessionalService', 'Organization'\]/);
  assert.equal(index.includes('application/ld+json'), false, 'static duplicate Organization schema was removed');
  assert.match(pages, /'@type': 'Service'/); assert.match(pages, /'@type': 'BreadcrumbList'/); assert.match(pages, /'@type': 'AboutPage'/); assert.match(pages, /'@type': 'ContactPage'/);
  const sitemapPaths = [...sitemap.matchAll(/<loc>https:\/\/multitaskagency\.com\/(.*?)<\/loc>/g)].map(match => match[1]);
  const expected = ['', 'services', ...publicServiceSlugs.map(slug => `services/${slug}`), 'about', 'portfolio', 'studios', 'contact'];
  assert.deepEqual(new Set(sitemapPaths), new Set(expected)); assert.equal(sitemapPaths.length, expected.length);
  for (const path of ['/login', '/change-password', '/dashboard', '/erp/', '/adminmt/']) assert.ok(robots.includes(`Disallow: ${path}`));
  assert.match(robots, /Sitemap: https:\/\/multitaskagency\.com\/sitemap\.xml/);
});

test('public pages preserve mobile containment, 44px controls and reduced motion', async () => {
  const [pagesCss, headerCss, pages, portfolio, admin] = await Promise.all(['src/pages/PublicPages.css', 'src/components/Header.css', 'src/pages/PublicPages.jsx', 'src/components/PublicPortfolioGrid.jsx', 'src/admin/AdminPortfolio.jsx'].map(load));
  for (const width of ['900', '600', '340']) assert.ok(pagesCss.includes(`@media(max-width:${width}px)`));
  assert.match(pagesCss, /min-height:48px/); assert.match(pagesCss, /@media\(prefers-reduced-motion:reduce\)/); assert.match(pagesCss, /overflow:clip/); assert.match(headerCss, /min-height:44px/);
  assert.match(pagesCss, /\.public-work-media>a>img\{[^}]*width:100%;height:100%;display:block;object-fit:contain;object-position:center/s);
  assert.match(pages, /id="main-content"/); assert.match(pages, /<h1>/); assert.match(portfolio, /loading="lazy"/); assert.match(portfolio, /img\.youtube\.com/); assert.match(portfolio, /alt=\{alt\}/);
  assert.match(admin, /serviceSlugs/); assert.match(admin, /publicServiceCatalog\.map/); assert.match(admin, /type="checkbox"/);
});
