import { lazy, Suspense, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, CalendarRange, Camera, ChevronDown, ChevronLeft, ChevronRight, Clapperboard,
  Code2, Mail, MapPin, Mic2, MonitorSmartphone, Palette, Phone, Send, Share2, Smartphone,
  Sparkles, WandSparkles,
} from 'lucide-react';
import SEO from '../components/SEO';
import PublicPortfolioGrid from '../components/PublicPortfolioGrid';
import { useData } from '../store/DataContext';
import { getPublicService, publicServiceCatalog, publicServiceGroups } from '../data/publicServiceCatalog';
import { companyPhoneTel, normalizeCompanyPhone } from '../lib/companyContact';
import { localizePublicPath } from '../lib/publicRoutes';
import { organizationId, SITE_URL, siteIdentity } from '../seo/siteIdentity';
import { EDUCATIONAL_BOOKING_IMAGE } from '../data/educationalBooking';
import { STUDIO_CATEGORIES, STUDIO_GALLERIES } from '../data/studioGalleries';
export { default as ServiceDetailPage } from './ServiceDetailDesign';

const icons = { CalendarRange, Camera, Clapperboard, Code2, Mic2, MonitorSmartphone, Palette, Share2, Smartphone, WandSparkles };
const StudioShowcase = lazy(() => import('../components/StudioShowcase'));
const publicPath = (value, isEnglish) => localizePublicPath(value, isEnglish ? 'en' : 'ar');
const publicUrl = (value, isEnglish) => `${SITE_URL}${publicPath(value, isEnglish)}`;

function DirectionArrow({ isEnglish }) { return isEnglish ? <ArrowRight aria-hidden="true" /> : <ArrowLeft aria-hidden="true" />; }
function CrumbArrow({ isEnglish }) { return isEnglish ? <ChevronRight aria-hidden="true" /> : <ChevronLeft aria-hidden="true" />; }

function PageHero({ title, summary, eyebrow, actions, image, imageAlt, className = '', children }) {
  const words = title.split(' '); const finalWord = words.pop();
  return <header className={`public-editorial-hero reference-hero ${image ? 'reference-hero--photo' : 'reference-hero--center'} ${className}`.trim()}>
    <div className="container public-editorial-hero__grid">
      <div className="public-editorial-hero__copy">{eyebrow && <span className="public-eyebrow">{eyebrow}</span>}<h1>{words.length > 0 && words.join(' ') + ' '}<span className="reference-hero__gold">{finalWord}</span></h1><p>{summary}</p>{actions && <div className="public-hero-actions">{actions}</div>}</div>
      {image && <figure className="public-editorial-hero__media"><img src={image} alt={imageAlt || ''} width="960" height="640" loading="eager" fetchPriority="high" decoding="async" /></figure>}
      {children}
    </div>
  </header>;
}

export function ServicesIndexPage() {
  const { i18n } = useTranslation(); const isEnglish = String(i18n.language).startsWith('en');
  const copy = isEnglish ? {
    eyebrow: 'Our services', title: 'Production, marketing and technology', summary: 'Explore each service and its deliverables, or tell us what your project needs.',
    intro: 'Explore services', cta: 'Need a specific scope?', ctaText: 'Tell us about your project.', contact: 'Contact us',
  } : {
    eyebrow: 'خدماتنا', title: 'الإنتاج والتسويق والتقنية', summary: 'اطّلع على كل خدمة وما نقدمه فيها، أو احكِ لنا احتياج مشروعك.',
    intro: 'استكشف الخدمات', cta: 'تحتاج نطاقًا مخصصًا؟', ctaText: 'احكِ لنا عن مشروعك.', contact: 'تواصل معنا',
  };
  return <main id="main-content" className="public-page reference-page reference-services">
    <SEO title={isEnglish ? 'Production, Marketing and Technology Services' : 'خدمات الإنتاج والتسويق والتقنية'} description={copy.summary} url="/services" section="services" />
    <PageHero eyebrow={copy.eyebrow} title={copy.title} summary={copy.summary} image="/brand/gold/services/commercial-video-production.webp" imageAlt={isEnglish ? 'Illustration of a commercial filming setup' : 'صورة توضيحية لتجهيزات تصوير الإعلانات'} />
    <section className="public-service-index container" aria-label={copy.intro}>
      {publicServiceGroups.map(group => <div className={`public-service-group reference-service-group reference-service-group--${group.id}`} key={group.id}><h3>{isEnglish ? group.en : group.ar}</h3><div>
        {publicServiceCatalog.filter(service => service.group === group.id).map((service) => { const Icon = icons[service.icon] || Sparkles; const localized = isEnglish ? service.en : service.ar; const serviceNumber = publicServiceCatalog.indexOf(service) + 1; return <Link className="public-service-row" to={publicPath(`/services/${service.slug}`, isEnglish)} key={service.slug}>
          <img className="reference-service-row__photo" src={service.heroImage} alt="" width="480" height="320" loading="lazy" decoding="async"/><span className="public-service-row__number">{String(serviceNumber).padStart(2, '0')}</span><Icon aria-hidden="true"/><div><h4>{localized.title}</h4><p>{localized.cardSummary}</p></div><DirectionArrow isEnglish={isEnglish}/>
        </Link>; })}
      </div></div>)}
    </section>
    <section className="public-inline-cta container"><div><span>{copy.cta}</span><h2>{copy.ctaText}</h2></div><Link to={publicPath('/contact', isEnglish)} className="public-solid-button">{copy.contact}<DirectionArrow isEnglish={isEnglish}/></Link></section>
  </main>;
}

export function AboutPage() {
  const { i18n } = useTranslation(); const isEnglish = String(i18n.language).startsWith('en');
  const copy = isEnglish ? {
    eyebrow: 'About us', title: 'Multi Task Agency', summary: 'Media production, marketing and digital development from 6th of October City.',
    story: 'We film and produce content, manage social media, design visual identities and build websites and software. Each project starts with an agreed scope and deliverables.',
    difference: 'How we work', values: ['A clear scope before production', 'Agreed deliverables and review stages', 'A client dashboard for bookings and project updates'], cta: 'Explore services',
  } : {
    eyebrow: 'من نحن', title: 'Multi Task Agency', summary: 'إنتاج إعلامي وتسويق وتطوير رقمي من مدينة 6 أكتوبر.',
    story: 'نصور وننتج المحتوى، وندير منصات التواصل، ونصمم الهويات البصرية، ونطور المواقع والبرمجيات. يبدأ كل مشروع بنطاق ومخرجات متفق عليها.',
    difference: 'طريقة عملنا', values: ['نطاق واضح قبل التنفيذ', 'مخرجات ومراحل مراجعة متفق عليها', 'لوحة عميل لمتابعة الحجوزات والمشروعات'], cta: 'استكشف الخدمات',
  };
  const schema = { '@context': 'https://schema.org', '@type': 'AboutPage', name: copy.title, description: copy.summary, url: publicUrl('/about', isEnglish), about: { '@id': organizationId } };
  return <main id="main-content" className="public-page reference-page reference-about"><SEO title={isEnglish ? 'About Multi Task Agency' : 'عن Multi Task Agency'} description={copy.summary} url="/about" section="about" schema={schema}/><PageHero eyebrow={copy.eyebrow} title={copy.title} summary={copy.summary} image="/brand/gold/services/ai-video-production.webp" imageAlt={isEnglish ? 'Illustrative content production workspace' : 'صورة توضيحية لمساحة إنتاج المحتوى'} />
    <section className="public-about-story reference-glass container"><div><span className="public-section-number">01</span><h2>{isEnglish ? 'What we do' : 'ماذا نقدم'}</h2><p>{copy.story}</p></div></section>
    <section className="public-about-difference"><div className="container"><div className="public-section-heading"><span>02</span><h2>{copy.difference}</h2></div><div className="public-principles">{copy.values.map((value, index) => <article key={value}><span>{String(index + 1).padStart(2, '0')}</span><h3>{value}</h3></article>)}</div></div></section>
    <section className="public-inline-cta container"><div><h2>{isEnglish ? 'See what we offer' : 'اطّلع على خدماتنا'}</h2></div><Link to={publicPath('/services', isEnglish)} className="public-solid-button">{copy.cta}<DirectionArrow isEnglish={isEnglish}/></Link></section>
  </main>;
}

export function ContactPage() {
  const { i18n } = useTranslation(); const isEnglish = String(i18n.language).startsWith('en'); const { siteData } = useData(); const location = useLocation();
  const requestedSlug = new URLSearchParams(location.search).get('service') || location.state?.service || ''; const initialService = getPublicService(requestedSlug) ? requestedSlug : '';
  const [service, setService] = useState(initialService); const contact = siteData.contact || {}; const receivingEmail = siteData.formSettings?.receivingEmail || contact.email || 'info@multitaskagency.com';
  const primaryPhone = normalizeCompanyPhone(contact.phone); const secondaryPhone = normalizeCompanyPhone(contact.phone2);
  const copy = isEnglish ? { home: 'Home', eyebrow: 'Contact', title: 'Contact us', summary: 'Call us or send your project details.', address: 'Studio address', primary: 'Primary phone', secondary: 'Secondary phone', emailLabel: 'Email', form: 'Project inquiry', name: 'Name', email: 'Email', phone: 'Phone', choose: 'Choose a service', message: 'What are you planning?', send: 'Prepare email', map: 'Studio location' } : { home: 'الرئيسية', eyebrow: 'تواصل', title: 'تواصل معنا', summary: 'اتصل بنا أو أرسل تفاصيل مشروعك.', address: 'عنوان الاستديو', primary: 'الهاتف الرئيسي', secondary: 'هاتف إضافي', emailLabel: 'البريد الإلكتروني', form: 'استفسار عن مشروع', name: 'الاسم', email: 'البريد الإلكتروني', phone: 'رقم الهاتف', choose: 'اختر الخدمة', message: 'ما الذي تخطط له؟', send: 'تجهيز الرسالة', map: 'موقع الاستديو' };
  const submit = event => { event.preventDefault(); const form = new FormData(event.currentTarget); const selected = getPublicService(form.get('Service')); const subject = isEnglish ? `Project inquiry — ${selected?.en.title || siteIdentity.name}` : `استفسار مشروع — ${selected?.ar.title || siteIdentity.name}`; const body = [`${copy.name}: ${form.get('Name')}`, `${copy.email}: ${form.get('Email')}`, `${copy.phone}: ${form.get('Phone') || '-'}`, `${copy.choose}: ${selected ? (isEnglish ? selected.en.title : selected.ar.title) : '-'}`, '', String(form.get('Message') || '')].join('\n'); window.location.href = `mailto:${encodeURIComponent(receivingEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`; };
  const schema = { '@context': 'https://schema.org', '@type': 'ContactPage', name: copy.title, description: copy.summary, url: publicUrl('/contact', isEnglish), mainEntity: { '@id': organizationId } };
  return <main id="main-content" className="public-page public-contact-page reference-page reference-contact"><SEO title={isEnglish ? 'Contact Multi Task Agency in 6th of October' : 'تواصل مع Multi Task Agency في 6 أكتوبر'} description={copy.summary} url="/contact" schema={schema}/>
    <nav className="public-breadcrumb container" aria-label={isEnglish ? 'Breadcrumb' : 'مسار الصفحة'}><Link to={publicPath('/', isEnglish)}>{copy.home}</Link><CrumbArrow isEnglish={isEnglish}/><span aria-current="page">{isEnglish ? 'Contact' : 'تواصل معنا'}</span></nav>
    <PageHero className="public-contact-hero" eyebrow={copy.eyebrow} title={copy.title} summary={copy.summary} showMark={false}/>
    <section className="public-contact-workspace reference-contact-layout container">
    <aside className="public-contact-info reference-contact-panel" aria-label={isEnglish ? 'Company contact information' : 'بيانات التواصل مع الشركة'}>
      {contact.address && <a className="public-contact-info__item" href="#contact-map"><MapPin aria-hidden="true"/><span><small>{copy.address}</small><strong>{isEnglish ? contact.addressEn : contact.address}</strong></span></a>}
      {primaryPhone && <a className="public-contact-info__item" href={`tel:${companyPhoneTel(contact.phone)}`} aria-label={`${copy.primary}: ${primaryPhone}`} dir="ltr"><Phone aria-hidden="true"/><span><small>{copy.primary}</small><strong>{primaryPhone}</strong></span></a>}
      {secondaryPhone && <a className="public-contact-info__item" href={`tel:${companyPhoneTel(contact.phone2)}`} aria-label={`${copy.secondary}: ${secondaryPhone}`} dir="ltr"><Phone aria-hidden="true"/><span><small>{copy.secondary}</small><strong>{secondaryPhone}</strong></span></a>}
      <a className="public-contact-info__item" href={`mailto:${receivingEmail}`} aria-label={`${copy.emailLabel}: ${receivingEmail}`} dir="ltr"><Mail aria-hidden="true"/><span><small>{copy.emailLabel}</small><strong>{receivingEmail}</strong></span></a>
    </aside>

      <div className="public-contact-form"><h2>{copy.form}</h2><form onSubmit={submit}><label>{copy.name}<input name="Name" required autoComplete="name"/></label><label>{copy.email}<input name="Email" type="email" required autoComplete="email" dir="ltr"/></label><label>{copy.phone}<input name="Phone" type="tel" autoComplete="tel" dir="ltr"/></label><label>{copy.choose}<select name="Service" value={service} onChange={event => setService(event.target.value)}><option value="">—</option>{publicServiceCatalog.map(item => <option key={item.slug} value={item.slug}>{(isEnglish ? item.en : item.ar).title}</option>)}</select></label><label className="public-contact-form__message">{copy.message}<textarea name="Message" rows="5" required/></label><button className="public-solid-button" type="submit">{copy.send}<Send/></button></form></div>

    </section>
      <aside id="contact-map" className="public-contact-map-card reference-glass container"><header><MapPin aria-hidden="true"/><h2>{copy.map}</h2></header><iframe src="https://maps.google.com/maps?q=Multi%20Task%20Studio&t=&z=15&ie=UTF8&iwloc=&output=embed" title={isEnglish ? 'Multi Task Agency studio location' : 'موقع استديو Multi Task Agency'} loading="lazy" referrerPolicy="no-referrer-when-downgrade" /></aside>
  </main>;
}

export function PortfolioPage() {
  const { i18n } = useTranslation(); const isEnglish = String(i18n.language).startsWith('en'); const { siteData } = useData(); const categories = siteData.portfolioCategories || []; const [filter, setFilter] = useState('all');
  const items = useMemo(() => filter === 'all' ? (siteData.portfolio || []) : (siteData.portfolio || []).filter(item => item.category === filter), [filter, siteData.portfolio]);
  const summary = isEnglish ? 'Selected projects in video, design and digital work.' : 'مشروعات مختارة في الفيديو والتصميم والعمل الرقمي.';
  return <main id="main-content" className="public-page reference-page reference-portfolio"><SEO title={isEnglish ? 'Multi Task Agency Portfolio' : 'نماذج أعمال Multi Task Agency'} description={summary} url="/portfolio" section="portfolio"/><PageHero eyebrow={isEnglish ? 'Portfolio' : 'أعمالنا'} title={isEnglish ? 'Selected work' : 'نماذج أعمالنا'} summary={summary} index="▶"/>
    <section className="public-portfolio-page container"><div className="public-filter-bar" aria-label={isEnglish ? 'Portfolio filters' : 'تصنيفات الأعمال'}><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>{isEnglish ? 'All work' : 'كل الأعمال'}</button>{categories.map(category => <button key={category.id} className={filter === category.id ? 'active' : ''} onClick={() => setFilter(category.id)}>{isEnglish ? category.nameEn : category.nameAr}</button>)}</div><PublicPortfolioGrid items={items} categories={categories} isEnglish={isEnglish} emptyTitle={isEnglish ? 'No work in this filter yet' : 'لا توجد أعمال في هذا التصنيف بعد'} emptyText={isEnglish ? 'Choose another category or discuss a relevant project.' : 'اختر تصنيفًا آخر أو ناقش معنا مشروعًا مناسبًا.'}/></section>
  </main>;
}

export function StudiosPage() {
  const { i18n } = useTranslation(); const isEnglish = String(i18n.language).startsWith('en'); const { siteData } = useData();
  const [activeStudio, setActiveStudio] = useState('october');
  const tabs = siteData.studioCategories?.length ? siteData.studioCategories : STUDIO_CATEGORIES;
  const firstPhoto = siteData.studio?.october?.[0] || STUDIO_GALLERIES.october[0];
  const summary = isEnglish ? 'View our October, Lebanon Square and New Cairo studios.' : 'تعرّف على استديوهات أكتوبر وميدان لبنان والقاهرة الجديدة.';
  return <main id="main-content" className="public-page reference-page reference-studios"><SEO title={isEnglish ? 'Professional Studios in 6th of October' : 'استديوهات تصوير في 6 أكتوبر'} description={summary} url="/studios" section="studio"/>
    <PageHero eyebrow={isEnglish ? 'Studios' : 'الاستديوهات'} title={isEnglish ? 'Choose your studio' : 'اختر الاستديو المناسب'} summary={summary} image={firstPhoto.url || STUDIO_GALLERIES.october[0].url} imageAlt={(isEnglish ? firstPhoto.altEn : firstPhoto.alt) || (isEnglish ? 'October Studio' : 'استديو أكتوبر')}/>
    <section className="reference-studio-locations container" aria-label={isEnglish ? 'Studios' : 'الاستديوهات'}>{tabs.map(tab => <a key={tab.id} href="#studio" className={`reference-studio-location reference-glass${activeStudio === tab.id ? ' is-selected' : ''}`} onClick={event => { event.preventDefault(); setActiveStudio(tab.id); document.getElementById('studio')?.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); }}><MapPin aria-hidden="true"/><h2>{isEnglish ? tab.nameEn : tab.nameAr}</h2><ChevronDown aria-hidden="true"/></a>)}</section>
    <Suspense fallback={<div className="public-section-loading" role="status">{isEnglish ? 'Loading studios…' : 'جاري تحميل الاستديوهات…'}</div>}><StudioShowcase selectedCategory={activeStudio} onCategoryChange={setActiveStudio}/></Suspense>
    <section className="public-inline-cta reference-studio-cta container"><img src={EDUCATIONAL_BOOKING_IMAGE.url} alt={isEnglish ? EDUCATIONAL_BOOKING_IMAGE.altEn : EDUCATIONAL_BOOKING_IMAGE.alt} width="1600" height="900" loading="lazy" decoding="async"/><div><h2>{isEnglish ? 'Tell us your session needs' : 'احكِ لنا تفاصيل جلستك'}</h2><Link to={publicPath('/contact?service=studio-content-production', isEnglish)} className="public-solid-button">{isEnglish ? 'Ask about availability' : 'اسأل عن المواعيد'}<DirectionArrow isEnglish={isEnglish}/></Link></div></section>
  </main>;
}

export function PublicNotFound() {
  const { i18n } = useTranslation(); const isEnglish = String(i18n.language).startsWith('en');
  return <main id="main-content" className="public-page public-not-found"><SEO title={isEnglish ? 'Page not found' : 'الصفحة غير موجودة'} description={isEnglish ? 'The requested page could not be found.' : 'تعذر العثور على الصفحة المطلوبة.'} url="/404" noIndex/><span>404</span><h1>{isEnglish ? 'This page is not part of the current site' : 'هذه الصفحة غير موجودة في الموقع الحالي'}</h1><p>{isEnglish ? 'Return home, explore the services, or contact the team.' : 'يمكنك العودة للرئيسية أو استكشاف الخدمات أو التواصل مع الفريق.'}</p><div><Link className="public-solid-button" to={publicPath('/', isEnglish)}>{isEnglish ? 'Home' : 'الرئيسية'}</Link><Link className="public-ghost-button" to={publicPath('/services', isEnglish)}>{isEnglish ? 'Services' : 'الخدمات'}</Link><Link className="public-ghost-button" to={publicPath('/contact', isEnglish)}>{isEnglish ? 'Contact' : 'تواصل معنا'}</Link></div></main>;
}
