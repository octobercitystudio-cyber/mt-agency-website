import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { publicServiceCatalog } from '../src/data/publicServiceCatalog.js';
import { SITE_URL, organizationId, siteIdentity, websiteId } from '../src/seo/siteIdentity.js';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const distDirectory = path.join(projectRoot, 'dist');
const templatePath = path.join(distDirectory, 'index.html');
const template = await fs.readFile(templatePath, 'utf8');
const buildDate = new Date().toISOString().slice(0, 10);

const escapeHtml = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const jsonForHtml = value => JSON.stringify(value).replaceAll('<', '\\u003c');
const languagePath = (locale, routePath = '/') => routePath === '/' ? `/${locale}/` : `/${locale}${routePath.startsWith('/') ? routePath : `/${routePath}`}`.replace(/\/+$/, '/');
const absoluteUrl = pathname => `${SITE_URL}${pathname}`;

const commonPages = [
  {
    path: '/',
    ar: {
      title: 'إنتاج إعلامي وتسويق رقمي وتقنية في 6 أكتوبر',
      description: 'Multi Task Agency تقدم خدمات الإنتاج الإعلامي وصناعة المحتوى والتسويق الرقمي وتصميم المواقع والبرمجيات من مدينة 6 أكتوبر، الجيزة.',
      eyebrow: 'إنتاج وتسويق وتقنية من مكان واحد',
      h1: 'Multi Task Agency — إنتاج إعلامي وتسويق رقمي في 6 أكتوبر',
      summary: 'نساعد الشركات والخبراء على إنتاج المحتوى وبناء حضورهم الرقمي وتطوير مواقعهم وأنظمتهم من مدينة 6 أكتوبر، الجيزة.',
    },
    en: {
      title: 'Media Production, Digital Marketing & Technology in Giza',
      description: 'Multi Task Agency provides media production, content, digital marketing, web and software services from 6th of October City, Giza.',
      eyebrow: 'Production, marketing and technology together',
      h1: 'Multi Task Agency — Media, Marketing and Technology from Giza',
      summary: 'We help companies and experts produce content, grow their digital presence and build websites and software from 6th of October City, Giza.',
    },
  },
  {
    path: '/services/',
    ar: { title: 'خدمات الإنتاج والتسويق والتقنية', description: 'استكشف خدمات Multi Task Agency في الإنتاج الإعلامي والريلز والبودكاست والسوشيال ميديا والهوية والمواقع والبرمجيات.', eyebrow: 'قدرات مترابطة', h1: 'خدمات الإنتاج والتسويق والتقنية', summary: 'اختر خدمة محددة أو اجمع القدرات المناسبة حول هدف واحد وفريق مسؤول عن التنفيذ.' },
    en: { title: 'Production, Marketing and Technology Services', description: 'Explore Multi Task Agency services in media production, Reels, podcasts, social media, branding, web and software.', eyebrow: 'Connected capabilities', h1: 'Production, marketing and technology services', summary: 'Choose one focused capability or combine the right services around one objective and one accountable team.' },
  },
  {
    path: '/about/',
    ar: { title: 'عن Multi Task Agency', description: 'تعرف على Multi Task Agency وفريق الإنتاج والتسويق والتقنية الذي يعمل من مدينة 6 أكتوبر، الجيزة.', eyebrow: 'من نحن', h1: 'شريك إنتاج وتسويق وتقنية يعمل كفريق واحد', summary: 'نربط الاستراتيجية والإنتاج والتسويق والبرمجيات في مسار واضح يخدم هدف المشروع.' },
    en: { title: 'About Multi Task Agency', description: 'Meet the Multi Task Agency media, marketing and technology team based in 6th of October City, Giza.', eyebrow: 'About us', h1: 'A production, marketing and technology partner', summary: 'We connect strategy, production, marketing and software through one clear workflow built around the project objective.' },
  },
  {
    path: '/portfolio/',
    ar: { title: 'نماذج أعمال Multi Task Agency', description: 'شاهد أعمال Multi Task Agency الموثقة في الفيديو والريلز والبودكاست والتصميم والمواقع والمنتجات الرقمية.', eyebrow: 'أعمال مختارة', h1: 'أعمال توضح الفكرة وجودة التنفيذ', summary: 'نماذج حقيقية مرتبطة بخدمات الإنتاج والتصميم والتقنية التي نقدمها.' },
    en: { title: 'Multi Task Agency Portfolio', description: 'Explore verified Multi Task Agency work in video, Reels, podcasts, branding, websites and digital products.', eyebrow: 'Selected work', h1: 'Work that shows the thinking and the finish', summary: 'Verified projects connected to the production, design and technology services we provide.' },
  },
  {
    path: '/studios/',
    ar: { title: 'استديوهات تصوير في 6 أكتوبر', description: 'استكشف استديوهات التصوير والإنتاج المتاحة من Multi Task Agency واحجز التجهيز المناسب للمحتوى أو البودكاست أو الكورسات.', eyebrow: 'مساحات مجهزة للإنتاج', h1: 'استديوهات تصوير وإنتاج محتوى في 6 أكتوبر', summary: 'اختر المساحة والتجهيز المناسبين لنوع المحتوى وعدد الضيوف ووقت التسجيل.' },
    en: { title: 'Filming Studios in 6th of October', description: 'Explore Multi Task Agency filming and production studios for content, podcasts and course recording.', eyebrow: 'Spaces built for production', h1: 'Filming and content studios in 6th of October', summary: 'Choose the space and setup that fit the format, guest count and expected recording time.' },
  },
  {
    path: '/contact/',
    ar: { title: 'تواصل مع Multi Task Agency في 6 أكتوبر', description: 'تواصل مع Multi Task Agency في مدينة 6 أكتوبر لطلب عرض سعر لخدمات الإنتاج والتسويق وتصميم المواقع والبرمجيات.', eyebrow: 'تواصل معنا', h1: 'ناقش مشروعك مع Multi Task Agency', summary: 'تواصل معنا هاتفيًا أو عبر واتساب، أو أرسل تفاصيل الخدمة المطلوبة للحصول على عرض مناسب.' },
    en: { title: 'Contact Multi Task Agency in 6th of October', description: 'Contact Multi Task Agency in 6th of October for media production, marketing, web design and software project inquiries.', eyebrow: 'Contact us', h1: 'Discuss your project with Multi Task Agency', summary: 'Call, use WhatsApp or send the requested service details to receive the right project scope.' },
  },
];

const servicePages = publicServiceCatalog.map(service => ({
  path: `/services/${service.slug}/`,
  service,
  ar: { title: service.ar.seoTitle, description: service.ar.metaDescription, eyebrow: service.ar.eyebrow, h1: service.ar.title, summary: service.ar.heroSummary },
  en: { title: service.en.seoTitle, description: service.en.metaDescription, eyebrow: service.en.eyebrow, h1: service.en.title, summary: service.en.heroSummary },
}));

const pages = [...commonPages, ...servicePages];

const navigation = (locale, currentPath) => {
  const links = locale === 'en'
    ? [['Home', '/'], ['Services', '/services/'], ['Portfolio', '/portfolio/'], ['Studios', '/studios/'], ['About', '/about/'], ['Contact', '/contact/']]
    : [['الرئيسية', '/'], ['الخدمات', '/services/'], ['أعمالنا', '/portfolio/'], ['الاستديوهات', '/studios/'], ['من نحن', '/about/'], ['تواصل معنا', '/contact/']];
  const otherLocale = locale === 'en' ? 'ar' : 'en';
  const languageLabel = locale === 'en' ? 'العربية' : 'English';
  return `<header class="top-bar"><div class="top-bar-right"><a class="logo-link" href="${languagePath(locale, '/')}"><img src="/logo.webp" width="50" height="50" alt="Multi Task Agency"></a></div><nav class="header-nav" aria-label="${locale === 'en' ? 'Main navigation' : 'التنقل الرئيسي'}"><ul class="nav-list">${links.map(([label, href]) => `<li><a class="nav-link" href="${languagePath(locale, href)}">${escapeHtml(label)}</a></li>`).join('')}</ul></nav><a class="lang-btn" href="${languagePath(otherLocale, currentPath)}" hreflang="${otherLocale === 'en' ? 'en-EG' : 'ar-EG'}">${languageLabel}</a></header>`;
};

const servicesList = locale => `<section class="services-section"><div class="container"><h2 class="section-title">${locale === 'en' ? 'Explore our services' : 'استكشف خدماتنا'}</h2><div class="services-grid">${publicServiceCatalog.map(service => {
  const copy = service[locale];
  return `<article class="service-card glass-panel"><h3><a href="${languagePath(locale, `/services/${service.slug}/`)}">${escapeHtml(copy.title)}</a></h3><p>${escapeHtml(copy.outcomes[0])}</p></article>`;
}).join('')}</div></div></section>`;

const serviceContent = (page, locale) => {
  const copy = page.service[locale];
  const sectionTitle = (ar, en) => locale === 'en' ? en : ar;
  return `<section class="public-intro container"><h2>${sectionTitle('حل واضح مبني حول النتيجة', 'A focused solution built around the result')}</h2><p>${escapeHtml(copy.introduction)}</p></section>
  <section class="public-split-section container"><h2>${sectionTitle('ما الذي تحله الخدمة', 'What this service solves')}</h2><ul>${copy.outcomes.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul><h2>${sectionTitle('ما الذي تستلمه', 'What you receive')}</h2><ul>${copy.deliverables.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>
  <section class="public-process-section"><div class="container"><h2>${sectionTitle('خطوات التنفيذ', 'How the work moves')}</h2><ol>${copy.process.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ol></div></section>
  <section class="public-suitable container"><h2>${sectionTitle('مناسبة بشكل خاص لـ', 'A strong fit for')}</h2><ul>${copy.suitableFor.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>
  <section class="public-faq container"><h2>${sectionTitle('أسئلة شائعة', 'Frequently asked questions')}</h2>${copy.faq.map(([question, answer]) => `<details><summary>${escapeHtml(question)}</summary><p>${escapeHtml(answer)}</p></details>`).join('')}</section>
  <section class="public-inline-cta container"><h2>${sectionTitle('ابدأ مناقشة المشروع', 'Start a project conversation')}</h2><a class="public-solid-button" href="${languagePath(locale, `/contact/?service=${page.service.slug}`)}">${sectionTitle('اطلب عرض سعر', 'Request a quote')}</a></section>`;
};

const visiblePage = (page, locale) => {
  const copy = page[locale];
  const body = page.service ? serviceContent(page, locale) : (page.path === '/' || page.path === '/services/' ? servicesList(locale) : `<section class="public-intro container"><h2>${locale === 'en' ? 'Multi Task Agency in 6th of October City, Giza' : 'Multi Task Agency في مدينة 6 أكتوبر، الجيزة'}</h2><p>${escapeHtml(copy.description)}</p></section>${page.path === '/contact/' ? `<section class="public-contact-info container"><a href="tel:${siteIdentity.telephone}">${siteIdentity.telephone}</a><a href="tel:${siteIdentity.secondaryTelephone}">${siteIdentity.secondaryTelephone}</a><a href="mailto:${siteIdentity.email}">${siteIdentity.email}</a><p>${escapeHtml(siteIdentity.address[locale])}</p></section>` : ''}`);
  return `<div class="app-container public-site-shell">${navigation(locale, page.path)}<main id="main-content" class="public-page"><header class="public-editorial-hero"><div class="container public-editorial-hero__grid"><div class="public-editorial-hero__copy"><span class="public-eyebrow">${escapeHtml(copy.eyebrow)}</span><h1>${escapeHtml(copy.h1)}</h1><p>${escapeHtml(copy.summary)}</p></div>${page.service ? `<figure class="public-editorial-hero__media"><img src="${escapeHtml(page.service.heroImage)}" width="800" height="800" alt="${escapeHtml(page.service[locale].heroAlt)}"></figure>` : ''}</div></header>${body}</main></div>`;
};

const organization = {
  '@type': ['Organization', 'ProfessionalService'],
  '@id': organizationId,
  name: siteIdentity.name,
  alternateName: siteIdentity.alternateName,
  url: siteIdentity.url,
  logo: { '@type': 'ImageObject', url: siteIdentity.logo },
  image: siteIdentity.logo,
  email: siteIdentity.email,
  telephone: siteIdentity.telephone,
  address: { '@type': 'PostalAddress', addressLocality: siteIdentity.address.locality, addressRegion: siteIdentity.address.region, addressCountry: siteIdentity.address.country },
  areaServed: [{ '@type': 'City', name: '6th of October City' }, { '@type': 'AdministrativeArea', name: 'Giza' }, { '@type': 'Country', name: 'Egypt' }],
};

const schemaGraph = (page, locale, canonical) => {
  const copy = page[locale];
  const graph = [organization, {
    '@type': page.path === '/about/' ? 'AboutPage' : page.path === '/contact/' ? 'ContactPage' : page.path === '/services/' || page.path === '/portfolio/' ? 'CollectionPage' : 'WebPage',
    '@id': `${canonical}#webpage`, url: canonical, name: copy.title, description: copy.description, inLanguage: locale === 'en' ? 'en-EG' : 'ar-EG', about: { '@id': organizationId },
  }];
  if (page.path === '/') graph.unshift({ '@type': 'WebSite', '@id': websiteId, url: siteIdentity.url, name: siteIdentity.name, alternateName: siteIdentity.alternateName, publisher: { '@id': organizationId }, inLanguage: ['ar-EG', 'en-EG'] });
  if (page.service) {
    graph.push({ '@type': 'Service', '@id': `${canonical}#service`, name: page[locale].h1, description: copy.description, url: canonical, image: absoluteUrl(page.service.heroImage), provider: { '@id': organizationId }, areaServed: organization.areaServed });
    graph.push({ '@type': 'BreadcrumbList', '@id': `${canonical}#breadcrumb`, itemListElement: [
      { '@type': 'ListItem', position: 1, name: locale === 'en' ? 'Home' : 'الرئيسية', item: absoluteUrl(languagePath(locale, '/')) },
      { '@type': 'ListItem', position: 2, name: locale === 'en' ? 'Services' : 'الخدمات', item: absoluteUrl(languagePath(locale, '/services/')) },
      { '@type': 'ListItem', position: 3, name: page[locale].h1, item: canonical },
    ] });
    graph.push({ '@type': 'FAQPage', '@id': `${canonical}#faq`, mainEntity: page.service[locale].faq.map(([question, answer]) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } })) });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
};

const removeExistingSeo = html => html
  .replace(/\s*<title>[\s\S]*?<\/title>/i, '')
  .replace(/\s*<meta\s+(?:name|property)=["'](?:description|keywords|author|robots|og:type|og:url|og:title|og:description|og:image|og:site_name|og:locale|og:locale:alternate|twitter:card|twitter:title|twitter:description|twitter:image)["'][^>]*>/gi, '')
  .replace(/\s*<link\s+rel=["'](?:canonical|alternate)["'][^>]*>/gi, '')
  .replace(/\s*<script\s+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, '');

const renderDocument = (page, locale, { rootAlias = false, noIndex = false } = {}) => {
  const localizedPath = languagePath(locale, page.path);
  const canonical = absoluteUrl(localizedPath);
  const arabicUrl = absoluteUrl(languagePath('ar', page.path));
  const englishUrl = absoluteUrl(languagePath('en', page.path));
  const defaultUrl = page.path === '/' ? `${SITE_URL}/` : arabicUrl;
  const copy = page[locale];
  const socialImage = page.service ? absoluteUrl(page.service.heroImage) : siteIdentity.logo;
  const head = `<title>${escapeHtml(copy.title)} | ${siteIdentity.name}</title>
    <meta name="description" content="${escapeHtml(copy.description)}">
    <meta name="author" content="${siteIdentity.name}">
    <meta name="robots" content="${noIndex ? 'noindex, nofollow' : 'index, follow'}">
    <link rel="canonical" href="${canonical}">
    <link rel="alternate" hreflang="ar-EG" href="${arabicUrl}">
    <link rel="alternate" hreflang="en-EG" href="${englishUrl}">
    <link rel="alternate" hreflang="x-default" href="${defaultUrl}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${canonical}">
    <meta property="og:title" content="${escapeHtml(copy.title)} | ${siteIdentity.name}">
    <meta property="og:description" content="${escapeHtml(copy.description)}">
    <meta property="og:image" content="${socialImage}">
    <meta property="og:site_name" content="${siteIdentity.name}">
    <meta property="og:locale" content="${locale === 'en' ? 'en_EG' : 'ar_EG'}">
    <meta property="og:locale:alternate" content="${locale === 'en' ? 'ar_EG' : 'en_EG'}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(copy.title)} | ${siteIdentity.name}">
    <meta name="twitter:description" content="${escapeHtml(copy.description)}">
    <meta name="twitter:image" content="${socialImage}">
    <script type="application/ld+json">${jsonForHtml(schemaGraph(page, locale, canonical))}</script>`;

  let html = removeExistingSeo(template)
    .replace(/<html\s+[^>]*>/i, `<html lang="${locale}" dir="${locale === 'en' ? 'ltr' : 'rtl'}" data-public-prerender="true">`)
    .replace('</head>', `    ${head}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${visiblePage(page, locale)}</div>`);
  if (rootAlias) html = html.replace(`<link rel="canonical" href="${canonical}">`, `<link rel="canonical" href="${arabicUrl}">`);
  return html.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '');
};

const writePage = async (pathname, html) => {
  const relative = pathname.replace(/^\/+|\/+$/g, '');
  const directory = relative ? path.join(distDirectory, ...relative.split('/')) : distDirectory;
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, 'index.html'), html, 'utf8');
};

const privateAppTemplate = template
  .replace(/<meta\s+name=["']robots["'][^>]*>/i, '<meta name="robots" content="noindex, nofollow, noarchive">')
  .replace(/<title>[\s\S]*?<\/title>/i, '<title>Multi Task Agency</title>');
await fs.writeFile(path.join(distDirectory, 'app.html'), privateAppTemplate, 'utf8');

for (const page of pages) {
  for (const locale of ['ar', 'en']) await writePage(languagePath(locale, page.path), renderDocument(page, locale));
}

const home = pages.find(page => page.path === '/');
await writePage('/', renderDocument(home, 'ar', { rootAlias: true }));

const notFound = {
  path: '/404/',
  ar: { title: 'الصفحة غير موجودة', description: 'تعذر العثور على الصفحة المطلوبة.', eyebrow: '404', h1: 'الصفحة غير موجودة', summary: 'يمكنك العودة إلى الرئيسية أو استكشاف الخدمات.' },
  en: { title: 'Page not found', description: 'The requested page could not be found.', eyebrow: '404', h1: 'Page not found', summary: 'Return home or explore the available services.' },
};
await fs.writeFile(path.join(distDirectory, '404.html'), renderDocument(notFound, 'ar', { noIndex: true }), 'utf8');

const sitemapEntries = pages.flatMap(page => ['ar', 'en'].map(locale => {
  const loc = absoluteUrl(languagePath(locale, page.path));
  const ar = absoluteUrl(languagePath('ar', page.path));
  const en = absoluteUrl(languagePath('en', page.path));
  const fallback = page.path === '/' ? `${SITE_URL}/` : ar;
  return `  <url><loc>${loc}</loc><lastmod>${buildDate}</lastmod><xhtml:link rel="alternate" hreflang="ar-EG" href="${ar}"/><xhtml:link rel="alternate" hreflang="en-EG" href="${en}"/><xhtml:link rel="alternate" hreflang="x-default" href="${fallback}"/></url>`;
}));
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${sitemapEntries.join('\n')}\n</urlset>\n`;
await fs.writeFile(path.join(distDirectory, 'sitemap.xml'), sitemap, 'utf8');

const robots = `User-agent: *\nAllow: /\nDisallow: /login\nDisallow: /change-password\nDisallow: /reset-password\nDisallow: /dashboard\nDisallow: /erp/\nDisallow: /adminmt/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;
await fs.writeFile(path.join(distDirectory, 'robots.txt'), robots, 'utf8');

console.log(`Generated ${pages.length * 2} localized public pages, 404.html, sitemap.xml and robots.txt.`);
