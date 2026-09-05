import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';
import { AL_MAJD_SOCIAL_PARTNER } from '../src/data/alMajdSocialPartner.js';
import { getPublicService, getServicePortfolio, portfolioMatchesService, publicServiceCatalog, publicServiceSlugs } from '../src/data/publicServiceCatalog.js';
import { VERIFIED_PORTFOLIO, withVerifiedPortfolioServiceLinks } from '../src/data/verifiedPortfolio.js';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');

test('public catalog has ten stable unique service slugs and complete bilingual content', async () => {
  assert.equal(publicServiceCatalog.length, 10);
  assert.equal(new Set(publicServiceSlugs).size, 10);
  assert.equal(publicServiceSlugs.includes('custom'), false);
  const requiredText = ['title', 'navLabel', 'eyebrow', 'heroSummary', 'heroAlt', 'introduction', 'seoTitle', 'metaDescription'];
  const requiredLists = ['outcomes', 'deliverables', 'process', 'suitableFor', 'faq', 'keywords'];
  const heroImages = [];
  for (const service of publicServiceCatalog) {
    assert.match(service.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(service.erpServiceType && service.icon && service.group);
    assert.match(service.heroImage, /^\/service-heroes\/[a-z0-9]+(?:-[a-z0-9]+)*\.webp$/);
    heroImages.push(service.heroImage);
    await access(new URL(`public${service.heroImage}`, root));
    for (const locale of ['ar', 'en']) {
      for (const field of requiredText) assert.ok(service[locale][field]?.trim(), `${service.slug}.${locale}.${field}`);
      for (const field of requiredLists) assert.ok(Array.isArray(service[locale][field]) && service[locale][field].length >= (field === 'faq' ? 3 : 1), `${service.slug}.${locale}.${field}`);
      for (const faq of service[locale].faq) assert.equal(faq.length, 2);
    }
    assert.equal(getPublicService(service.slug), service);
  }
  assert.equal(new Set(heroImages).size, publicServiceCatalog.length, 'each service must have a unique hero image');
});

test('priority commercial services expose equivalent local expertise and Al Majd has durable static artwork', async () => {
  for (const slug of ['commercial-video-production', 'reels-production', 'social-media-management']) {
    const service = getPublicService(slug);
    for (const locale of ['ar', 'en']) {
      assert.ok(service[locale].title.match(/6|أكتوبر|October|Giza|الجيزة/), `${slug}.${locale} local H1`);
      assert.ok(service[locale].serviceType?.trim(), `${slug}.${locale}.serviceType`);
      assert.ok(service[locale].localExpertise?.title?.trim(), `${slug}.${locale}.localExpertise.title`);
      assert.equal(service[locale].localExpertise.items.length, 3);
    }
  }

  assert.equal(AL_MAJD_SOCIAL_PARTNER.serviceSlug, 'social-media-management');
  assert.equal(AL_MAJD_SOCIAL_PARTNER.images.length, 9);
  assert.deepEqual(AL_MAJD_SOCIAL_PARTNER.images.map(image => image.id), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  for (const image of AL_MAJD_SOCIAL_PARTNER.images) {
    assert.match(image.src, /^\/portfolio\/social-media\/al-majd\/[a-z0-9-]+\.webp$/);
    assert.ok(image.arAlt && image.enAlt && image.width > 0 && image.height > 0);
    await access(new URL(`public${image.src}`, root));
  }
});

test('web design service exposes bilingual local intent, a practical buying guide and contextual internal links', () => {
  const service = getPublicService('web-design-development');
  for (const locale of ['ar', 'en']) {
    const copy = service[locale];
    assert.match(copy.title, /6|أكتوبر|October/);
    assert.ok(copy.serviceType?.trim());
    assert.ok(copy.localExpertise?.title?.trim());
    assert.equal(copy.localExpertise.items.length, 3);
    assert.ok(copy.decisionGuide?.title?.trim());
    assert.equal(copy.decisionGuide.options.length, 3);
    assert.equal(copy.decisionGuide.factors.length, 4);
    assert.equal(copy.relatedServices.length, 3);
    assert.equal(copy.faq.length, 6);
  }
  assert.deepEqual(service.ar.relatedServices.map(item => item.slug), [
    'creative-design-branding',
    'social-media-management',
    'software-development',
  ]);
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
  assert.match(header, /alternatePublicPath/); assert.match(header, /localizePublicPath/); assert.match(header, /publicPath\('\/services'\)/);
  assert.equal(footer.includes('href="#services"'), false); assert.match(footer, /publicPath\('\/services'\)/);
  assert.match(app, /\['ar', 'en'\]\.map\(locale/);
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

test('Contact page presents company details first and keeps the form beside a compact map', async () => {
  const [pages, pagesCss] = await Promise.all(['src/pages/PublicPages.jsx', 'src/pages/PublicPages.css'].map(load));
  const start = pages.indexOf('export function ContactPage');
  const end = pages.indexOf('export function PortfolioPage', start);
  const contactPage = pages.slice(start, end);
  const infoIndex = contactPage.indexOf('className="public-contact-info container"');
  const workspaceIndex = contactPage.indexOf('className="public-contact-workspace container"');
  const formIndex = contactPage.indexOf('className="public-contact-form"', workspaceIndex);
  const mapIndex = contactPage.indexOf('className="public-contact-map-card"', workspaceIndex);

  assert.ok(infoIndex > -1 && infoIndex < workspaceIndex, 'company details should appear before the form and map');
  assert.ok(formIndex > workspaceIndex && formIndex < mapIndex, 'the form should be primary and precede the map on mobile');
  assert.match(contactPage, /className="public-contact-hero"[\s\S]*showMark=\{false\}/);
  assert.match(contactPage, /companyPhoneTel\(contact\.phone\)/);
  assert.match(contactPage, /companyPhoneTel\(contact\.phone2\)/);
  assert.match(contactPage, /title=\{isEnglish \? 'Multi Task Agency studio location' : 'موقع استديو Multi Task Agency'\}/);
  assert.doesNotMatch(contactPage, /public-section-number|public-contact-grid|className="public-map/);
  assert.match(pagesCss, /\.public-contact-info\{display:grid;grid-template-columns:/);
  assert.match(pagesCss, /\.public-contact-workspace\{display:grid;grid-template-columns:minmax\(0,1\.22fr\) minmax\(320px,\.78fr\)/);
  assert.match(pagesCss, /\.public-contact-map-card iframe\{[^}]*height:310px/s);
  assert.match(pagesCss, /@media\(max-width:900px\)[\s\S]*?\.public-contact-workspace\{grid-template-columns:1fr\}/);
  assert.match(pagesCss, /@media\(max-width:600px\)[\s\S]*?\.public-contact-info\{grid-template-columns:1fr\}[\s\S]*?\.public-contact-map-card iframe\{height:270px/s);
  assert.match(pagesCss, /\.public-site-shell>main#main-content \.public-contact-hero\{padding-top:36px;padding-bottom:36px/);
  assert.match(pagesCss, /\.public-contact-hero \.public-editorial-hero__grid\{grid-template-columns:minmax\(0,900px\);justify-content:center\}/);
  assert.match(pagesCss, /\.public-site-shell>main\.public-contact-page>\.public-contact-info\.container,\.public-site-shell>main\.public-contact-page>\.public-contact-workspace\.container\{width:calc\(100% - 32px\);max-width:none;margin-left:auto;margin-right:auto\}/);
  assert.match(pagesCss, /html\[lang="en"\]\[dir="ltr"\][^{]*\.public-contact-workspace\.container\{width:calc\(100% - 32px\);max-width:none;margin-inline:auto\}/);
});

test('all public company contact surfaces share the international phone formatter', async () => {
  const sources = await Promise.all([
    'src/pages/PublicPages.jsx',
    'src/components/Contact.jsx',
    'src/components/Footer.jsx',
    'src/components/PromoModal.jsx',
    'src/components/GlobalContactActions.jsx',
    'src/layouts/PublicLayout.jsx',
  ].map(load));
  for (const source of sources) assert.match(source, /lib\/companyContact/);
  assert.match(sources[0], /companyPhoneWhatsApp\(siteData\.contact\?\.phone\)/);
  assert.match(sources[1], /normalizeCompanyPhone\(contactData\.phone\)/);
  assert.match(sources[2], /normalizeCompanyPhone\(contact\.phone2\)/);
  assert.match(sources[3], /companyPhoneWhatsApp\(siteData\.contact\?\.phone2 \|\| siteData\.contact\?\.phone\)/);
  assert.match(sources[4], /companyPhoneTel\(CONTACT_NUMBER\)/);
  assert.match(sources[5], /telephone: normalizeCompanyPhone\(contact\.phone\) \|\| undefined/);
});

test('route SEO, schemas, sitemap and robots remain unique and private-safe', async () => {
  const [seo, layout, pages, index, sitemap, robots, generator] = await Promise.all(['src/components/SEO.jsx', 'src/layouts/PublicLayout.jsx', 'src/pages/PublicPages.jsx', 'index.html', 'dist/sitemap.xml', 'public/robots.txt', 'scripts/generate-public-seo.mjs'].map(load));
  assert.match(seo, /<link rel="canonical" href=\{canonicalUrl\}/); assert.match(seo, /og:url/); assert.match(seo, /twitter:title/); assert.match(seo, /hrefLang="ar-EG"/); assert.match(seo, /hrefLang="en-EG"/);
  assert.equal((layout.match(/type="application\/ld\+json"/g) || []).length, 1); assert.match(layout, /'@type': \['Organization', 'ProfessionalService'\]/); assert.match(layout, /'@type': 'WebSite'/);
  assert.equal(index.includes('application/ld+json'), false, 'static duplicate Organization schema was removed');
  assert.match(pages, /'@type': 'Service'/); assert.match(pages, /'@type': 'BreadcrumbList'/); assert.match(pages, /'@type': 'AboutPage'/); assert.match(pages, /'@type': 'ContactPage'/);
  const sitemapPaths = [...sitemap.matchAll(/<loc>https:\/\/multitaskagency\.com\/(.*?)<\/loc>/g)].map(match => match[1]);
  const unlocalized = ['', 'services/', ...publicServiceSlugs.map(slug => `services/${slug}/`), 'about/', 'portfolio/', 'studios/', 'contact/'];
  const expected = ['ar', 'en'].flatMap(locale => unlocalized.map(route => `${locale}/${route}`));
  assert.deepEqual(new Set(sitemapPaths), new Set(expected)); assert.equal(sitemapPaths.length, expected.length);
  for (const path of ['/login', '/change-password', '/reset-password', '/dashboard', '/erp/', '/adminmt/']) assert.ok(robots.includes(`Disallow: ${path}`));
  assert.match(robots, /Sitemap: https:\/\/multitaskagency\.com\/sitemap\.xml/);
  assert.match(generator, /Generated \$\{pages\.length \* 2\} localized public pages/); assert.match(generator, /FAQPage/); assert.match(generator, /app\.html/);
});

test('public pages preserve mobile containment, 44px controls and reduced motion', async () => {
  const [pagesCss, headerCss, pages, portfolio, admin] = await Promise.all(['src/pages/PublicPages.css', 'src/components/Header.css', 'src/pages/PublicPages.jsx', 'src/components/PublicPortfolioGrid.jsx', 'src/admin/AdminPortfolio.jsx'].map(load));
  for (const width of ['900', '600', '340']) assert.ok(pagesCss.includes(`@media(max-width:${width}px)`));
  assert.match(pagesCss, /min-height:48px/); assert.match(pagesCss, /@media\(prefers-reduced-motion:reduce\)/); assert.match(pagesCss, /overflow:clip/); assert.match(headerCss, /min-height:44px/);
  assert.match(pagesCss, /\.public-work-media>a>img\{[^}]*width:100%;height:100%;display:block;object-fit:contain;object-position:center/s);
  assert.match(pages, /<figure className="public-editorial-hero__media"><img src=\{image\} alt=\{imageAlt \|\| ''\} width="800" height="800" loading="eager" fetchPriority="high" decoding="async" \/><\/figure>/);
  assert.match(pages, /image=\{service\.heroImage\} imageAlt=\{text\.heroAlt\}/);
  assert.match(pagesCss, /\.public-editorial-hero__media\{[^}]*max-width:430px;[^}]*aspect-ratio:1/s);
  assert.match(pagesCss, /\.public-editorial-hero__media img\{[^}]*object-fit:contain;object-position:center/s);
  assert.match(pagesCss, /@media\(max-width:600px\).*\.public-editorial-hero__media\{[^}]*width:min\(82vw,300px\)/s);
  assert.match(pages, /id="main-content"/); assert.match(pages, /<h1>/); assert.match(portfolio, /loading="lazy"/); assert.match(portfolio, /img\.youtube\.com/); assert.match(portfolio, /alt=\{alt\}/);
  assert.match(admin, /serviceSlugs/); assert.match(admin, /publicServiceCatalog\.map/); assert.match(admin, /type="checkbox"/);
});
