import fs from 'node:fs/promises';
import { getHeaderSocialLinks } from '../src/data/publicHeader.js';
import { META_PIXEL_ID } from '../src/lib/metaPixel.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AL_MAJD_SOCIAL_PARTNER } from '../src/data/alMajdSocialPartner.js';
import { getServicePortfolio, publicServiceCatalog, publicServiceGroups } from '../src/data/publicServiceCatalog.js';
import { serviceVisualLayouts } from '../src/data/serviceVisualLayouts.js';
import { aiVideoPlatforms } from '../src/data/aiVideoPlatforms.js';
import { podcastStudioGallery, podcastStudioGalleryCopy } from '../src/data/podcastStudioGallery.js';
import { educationalServiceBookingCopy } from '../src/data/educationalServiceBooking.js';
import { STUDIO_CATEGORIES, STUDIO_GALLERIES } from '../src/data/studioGalleries.js';
import { VERIFIED_PORTFOLIO } from '../src/data/verifiedPortfolio.js';
import { EDUCATIONAL_BOOKING_COPY, EDUCATIONAL_BOOKING_IMAGE, EDUCATIONAL_BOOKING_SERVICE, EDUCATIONAL_BOOKING_TARGET } from '../src/data/educationalBooking.js';
import { CLIENT_APP_DOWNLOAD_URL } from '../src/data/clientApp.js';
import { goldHeroCopy, goldServiceOrder } from '../src/data/goldHero.js';
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
      h1: `${goldHeroCopy.ar.title1} ${goldHeroCopy.ar.title2}`,
      summary: goldHeroCopy.ar.subtitle,
    },
    en: {
      title: 'Media Production, Digital Marketing & Technology in Giza',
      description: 'Multi Task Agency provides media production, content, digital marketing, web and software services from 6th of October City, Giza.',
      eyebrow: 'Production, marketing and digital development',
      h1: `${goldHeroCopy.en.title1} ${goldHeroCopy.en.title2}`,
      summary: goldHeroCopy.en.subtitle,
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

const headerSocialIcons = {
  facebook: '<path d="M14 21v-8h3l.5-4H14V7c0-1.2.3-2 2-2h2V1.5a24 24 0 0 0-3-.2c-3 0-5 1.8-5 5.2V9H7v4h3v8z"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.2"/>',
  linkedin: '<circle cx="4.5" cy="4.5" r="2"/><path d="M3 8h3v13H3zm6 0h3v1.8c1-1.4 2.2-2.1 4-2.1 3.1 0 5 1.8 5 5.5V21h-3.5v-7.1c0-2-.7-3.1-2.3-3.1-1.8 0-2.7 1.2-2.7 3.5V21H9z"/>',
  youtube: '<path d="M21.5 6.5c-.3-1-1.1-1.8-2.1-2C17.6 4 12 4 12 4s-5.6 0-7.4.5c-1 .2-1.8 1-2.1 2C2 8.3 2 12 2 12s0 3.7.5 5.5c.3 1 1.1 1.8 2.1 2C6.4 20 12 20 12 20s5.6 0 7.4-.5c1-.2 1.8-1 2.1-2 .5-1.8.5-5.5.5-5.5s0-3.7-.5-5.5z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="m10 8 6 4-6 4z"/>',
  tiktok: '<path d="M15 2h3c.2 2.1 1.4 3.6 4 4v3a9 9 0 0 1-4-1.2V16a6 6 0 1 1-6-6v3a3 3 0 1 0 3 3z"/>',
  x: '<path d="M3 3h5.1l4.8 6.4L18.5 3H21l-7 8.2L22 21h-5.1l-5.5-7.2L5.2 21H2.7l7.4-8.8zm3.4 1.8L17.8 19.2h1.8L8.2 4.8z"/>',
};

const navigation = (locale, currentPath) => {
  const en = locale === 'en';
  const links = en
    ? [['Home', '/'], ['About', '/about/'], ['Services', '/services/'], ['Portfolio', '/portfolio/'], ['Contact', '/contact/']]
    : [['الرئيسية', '/'], ['من نحن', '/about/'], ['خدماتنا', '/services/'], ['أعمالنا', '/portfolio/'], ['تواصل معنا', '/contact/']];
  const otherLocale = en ? 'ar' : 'en';
  const mailIcon = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/></svg>';
  const phoneIcon = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.96.35 1.9.69 2.79a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.83.57 2.79.69A2 2 0 0 1 22 16.92z"/></svg>';
  return `<header class="top-bar brand-header"><div class="header-utility"><div class="header-utility__social"><span class="header-utility__label">${en ? 'Follow us' : 'تابعنا على'}</span>${getHeaderSocialLinks().map(item => `<a href="${escapeHtml(item.href)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(item.label)}"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${headerSocialIcons[item.key]}</svg></a>`).join('')}</div><div class="header-utility__contact"><a class="header-utility__email" href="mailto:${siteIdentity.email}" aria-label="${en ? 'Email' : 'البريد الإلكتروني'}: ${siteIdentity.email}">${mailIcon}<span dir="ltr">${siteIdentity.email}</span></a><a href="tel:${siteIdentity.telephone}">${phoneIcon}<span dir="ltr">01114466646</span></a></div></div><div class="header-main"><div class="top-bar-right"><a class="logo-link" href="${languagePath(locale, '/')}"><img class="header-logo" src="/brand/gold/mt-agency-logo.webp" width="600" height="485" alt="Multi Task Agency"></a><a class="lang-btn" href="${languagePath(otherLocale, currentPath)}" hreflang="${otherLocale === 'en' ? 'en-EG' : 'ar-EG'}">${otherLocale.toUpperCase()}</a><a class="mobile-menu-btn" href="${languagePath(locale, '/services/')}" aria-label="${en ? 'Browse services' : 'تصفح الخدمات'}"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg></a></div><div class="mobile-nav-wrapper"><div class="top-bar-center"><nav class="header-nav" aria-label="${en ? 'Main navigation' : 'التنقل الرئيسي'}"><ul class="nav-list">${links.map(([label, href]) => `<li><a class="nav-link${currentPath === href || (href === '/services/' && currentPath.startsWith('/services/')) ? ' active' : ''}" href="${languagePath(locale, href)}">${escapeHtml(label)}</a></li>`).join('')}</ul></nav></div><div class="top-bar-left"><a href="${languagePath(locale, '/contact/')}" class="header-quote-btn">${en ? 'Request a quote' : 'طلب عرض سعر'}</a><a href="/login" class="btn-secondary login-btn">${en ? 'Login' : 'تسجيل الدخول'}</a></div></div></div></header>`;
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

const decisionGuideContent = (copy, number, layout) => {
  const content = copy.decisionGuide;
  if (!content) return '';
  return `<section class="public-decision-guide sd-decision-guide" aria-labelledby="decision-guide-title"><div class="container"><header class="public-decision-guide__header"><span class="public-section-number">${number}</span><div><h2 id="decision-guide-title">${escapeHtml(content.title)}</h2></div></header><div class="public-decision-guide__options">${content.options.slice(0, 3).map((item, index) => `<article>${layout?.decisionImages?.[index] ? `<div class="sd-decision-photo" aria-hidden="true">${referencePhoto(layout.decisionImages[index])}</div>` : ''}<div class="sd-decision-body"><span>${String(index + 1).padStart(2, '0')}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p></div></article>`).join('')}</div></div></section>`;
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
  const education = page.service.slug === 'studio-content-production';
  const bookingCopy = educationalServiceBookingCopy[locale];
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
  ${decisionGuideContent(copy, decisionNumber, serviceVisualLayouts[page.service.slug])}
  ${alMajdPartnerContent(page.service, locale, partnerNumber)}
  ${verifiedWorkContent(page.service, locale, workNumber)}
  <section class="public-faq container"><div class="public-section-heading"><span>${faqNumber}</span><h2>${sectionTitle('قبل الاتفاق', 'Before you book')}</h2></div><div>${copy.faq.map(([question, answer]) => `<details><summary>${escapeHtml(question)}</summary><p>${escapeHtml(answer)}</p></details>`).join('')}</div></section>
  <section class="public-inline-cta container"><h2>${education ? escapeHtml(bookingCopy.finalTitle) : sectionTitle('احكِ لنا احتياجك', 'Tell us what you need')}</h2><a class="public-solid-button" href="${education ? EDUCATIONAL_BOOKING_TARGET : languagePath(locale, `/contact/?service=${page.service.slug}`)}">${education ? escapeHtml(bookingCopy.action) : sectionTitle('اطلب عرض سعر', 'Request a quote')}</a></section>`;
};

const goldHomeHero = locale => {
  const copy = goldHeroCopy[locale];
  const slides = goldServiceOrder.map(slug => publicServiceCatalog.find(service => service.slug === slug)).filter(Boolean);
  return `<section id="home" class="hero-section gold-hero"><div class="gold-hero__decoration" aria-hidden="true"><i></i><i></i><i></i></div><div class="container gold-hero__intro"><h1 class="gold-hero__title">${escapeHtml(copy.title1)} <span class="gold-hero__highlight">${escapeHtml(copy.title2)}</span></h1><p class="gold-hero__subtitle">${escapeHtml(copy.subtitle)}</p><p class="gold-hero__location">${escapeHtml(copy.location)}</p><div class="gold-hero__actions"><a class="btn-primary" href="#contact">${escapeHtml(copy.primary)}</a><a class="btn-secondary" href="#portfolio">${escapeHtml(copy.secondary)}</a></div></div><section class="gold-service-carousel" aria-label="${locale === 'en' ? 'Our services' : 'خدماتنا'}"><div class="gold-service-carousel__viewport"><div class="gold-service-carousel__track" dir="ltr">${slides.map((service,index) => `<a class="gold-service-slide" href="${languagePath(locale, '/services/'+service.slug+'/')}" dir="${locale === 'en' ? 'ltr' : 'rtl'}"><img src="/brand/gold/services/${service.slug}.webp" srcset="/brand/gold/services/${service.slug}-small.webp 640w, /brand/gold/services/${service.slug}.webp 960w" sizes="(max-width: 640px) 90vw, (max-width: 1024px) 46vw, 32vw" width="960" height="640" alt="${escapeHtml(service[locale].heroAlt)}" loading="${index < 3 ? 'eager' : 'lazy'}" decoding="async"><span class="gold-service-slide__caption"><span>${escapeHtml(service[locale].navLabel)}</span></span></a>`).join('')}</div></div></section></section>`;
};

const referencePhoto = (src, alt = '', eager = false) => `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" width="960" height="640" loading="${eager ? 'eager' : 'lazy'}" decoding="async">`;
const highlightedTitle = (title, className = 'reference-hero__gold') => {
  const words = title.split(' '); const last = words.pop();
  return `${escapeHtml(words.join(' '))}${words.length ? ' ' : ''}<span class="${className}">${escapeHtml(last)}</span>`;
};
const referenceHero = (copy, image = '') => `<header class="public-editorial-hero reference-hero reference-hero--${image ? 'photo' : 'center'}"><div class="container public-editorial-hero__grid"><div class="public-editorial-hero__copy"><span class="public-eyebrow">${escapeHtml(copy.eyebrow)}</span><h1>${highlightedTitle(copy.h1)}</h1><p>${escapeHtml(copy.summary)}</p></div>${image ? `<figure class="public-editorial-hero__media">${referencePhoto(image, copy.h1, true)}</figure>` : ''}</div></header>`;
const referenceServices = locale => `<section class="public-service-index container" aria-label="${locale === 'en' ? 'Explore services' : 'استكشف الخدمات'}">${publicServiceGroups.map(group => `<div class="public-service-group reference-service-group reference-service-group--${group.id}"><h3>${escapeHtml(group[locale])}</h3><div>${publicServiceCatalog.filter(service => service.group === group.id).map(service => `<a class="public-service-row" href="${languagePath(locale, '/services/'+service.slug+'/')}"><img class="reference-service-row__photo" src="${service.heroImage}" alt="" width="480" height="320" loading="lazy" decoding="async"><span class="public-service-row__number">${String(publicServiceCatalog.indexOf(service)+1).padStart(2,'0')}</span><div><h4>${escapeHtml(service[locale].title)}</h4><p>${escapeHtml(service[locale].cardSummary)}</p></div></a>`).join('')}</div></div>`).join('')}</section>`;
const aboutReference = locale => {
  const en = locale === 'en';
  const values = en ? ['A clear scope before production','Agreed deliverables and review stages','A client dashboard for bookings and project updates'] : ['نطاق واضح قبل التنفيذ','مخرجات ومراحل مراجعة متفق عليها','لوحة عميل لمتابعة الحجوزات والمشروعات'];
  const story = en ? 'We film and produce content, manage social media, design visual identities and build websites and software. Each project starts with an agreed scope and deliverables.' : 'نصور وننتج المحتوى، وندير منصات التواصل، ونصمم الهويات البصرية، ونطور المواقع والبرمجيات. يبدأ كل مشروع بنطاق ومخرجات متفق عليها.';
  return `<section class="public-about-story reference-glass container"><div><span class="public-section-number">01</span><h2>${en ? 'What we do' : 'ماذا نقدم'}</h2><p>${escapeHtml(story)}</p></div></section><section class="public-about-difference"><div class="container"><div class="public-section-heading"><span>02</span><h2>${en ? 'How we work' : 'طريقة عملنا'}</h2></div><div class="public-principles">${values.map((value,index)=>`<article><span>${String(index+1).padStart(2,'0')}</span><h3>${escapeHtml(value)}</h3></article>`).join('')}</div></div></section>`;
};
const portfolioReference = locale => `<section class="public-portfolio-page container"><div class="public-work-grid public-seo-work-list">${VERIFIED_PORTFOLIO.map(item => {
  const title = locale === 'en' ? (item.titleEn || item.title) : item.title;
  const href = item.projectUrl || item.embedUrl;
  return `<article class="public-work-item"><div class="public-work-media"><a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${referencePhoto(item.imageUrl || `https://img.youtube.com/vi/${(item.embedUrl || '').match(/(?:youtu\.be\/|youtube\.com\/(?:shorts\/|embed\/|watch\?v=))([\w-]{11})/)?.[1] || ''}/hqdefault.jpg`, title)}</a></div><div class="public-work-copy"><span>${escapeHtml(item.category)}</span><h3><a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(title)}</a></h3></div></article>`;
}).join('')}</div></section>`;
const studiosReference = locale => `<section class="reference-studio-locations container">${STUDIO_CATEGORIES.map(studio => `<a href="#studio-${studio.id}" class="reference-studio-location reference-glass"><h2>${escapeHtml(locale === 'en' ? studio.nameEn : studio.nameAr)}</h2></a>`).join('')}</section>${STUDIO_CATEGORIES.map(studio => `<section id="studio-${studio.id}" class="showcase-section container"><h2>${escapeHtml(locale === 'en' ? studio.nameEn : studio.nameAr)}</h2><div class="showcase-grid">${STUDIO_GALLERIES[studio.id].map(image=>`<a class="showcase-item" href="${escapeHtml(image.url)}" aria-label="${escapeHtml(`${locale === 'en' ? 'View full photo' : 'عرض الصورة كاملة'}: ${locale === 'en' ? image.altEn : image.alt}`)}">${referencePhoto(image.url, locale === 'en' ? image.altEn : image.alt)}</a>`).join('')}</div></section>`).join('')}`;
const contactReference = locale => {
  const en = locale === 'en'; const field = (label, name, type = 'text', required = false) => `<label>${label}<input name="${name}" type="${type}"${required ? ' required' : ''}></label>`;
  return `<section class="public-contact-workspace reference-contact-layout container"><aside class="public-contact-info reference-contact-panel" aria-label="${en ? 'Company contact information' : 'بيانات التواصل مع الشركة'}"><a class="public-contact-info__item" href="tel:${siteIdentity.telephone}" dir="ltr"><span><small>${en ? 'Primary phone' : 'الهاتف الرئيسي'}</small><strong>${siteIdentity.telephone}</strong></span></a><a class="public-contact-info__item" href="tel:${siteIdentity.secondaryTelephone}" dir="ltr"><span><small>${en ? 'Secondary phone' : 'هاتف إضافي'}</small><strong>${siteIdentity.secondaryTelephone}</strong></span></a><a class="public-contact-info__item" href="mailto:${siteIdentity.email}"><span><small>${en ? 'Email' : 'البريد الإلكتروني'}</small><strong>${siteIdentity.email}</strong></span></a><p>${escapeHtml(siteIdentity.address[locale])}</p></aside><div class="public-contact-form"><h2>${en ? 'Project inquiry' : 'استفسار عن مشروع'}</h2><form action="mailto:${siteIdentity.email}" method="post" enctype="text/plain">${field(en ? 'Name' : 'الاسم','Name','text',true)}${field(en ? 'Email' : 'البريد الإلكتروني','Email','email',true)}${field(en ? 'Phone' : 'رقم الهاتف','Phone','tel')}<label>${en ? 'Choose a service' : 'اختر الخدمة'}<select name="Service"><option value="">—</option>${publicServiceCatalog.map(service=>`<option value="${service.slug}">${escapeHtml(service[locale].title)}</option>`).join('')}</select></label><label class="public-contact-form__message">${en ? 'What are you planning?' : 'ما الذي تخطط له؟'}<textarea name="Message" rows="5" required></textarea></label><button class="public-solid-button" type="submit">${en ? 'Prepare email' : 'تجهيز الرسالة'}</button></form></div></section>`;
};
const serviceReferenceHero = (page, locale) => {
  const copy = page[locale]; const service = page.service; const layout = serviceVisualLayouts[service.slug]; const en = locale === 'en';
  const primaryHref = layout.variant === 'education' ? EDUCATIONAL_BOOKING_TARGET : languagePath(locale, '/contact/?service='+service.slug);
  const primaryLabel = layout.variant === 'education' ? educationalServiceBookingCopy[locale].action : en ? 'Request a quote' : 'اطلب عرض سعر';
  const work = getServicePortfolio(VERIFIED_PORTFOLIO, service); const hasPartner = service.slug === AL_MAJD_SOCIAL_PARTNER.serviceSlug;
  const image = layout.variant === 'web'
    ? `<div class="sd-hero__visual sd-device-composition"><div class="sd-desktop-screen"><div class="sd-window-chrome" aria-hidden="true"><i></i><i></i><i></i><b></b></div><img src="${escapeHtml(layout.desktopPreview)}" alt="${en ? 'QP Shoes Store — desktop view' : 'متجر قصر الملكة — عرض الكمبيوتر'}" width="1440" height="810" loading="eager" fetchpriority="high" decoding="async"></div><div class="sd-phone-screen" aria-hidden="true"><img src="${escapeHtml(layout.mobilePreview)}" alt="" width="390" height="780" loading="eager" decoding="async"></div></div>`
    : layout.variant === 'software'
      ? `<figure class="sd-hero__visual sd-software-composition"><div class="sd-software-window"><img src="${escapeHtml(layout.desktopPreview)}" alt="${en ? 'Illustrative project management app on desktop' : 'نموذج واجهة تطبيق إدارة المشاريع على الكمبيوتر'}" width="1440" height="900" loading="eager" fetchpriority="high" decoding="async"></div><div class="sd-software-phone"><img src="${escapeHtml(layout.mobilePreview)}" alt="${en ? 'Illustrative mobile app for projects and tasks' : 'نموذج تطبيق موبايل لمتابعة المشاريع والمهام'}" width="390" height="780" loading="eager" decoding="async"></div><figcaption class="sd-software-caption">${en ? 'Illustrative interface' : 'نموذج توضيحي'}</figcaption></figure>`
      : layout.variant === 'ai'
        ? `<figure class="sd-hero__visual sd-ai-cinema">${referencePhoto(layout.heroImage, en ? 'Imaginary advertising scene with a perfume bottle and floating golden ribbon between stone arches' : 'مشهد إعلاني تخيلي بزجاجة عطر وشريط ذهبي عائم بين أقواس حجرية', true)}<span class="sd-cinema-corner" aria-hidden="true"></span><div class="sd-ai-filmstrip" aria-hidden="true">${layout.heroFrames.map(src => referencePhoto(src)).join('')}</div><figcaption class="sd-ai-caption">${en ? 'Illustrative AI-generated scenes' : 'مشاهد توضيحية مولّدة بالذكاء الاصطناعي'}</figcaption></figure>`
        : `<figure class="sd-hero__visual sd-photo-${layout.variant}">${referencePhoto(layout.heroImage, service[locale].heroAlt, true)}</figure>`;
  return `<nav class="public-breadcrumb container sd-breadcrumb" aria-label="${en ? 'Breadcrumb' : 'مسار الصفحة'}"><a href="${languagePath(locale,'/')}">${en ? 'Home' : 'الرئيسية'}</a><span aria-hidden="true">‹</span><a href="${languagePath(locale,'/services/')}">${en ? 'Services' : 'الخدمات'}</a><span aria-hidden="true">‹</span><span aria-current="page">${escapeHtml(service[locale].navLabel)}</span></nav><header class="sd-hero sd-hero--${layout.variant}"><div class="sd-hero__curve" aria-hidden="true"></div>${layout.variant === 'commercial' ? `<img class="sd-hero__backdrop" src="${layout.heroImage}" alt="" width="960" height="640" loading="eager">` : ''}<div class="container sd-hero__grid"><div class="sd-hero__copy"><h1>${highlightedTitle(copy.h1,'sd-title-gold')}</h1><p>${escapeHtml(copy.summary)}</p><div class="public-hero-actions sd-hero__actions"><a class="public-solid-button" href="${escapeHtml(primaryHref)}">${escapeHtml(primaryLabel)}</a>${work.length || hasPartner ? `<a class="public-ghost-button" href="${hasPartner ? '#al-majd-work' : '#service-work'}">${en ? 'See our work' : 'شاهد أعمالنا'}</a>` : ''}</div></div>${layout.variant !== 'commercial' ? image : ''}</div></header>`;
};
const aiPlatformsContent = locale => {
  const en = locale === 'en';
  return `<section class="sd-ai-platforms container" aria-labelledby="ai-platforms-title"><header><h2 id="ai-platforms-title">${en ? 'Examples of AI video platforms' : 'أمثلة على منصات صناعة الفيديو'}</h2><p>${en ? 'Tools for generating scenes and digital avatars, with capabilities that vary by platform.' : 'أدوات لتوليد المشاهد والشخصيات الرقمية، وتختلف إمكانياتها حسب المنصة.'}</p></header><ul>${aiVideoPlatforms.map(platform => `<li><a href="${escapeHtml(platform.url)}" target="_blank" rel="noopener noreferrer"><strong dir="ltr">${escapeHtml(platform.name)}</strong><p>${escapeHtml(platform[locale])}</p><span>${en ? 'Official website' : 'الموقع الرسمي'} <span aria-hidden="true">↗</span></span></a></li>`).join('')}</ul></section>`;
};
const podcastGalleryContent = locale => {
  const copy = podcastStudioGalleryCopy[locale];
  return `<section id="podcast-studios" class="sd-podcast-gallery container" aria-labelledby="podcast-gallery-title"><header><h2 id="podcast-gallery-title">${escapeHtml(copy.title)}</h2><p>${escapeHtml(copy.intro)}</p></header><div class="sd-podcast-gallery__grid">${podcastStudioGallery.map(image => {
    const title = locale === 'en' ? image.enTitle : image.arTitle;
    const alt = locale === 'en' ? image.enAlt : image.arAlt;
    return `<a href="${escapeHtml(image.src)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(`${copy.viewPhoto}: ${title}`)}"><figure><div class="sd-podcast-gallery__media"><img src="${escapeHtml(image.src)}" alt="${escapeHtml(alt)}" width="${image.width}" height="${image.height}" loading="lazy" decoding="async"></div><figcaption><h3>${escapeHtml(title)}</h3><span>${escapeHtml(copy.viewPhoto)} <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 3h6v6M10 14 21 3M21 14v7H3V3h7"/></svg></span></figcaption></figure></a>`;
  }).join('')}</div></section>`;
};
const educationalServiceBookingContent = locale => {
  const copy = educationalServiceBookingCopy[locale];
  return `<section id="online-booking" class="sd-education-booking container" aria-labelledby="online-booking-title"><div class="sd-education-booking__panel"><header><h2 id="online-booking-title">${escapeHtml(copy.title)}</h2><p>${escapeHtml(copy.intro)}</p></header><ol class="sd-education-booking__steps">${copy.steps.map((step, index) => `<li><span aria-hidden="true">${String(index + 1).padStart(2, '0')}</span><div><h3>${escapeHtml(step.title)}</h3><p>${escapeHtml(step.description)}</p></div></li>`).join('')}</ol><div class="sd-education-booking__action"><a class="public-solid-button" href="${EDUCATIONAL_BOOKING_TARGET}">${escapeHtml(copy.action)}</a><p>${escapeHtml(copy.note)}</p></div></div></section>`;
};
const referenceServiceContent = (page, locale) => {
  const layout = serviceVisualLayouts[page.service.slug]; const text = page.service[locale]; const en = locale === 'en';
  const old = serviceContent(page, locale);
  const replacement = `<section class="sd-inclusions container" aria-labelledby="service-deliverables-title"><div class="public-section-heading"><span>01</span><h2 id="service-deliverables-title">${en ? 'What is included' : 'ما الذي تتضمنه الخدمة'}</h2></div><div class="sd-inclusions__layout sd-inclusions__layout--${layout.variant}"><ul class="sd-deliverable-cards">${text.deliverables.map((item,index)=>`<li>${layout.deliverableImages?.[index] ? referencePhoto(layout.deliverableImages[index]) : ''}<div class="sd-deliverable-card__body"><p>${escapeHtml(item)}</p></div></li>`).join('')}</ul></div></section>`;
  return old.replace(/<section class="public-split-section container">[\s\S]*?<\/section>/, replacement);
};
const visiblePage = (page, locale) => {
  const copy = page[locale];
  const shell = (classes, content) => `<div class="app-container public-site-shell">${navigation(locale,page.path)}<main id="main-content" class="${classes}">${content}</main></div>`;
  if (page.path === '/') return shell('public-home-page reference-home',goldHomeHero(locale)+educationalBookingContent(locale)+servicesList(locale));
  if (page.service) { const layout=serviceVisualLayouts[page.service.slug]; return shell(`public-page service-detail-page reference-service sd--${layout.variant}`,serviceReferenceHero(page,locale)+(layout.variant === 'education' ? educationalServiceBookingContent(locale) : '')+(layout.variant === 'ai' ? aiPlatformsContent(locale) : '')+(layout.variant === 'podcast' ? podcastGalleryContent(locale) : '')+referenceServiceContent(page,locale)); }
  const kind = page.path.split('/').filter(Boolean)[0];
  const image = kind === 'services' ? '/brand/gold/services/commercial-video-production.webp' : kind === 'about' ? '/brand/gold/services/ai-video-production.webp' : kind === 'studios' ? STUDIO_GALLERIES.october[0].url : '';
  const body = kind === 'services' ? referenceServices(locale) : kind === 'about' ? aboutReference(locale) : kind === 'portfolio' ? portfolioReference(locale) : kind === 'studios' ? studiosReference(locale) : kind === 'contact' ? contactReference(locale) : '';
  return shell(`public-page reference-page reference-${kind}`,referenceHero(copy,image)+body);
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
    .replace('<div id="root"></div>', `<div id="root">${visiblePage(page, locale).trimEnd()}</div>`);
  if (page.path === '/') html = html.replace('</head>', `<link rel="preload" as="image" href="/brand/gold/services/${goldServiceOrder[0]}.webp" imagesrcset="/brand/gold/services/${goldServiceOrder[0]}-small.webp 640w, /brand/gold/services/${goldServiceOrder[0]}.webp 960w" imagesizes="(max-width: 640px) 90vw, (max-width: 1024px) 46vw, 32vw" fetchpriority="high"></head>`);
  if (rootAlias) html = html.replace(`<link rel="canonical" href="${canonical}">`, `<link rel="canonical" href="${arabicUrl}">`);
  return html.replace(/\r/g, '').replace(/[ \t]+$/gm, '');
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
