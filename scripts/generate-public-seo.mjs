import fs from 'node:fs/promises';
import { META_PIXEL_ID } from '../src/lib/metaPixel.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AL_MAJD_SOCIAL_PARTNER } from '../src/data/alMajdSocialPartner.js';
import { getServicePortfolio, publicServiceCatalog } from '../src/data/publicServiceCatalog.js';
import { VERIFIED_PORTFOLIO } from '../src/data/verifiedPortfolio.js';
import { EDUCATIONAL_BOOKING_COPY, EDUCATIONAL_BOOKING_IMAGE, EDUCATIONAL_BOOKING_SERVICE, EDUCATIONAL_BOOKING_TARGET } from '../src/data/educationalBooking.js';
import { CLIENT_APP_DOWNLOAD_URL } from '../src/data/clientApp.js';
import { SITE_URL, organizationId, siteIdentity, websiteId } from '../src/seo/siteIdentity.js';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const distDirectory = path.join(projectRoot, 'dist');
const templatePath = path.join(distDirectory, 'index.html');
const template = await fs.readFile(templatePath, 'utf8');
const manifest = JSON.parse(await fs.readFile(path.join(distDirectory, '.vite/manifest.json'), 'utf8'));
const routeAssets = (...entries) => {
  const files = new Set();
  const modules = new Set();
  const visited = new Set();
  const visit = key => {
    if (visited.has(key)) return;
    visited.add(key);
    const chunk = manifest[key];
    if (chunk?.file?.endsWith('.js')) modules.add(chunk.file);
    for (const css of chunk?.css || []) files.add(css);
    for (const dependency of chunk?.imports || []) visit(dependency);
  };
  entries.forEach(visit);
  return [...files].map(file => `<link rel="stylesheet" href="/${file}">`).join('')
    + [...modules].map(file => `<link rel="modulepreload" href="/${file}">`).join('');
};
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
      eyebrow: 'تصوير وتسويق وتطوير رقمي',
      h1: 'تصوير وإنتاج محتوى، وتسويق وتطوير رقمي',
      summary: 'استديوهات وفيديو وإدارة منصات وتصميم ومواقع وبرمجيات في 6 أكتوبر.',
    },
    en: {
      title: 'Media Production, Digital Marketing & Technology in Giza',
      description: 'Multi Task Agency provides media production, content, digital marketing, web and software services from 6th of October City, Giza.',
      eyebrow: 'Production, marketing and digital development',
      h1: 'Content production, marketing and digital development',
      summary: 'Studios, video, social media, design, websites and software in 6th of October City.',
    },
  },
  {
    path: '/services/',
    ar: { title: 'خدمات الإنتاج والتسويق والتقنية', description: 'تعرف على خدمات التصوير والريلز والبودكاست وإدارة المنصات والتصميم والمواقع والبرمجيات.', eyebrow: 'خدماتنا', h1: 'الإنتاج والتسويق والتقنية', summary: 'اطّلع على كل خدمة وما نقدمه فيها، أو احكِ لنا احتياج مشروعك.' },
    en: { title: 'Production, Marketing and Technology Services', description: 'Explore filming, Reels, podcasts, social media, branding, websites and software services.', eyebrow: 'Our services', h1: 'Production, marketing and technology', summary: 'Explore each service and its deliverables, or tell us what your project needs.' },
  },
  {
    path: '/about/',
    ar: { title: 'عن Multi Task Agency', description: 'خدمات إنتاج المحتوى والتسويق والتطوير الرقمي من مدينة 6 أكتوبر، الجيزة.', eyebrow: 'من نحن', h1: 'Multi Task Agency', summary: 'إنتاج إعلامي وتسويق وتطوير رقمي من مدينة 6 أكتوبر.' },
    en: { title: 'About Multi Task Agency', description: 'Media production, marketing and digital development from 6th of October City, Giza.', eyebrow: 'About us', h1: 'Multi Task Agency', summary: 'Media production, marketing and digital development from 6th of October City.' },
  },
  {
    path: '/portfolio/',
    ar: { title: 'نماذج أعمال Multi Task Agency', description: 'مشروعات مختارة في الفيديو والتصميم والعمل الرقمي.', eyebrow: 'أعمالنا', h1: 'نماذج أعمالنا', summary: 'مشروعات مختارة في الفيديو والتصميم والعمل الرقمي.' },
    en: { title: 'Multi Task Agency Portfolio', description: 'Selected projects in video, design and digital work.', eyebrow: 'Portfolio', h1: 'Selected work', summary: 'Selected projects in video, design and digital work.' },
  },
  {
    path: '/studios/',
    ar: { title: 'استديوهات تصوير في 6 أكتوبر', description: 'تعرّف على استديوهات أكتوبر وميدان لبنان والقاهرة الجديدة.', eyebrow: 'الاستديوهات', h1: 'اختر الاستديو المناسب', summary: 'تعرّف على استديوهات أكتوبر وميدان لبنان والقاهرة الجديدة.' },
    en: { title: 'Filming Studios in 6th of October', description: 'View our October, Lebanon Square and New Cairo studios.', eyebrow: 'Studios', h1: 'Choose your studio', summary: 'View our October, Lebanon Square and New Cairo studios.' },
  },
  {
    path: '/contact/',
    ar: { title: 'تواصل مع Multi Task Agency في 6 أكتوبر', description: 'اتصل بنا أو أرسل تفاصيل مشروعك.', eyebrow: 'تواصل', h1: 'تواصل معنا', summary: 'اتصل بنا أو أرسل تفاصيل مشروعك.' },
    en: { title: 'Contact Multi Task Agency in 6th of October', description: 'Call us or send your project details.', eyebrow: 'Contact', h1: 'Contact us', summary: 'Call us or send your project details.' },
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
  return `<header class="top-bar"><div class="top-bar-right"><a class="logo-link" href="${languagePath(locale, '/')}"><img src="/logo.webp" width="50" height="50" alt="Multi Task Agency"></a></div><nav class="header-nav" aria-label="${locale === 'en' ? 'Main navigation' : 'التنقل الرئيسي'}"><ul class="nav-list">${links.map(([label, href]) => `<li><a class="nav-link" href="${languagePath(locale, href)}">${escapeHtml(label)}</a></li>`).join('')}</ul></nav><div class="top-bar-left"><a class="lang-btn" href="${languagePath(otherLocale, currentPath)}" hreflang="${otherLocale === 'en' ? 'en-EG' : 'ar-EG'}">${languageLabel}</a><a href="/login" class="btn-secondary login-btn">${locale === 'en' ? 'Login' : 'تسجيل الدخول'}</a></div></header>`;
};

const educationalBookingContent = locale => {
  const copy = EDUCATIONAL_BOOKING_COPY[locale];
  const image = EDUCATIONAL_BOOKING_IMAGE;
  const arrow = locale === 'en' ? '→' : '←';
  return `<section id="educational-filming" class="educational-booking" aria-labelledby="educational-booking-title"><div class="container educational-booking__layout"><div class="educational-booking__content"><p class="educational-booking__eyebrow">${escapeHtml(copy.eyebrow)}</p><h2 id="educational-booking-title">${escapeHtml(copy.title)}</h2><p class="educational-booking__description">${escapeHtml(copy.description)}</p><ol class="educational-booking__steps" aria-label="${escapeHtml(copy.stepsLabel)}">${copy.steps.map((step, index) => `<li><span aria-hidden="true">${String(index + 1).padStart(2, '0')}</span><strong>${escapeHtml(step)}</strong></li>`).join('')}</ol><a class="educational-booking__action" href="${escapeHtml(EDUCATIONAL_BOOKING_TARGET)}"><span>${escapeHtml(copy.action)}</span><span aria-hidden="true">${arrow}</span></a><p class="educational-booking__note">${escapeHtml(copy.note)}</p><a class="educational-booking__details" href="${languagePath(locale, EDUCATIONAL_BOOKING_SERVICE + '/')}">${escapeHtml(copy.details)}<span aria-hidden="true">${arrow}</span></a><aside class="educational-booking__app" aria-labelledby="educational-booking-app-title"><p class="educational-booking__app-label">${escapeHtml(copy.appLabel)}</p><h3 id="educational-booking-app-title">${escapeHtml(copy.appTitle)}</h3><p class="educational-booking__app-description">${escapeHtml(copy.appDescription)}</p><a class="educational-booking__app-download" href="${escapeHtml(CLIENT_APP_DOWNLOAD_URL)}" download><span aria-hidden="true">↓</span><span>${escapeHtml(copy.appAction)}</span></a><p class="educational-booking__app-note">${escapeHtml(copy.appNote)}</p></aside></div><figure class="educational-booking__studio"><div class="educational-booking__stage"><img class="is-selected" src="${escapeHtml(image.url)}" alt="${escapeHtml(locale === 'en' ? image.altEn : image.alt)}" width="1600" height="900" loading="lazy" decoding="async"></div><figcaption><div><span>${escapeHtml(copy.imageLabel)}</span><strong>${escapeHtml(copy.imageCaption)}</strong></div></figcaption></figure></div></section>`;
};

const servicesList = locale => `<section class="services-section"><div class="container"><h2 class="section-title">${locale === 'en' ? 'Explore our services' : 'استكشف خدماتنا'}</h2><div class="services-grid">${publicServiceCatalog.map(service => {
  const copy = service[locale];
  return `<article class="service-card glass-panel"><h3><a href="${languagePath(locale, `/services/${service.slug}/`)}">${escapeHtml(copy.title)}</a></h3><p>${escapeHtml(copy.cardSummary)}</p></article>`;
}).join('')}</div></div></section>`;

const decisionGuideContent = (copy, number) => {
  const content = copy.decisionGuide;
  if (!content) return '';
  return `<section class="public-decision-guide" aria-labelledby="decision-guide-title"><div class="container"><header class="public-decision-guide__header"><span class="public-section-number">${number}</span><div><h2 id="decision-guide-title">${escapeHtml(content.title)}</h2></div></header><div class="public-decision-guide__options">${content.options.slice(0, 3).map((item, index) => `<article><span>${String(index + 1).padStart(2, '0')}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p></article>`).join('')}</div></div></section>`;
};

const alMajdPartnerContent = (service, locale, number) => {
  if (service.slug !== AL_MAJD_SOCIAL_PARTNER.serviceSlug) return '';
  const copy = AL_MAJD_SOCIAL_PARTNER[locale];
  const arrow = locale === 'en' ? '→' : '←';
  return `<section id="al-majd-work" class="public-success-partner" aria-labelledby="al-majd-partner-title"><div class="container"><header class="public-success-partner__header"><span class="public-success-partner__number">${number}</span><div><span class="public-eyebrow">${escapeHtml(copy.eyebrow)}</span><h2 id="al-majd-partner-title"><a href="${escapeHtml(AL_MAJD_SOCIAL_PARTNER.website)}" target="_blank" rel="noopener noreferrer">${escapeHtml(copy.name)} <span aria-hidden="true">${arrow}</span></a></h2><p>${escapeHtml(copy.summary)}</p><a class="public-success-partner__link" href="${escapeHtml(AL_MAJD_SOCIAL_PARTNER.website)}" target="_blank" rel="noopener noreferrer">${escapeHtml(copy.websiteLabel)} <span aria-hidden="true">${arrow}</span></a></div></header><div class="public-success-partner__gallery">${AL_MAJD_SOCIAL_PARTNER.images.map(image => `<figure><img src="${escapeHtml(image.src)}" alt="${escapeHtml(locale === 'en' ? image.enAlt : image.arAlt)}" width="${image.width}" height="${image.height}" loading="lazy" decoding="async"><figcaption>${locale === 'en' ? `Campaign design ${String(image.id).padStart(2, '0')}` : `تصميم إعلاني ${String(image.id).padStart(2, '0')}`}</figcaption></figure>`).join('')}</div></div></section>`;
};

const verifiedWorkContent = (service, locale, number) => {
  const work = getServicePortfolio(VERIFIED_PORTFOLIO, service);
  if (!work.length) return '';
  const title = locale === 'en' ? 'Verified work for this service' : 'أعمال موثقة في هذه الخدمة';
  return `<section id="service-work" class="public-work-section public-seo-work container"><div class="public-section-heading"><span>${number}</span><div><h2>${escapeHtml(title)}</h2></div></div><div class="public-seo-work-list">${work.map(item => {
    const href = item.projectUrl || item.embedUrl;
    const itemTitle = locale === 'en' ? (item.titleEn || item.title) : item.title;
    return `<article><span>${locale === 'en' ? 'Verified project' : 'عمل موثق'}</span><h3><a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(itemTitle)}</a></h3></article>`;
  }).join('')}</div></section>`;
};

const serviceContent = (page, locale) => {
  const copy = page.service[locale];
  const sectionTitle = (ar, en) => locale === 'en' ? en : ar;
  let nextSection = 3;
  const sectionNumber = () => String(nextSection++).padStart(2, '0');
  const decisionNumber = copy.decisionGuide ? sectionNumber() : null;
  const partnerNumber = page.service.slug === AL_MAJD_SOCIAL_PARTNER.serviceSlug ? sectionNumber() : null;
  const hasVerifiedWork = getServicePortfolio(VERIFIED_PORTFOLIO, page.service).length > 0;
  const workNumber = hasVerifiedWork ? sectionNumber() : null;
  const faqNumber = sectionNumber();
  return `<section class="public-split-section container"><h2>${sectionTitle('ما الذي تتضمنه الخدمة', 'What is included')}</h2><ul>${copy.deliverables.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>
  <section class="public-suitable container"><h2>${sectionTitle('مناسبة لـ', 'Suitable for')}</h2><ul>${copy.suitableFor.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>
  ${decisionGuideContent(copy, decisionNumber)}
  ${alMajdPartnerContent(page.service, locale, partnerNumber)}
  ${verifiedWorkContent(page.service, locale, workNumber)}
  <section class="public-faq container"><div class="public-section-heading"><span>${faqNumber}</span><h2>${sectionTitle('قبل الاتفاق', 'Before you book')}</h2></div><div>${copy.faq.map(([question, answer]) => `<details><summary>${escapeHtml(question)}</summary><p>${escapeHtml(answer)}</p></details>`).join('')}</div></section>
  <section class="public-inline-cta container"><h2>${sectionTitle('احكِ لنا احتياجك', 'Tell us what you need')}</h2><a class="public-solid-button" href="${languagePath(locale, `/contact/?service=${page.service.slug}`)}">${sectionTitle('اطلب عرض سعر', 'Request a quote')}</a></section>`;
};

const visiblePage = (page, locale) => {
  const copy = page[locale];
  const body = page.service ? serviceContent(page, locale) : (page.path === '/' ? educationalBookingContent(locale) + servicesList(locale) : page.path === '/services/' ? servicesList(locale) : page.path === '/about/' ? `<section class="public-intro container"><h2>${locale === 'en' ? 'What we do' : 'ماذا نقدم'}</h2><p>${locale === 'en' ? 'We produce video and content, manage social media, design visual identities and build websites and software. Each project starts with an agreed scope and deliverables.' : 'نصور وننتج المحتوى، وندير منصات التواصل، ونصمم الهويات البصرية، ونطور المواقع والبرمجيات. يبدأ كل مشروع بنطاق ومخرجات متفق عليها.'}</p></section>` : page.path === '/contact/' ? `<section class="public-contact-info container"><a href="tel:${siteIdentity.telephone}">${siteIdentity.telephone}</a><a href="tel:${siteIdentity.secondaryTelephone}">${siteIdentity.secondaryTelephone}</a><a href="mailto:${siteIdentity.email}">${siteIdentity.email}</a><p>${escapeHtml(siteIdentity.address[locale])}</p></section>` : '');
  return `<div class="app-container public-site-shell">${navigation(locale, page.path)}<main id="main-content" class="public-page"><header class="public-editorial-hero"><div class="container public-editorial-hero__grid"><div class="public-editorial-hero__copy"><h1>${escapeHtml(copy.h1)}</h1><p>${escapeHtml(copy.summary)}</p></div>${page.service ? `<figure class="public-editorial-hero__media"><img src="${escapeHtml(page.service.heroImage)}" width="800" height="800" alt="${escapeHtml(page.service[locale].heroAlt)}"></figure>` : ''}</div></header>${body}</main></div>`;
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
    graph.push({ '@type': 'Service', '@id': `${canonical}#service`, name: page[locale].h1, serviceType: page.service[locale].serviceType || page[locale].h1, description: copy.description, url: canonical, image: absoluteUrl(page.service.heroImage), inLanguage: locale === 'en' ? 'en-EG' : 'ar-EG', provider: { '@id': organizationId }, areaServed: organization.areaServed });
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
    .replace('</head>', `    ${head}\n    ${routeAssets('src/layouts/PublicLayout.jsx', page.path === '/' ? 'src/pages/HomePage.jsx' : 'src/pages/PublicPages.jsx')}\n  </head>`)
    .replace('<body>', `<body><noscript><img height="1" width="1" style="display:none" alt="" src="https://www.facebook.com/tr?id=${META_PIXEL_ID}&amp;ev=PageView&amp;noscript=1"></noscript>`)
    .replace('<div id="root"></div>', `<div id="root">${visiblePage(page, locale)}</div>`);
  if (page.path === '/') html = html.replace('</head>', '<link rel="preload" as="image" href="/hero-service-1-v2-tiny.webp" media="(max-width: 520px)" fetchpriority="high"><link rel="preload" as="image" href="/hero-service-1-v2-small.webp" media="(min-width: 521px)" fetchpriority="high"></head>');
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

const robots = `User-agent: *\nAllow: /\nDisallow: /login\nDisallow: /change-password\nDisallow: /reset-password\nDisallow: /dashboard\nDisallow: /p-\nDisallow: /erp/\nDisallow: /adminmt/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;
await fs.writeFile(path.join(distDirectory, 'robots.txt'), robots, 'utf8');

console.log(`Generated ${pages.length * 2} localized public pages, 404.html, sitemap.xml and robots.txt.`);
