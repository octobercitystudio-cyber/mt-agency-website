import { lazy, Suspense, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, CalendarRange, Camera, ChevronLeft, ChevronRight, Clapperboard,
  Code2, Mail, MapPin, Mic2, MonitorSmartphone, Palette, Phone, Send, Share2, Smartphone,
  Sparkles, WandSparkles,
} from 'lucide-react';
import SEO from '../components/SEO';
import PublicPortfolioGrid from '../components/PublicPortfolioGrid';
import { useData } from '../store/DataContext';
import { AL_MAJD_SOCIAL_PARTNER } from '../data/alMajdSocialPartner';
import { getPublicService, getServicePortfolio, publicServiceCatalog, publicServiceGroups } from '../data/publicServiceCatalog';
import { companyPhoneTel, companyPhoneWhatsApp, normalizeCompanyPhone } from '../lib/companyContact';
import { localizePublicPath } from '../lib/publicRoutes';
import { organizationId, SITE_URL, siteIdentity } from '../seo/siteIdentity';

const icons = { CalendarRange, Camera, Clapperboard, Code2, Mic2, MonitorSmartphone, Palette, Share2, Smartphone, WandSparkles };
const StudioShowcase = lazy(() => import('../components/StudioShowcase'));
const publicPath = (value, isEnglish) => localizePublicPath(value, isEnglish ? 'en' : 'ar');
const publicUrl = (value, isEnglish) => `${SITE_URL}${publicPath(value, isEnglish)}`;

function DirectionArrow({ isEnglish }) { return isEnglish ? <ArrowRight aria-hidden="true" /> : <ArrowLeft aria-hidden="true" />; }
function CrumbArrow({ isEnglish }) { return isEnglish ? <ChevronRight aria-hidden="true" /> : <ChevronLeft aria-hidden="true" />; }

function DecisionGuideSection({ content, number }) {
  if (!content) return null;
  return <section className="public-decision-guide" aria-labelledby="decision-guide-title"><div className="container">
    <header className="public-decision-guide__header"><span className="public-section-number">{number}</span><div><h2 id="decision-guide-title">{content.title}</h2></div></header>
    <div className="public-decision-guide__options">{content.options.slice(0, 3).map((item, index) => <article key={item.title}><span>{String(index + 1).padStart(2, '0')}</span><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
  </div></section>;
}

function AlMajdPartnerSection({ isEnglish, number }) {
  const partner = AL_MAJD_SOCIAL_PARTNER;
  const copy = isEnglish ? partner.en : partner.ar;
  return <section id="al-majd-work" className="public-success-partner" aria-labelledby="al-majd-partner-title">
    <div className="container">
      <header className="public-success-partner__header">
        <span className="public-success-partner__number">{number}</span>
        <div><span className="public-eyebrow">{copy.eyebrow}</span><h2 id="al-majd-partner-title"><a href={partner.website} target="_blank" rel="noopener noreferrer">{copy.name}<DirectionArrow isEnglish={isEnglish}/></a></h2><p>{copy.summary}</p><a className="public-success-partner__link" href={partner.website} target="_blank" rel="noopener noreferrer">{copy.websiteLabel}<DirectionArrow isEnglish={isEnglish}/></a></div>
      </header>
      <div className="public-success-partner__gallery">{partner.images.map(image => <figure key={image.id}>
        <img src={image.src} alt={isEnglish ? image.enAlt : image.arAlt} width={image.width} height={image.height} loading="lazy" decoding="async" />
        <figcaption>{isEnglish ? `Campaign design ${String(image.id).padStart(2, '0')}` : `تصميم إعلاني ${String(image.id).padStart(2, '0')}`}</figcaption>
      </figure>)}</div>
    </div>
  </section>;
}

function PageHero({ title, summary, index, actions, image, imageAlt, className = '', showMark = true, children }) {
  return <header className={`public-editorial-hero ${className}`.trim()}>
    <div className="container public-editorial-hero__grid">
      <div className="public-editorial-hero__copy"><h1>{title}</h1><p>{summary}</p>{actions && <div className="public-hero-actions">{actions}</div>}</div>
      {showMark && (image
        ? <figure className="public-editorial-hero__media"><img src={image} alt={imageAlt || ''} width="960" height="640" loading="eager" fetchPriority="high" decoding="async" /></figure>
        : <div className="public-editorial-hero__mark" aria-hidden="true"><span>{index || 'MT'}</span><i /></div>)}
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
  return <main id="main-content" className="public-page">
    <SEO title={isEnglish ? 'Production, Marketing and Technology Services' : 'خدمات الإنتاج والتسويق والتقنية'} description={copy.summary} url="/services" section="services" />
    <PageHero eyebrow={copy.eyebrow} title={copy.title} summary={copy.summary} index="10" />
    <section className="public-service-index container" aria-label={copy.intro}>
      {publicServiceGroups.map(group => <div className="public-service-group" key={group.id}><h3>{isEnglish ? group.en : group.ar}</h3><div>
        {publicServiceCatalog.filter(service => service.group === group.id).map((service) => { const Icon = icons[service.icon] || Sparkles; const localized = isEnglish ? service.en : service.ar; const serviceNumber = publicServiceCatalog.indexOf(service) + 1; return <Link className="public-service-row" to={publicPath(`/services/${service.slug}`, isEnglish)} key={service.slug}>
          <span className="public-service-row__number">{String(serviceNumber).padStart(2, '0')}</span><Icon aria-hidden="true"/><div><h4>{localized.title}</h4><p>{localized.cardSummary}</p></div><DirectionArrow isEnglish={isEnglish}/>
        </Link>; })}
      </div></div>)}
    </section>
    <section className="public-inline-cta container"><div><span>{copy.cta}</span><h2>{copy.ctaText}</h2></div><Link to={publicPath('/contact', isEnglish)} className="public-solid-button">{copy.contact}<DirectionArrow isEnglish={isEnglish}/></Link></section>
  </main>;
}

export function ServiceDetailPage() {
  const { slug } = useParams(); const service = getPublicService(slug); const { i18n } = useTranslation(); const isEnglish = String(i18n.language).startsWith('en'); const { siteData } = useData();
  if (!service) return <PublicNotFound />;
  const text = isEnglish ? service.en : service.ar; const work = getServicePortfolio(siteData.portfolio, service); const categories = siteData.portfolioCategories || [];
  const hasDecisionGuide = Boolean(text.decisionGuide); const hasSuccessPartner = service.slug === AL_MAJD_SOCIAL_PARTNER.serviceSlug;
  const workTarget = hasSuccessPartner ? '#al-majd-work' : '#service-work';
  let nextSection = 3; const sectionNumber = () => String(nextSection++).padStart(2, '0');
  const decisionSectionNumber = hasDecisionGuide ? sectionNumber() : null; const partnerSectionNumber = hasSuccessPartner ? sectionNumber() : null; const workSectionNumber = work.length ? sectionNumber() : null; const faqSectionNumber = text.faq.length ? sectionNumber() : null;
  const home = isEnglish ? 'Home' : 'الرئيسية'; const services = isEnglish ? 'Services' : 'الخدمات';
  const serviceUrl = publicUrl(`/services/${service.slug}`, isEnglish);
  const serviceSchema = { '@context': 'https://schema.org', '@type': 'Service', '@id': `${serviceUrl}#service`, name: text.title, serviceType: text.serviceType || text.title, description: text.metaDescription, url: serviceUrl, image: `${SITE_URL}${service.heroImage}`, inLanguage: isEnglish ? 'en-EG' : 'ar-EG', provider: { '@id': organizationId }, areaServed: [{ '@type': 'City', name: '6th of October City' }, { '@type': 'AdministrativeArea', name: 'Giza' }, { '@type': 'Country', name: 'Egypt' }] };
  const breadcrumbSchema = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: home, item: publicUrl('/', isEnglish) }, { '@type': 'ListItem', position: 2, name: services, item: publicUrl('/services', isEnglish) }, { '@type': 'ListItem', position: 3, name: text.title, item: publicUrl(`/services/${service.slug}`, isEnglish) }] };
  const faqSchema = text.faq.length ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: text.faq.map(([question, answer]) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } })) } : null;
  return <main id="main-content" className="public-page service-detail-page">
    <SEO title={text.seoTitle} description={text.metaDescription} image={`${SITE_URL}${service.heroImage}`} url={`/services/${service.slug}`} schema={[serviceSchema, breadcrumbSchema, faqSchema].filter(Boolean)} />
    <nav className="public-breadcrumb container" aria-label={isEnglish ? 'Breadcrumb' : 'مسار الصفحة'}><Link to={publicPath('/', isEnglish)}>{home}</Link><CrumbArrow isEnglish={isEnglish}/><Link to={publicPath('/services', isEnglish)}>{services}</Link><CrumbArrow isEnglish={isEnglish}/><span aria-current="page">{text.navLabel}</span></nav>
    <PageHero eyebrow={text.eyebrow} title={text.title} summary={text.heroSummary} image={service.heroImage} imageAlt={text.heroAlt} actions={<>
      <Link className="public-solid-button" to={publicPath(`/contact?service=${service.slug}`, isEnglish)} state={{ service: service.slug }}>{isEnglish ? 'Request a quote' : 'اطلب عرض سعر'}<DirectionArrow isEnglish={isEnglish}/></Link>
      {(work.length > 0 || hasSuccessPartner) && <a className="public-ghost-button" href={workTarget}>{isEnglish ? 'See our work' : 'شاهد أعمالنا'}</a>}
    </>} />
    <section className="public-split-section container">
      <div className="public-section-heading"><span>01</span><h2>{isEnglish ? 'What is included' : 'ما الذي تتضمنه الخدمة'}</h2></div>
      <div className="public-deliverables"><ul>{text.deliverables.map(item => <li key={item}>{item}</li>)}</ul></div>
    </section>
    <section className="public-suitable container"><div className="public-section-heading"><span>02</span><h2>{isEnglish ? 'Suitable for' : 'مناسبة لـ'}</h2></div><div>{text.suitableFor.map(item => <span key={item}>{item}</span>)}</div></section>
    <DecisionGuideSection content={text.decisionGuide} number={decisionSectionNumber} />
    {hasSuccessPartner && <AlMajdPartnerSection isEnglish={isEnglish} number={partnerSectionNumber} />}
    {work.length > 0 && <section id="service-work" className="public-work-section container"><div className="public-section-heading"><span>{workSectionNumber}</span><div><h2>{isEnglish ? 'Relevant work' : 'أعمال مرتبطة بالخدمة'}</h2></div></div>
      <PublicPortfolioGrid items={work} categories={categories} isEnglish={isEnglish}/>
    </section>}
    {text.faq.length > 0 && <section className="public-faq container"><div className="public-section-heading"><span>{faqSectionNumber}</span><h2>{isEnglish ? 'Before you book' : 'قبل الاتفاق'}</h2></div><div>{text.faq.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></section>}
    <section className="public-final-cta"><div className="container"><h2>{isEnglish ? 'Tell us what you need' : 'احكِ لنا احتياجك'}</h2><div><Link className="public-solid-button" to={publicPath(`/contact?service=${service.slug}`, isEnglish)}>{isEnglish ? 'Request a quote' : 'اطلب عرض سعر'}<DirectionArrow isEnglish={isEnglish}/></Link><a className="public-ghost-button" href={`https://wa.me/${companyPhoneWhatsApp(siteData.contact?.phone)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a></div></div></section>
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
  return <main id="main-content" className="public-page"><SEO title={isEnglish ? 'About Multi Task Agency' : 'عن Multi Task Agency'} description={copy.summary} url="/about" section="about" schema={schema}/><PageHero eyebrow={copy.eyebrow} title={copy.title} summary={copy.summary} index="15"/>
    <section className="public-about-story container"><div><span className="public-section-number">01</span><h2>{isEnglish ? 'What we do' : 'ماذا نقدم'}</h2><p>{copy.story}</p></div></section>
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
  return <main id="main-content" className="public-page public-contact-page"><SEO title={isEnglish ? 'Contact Multi Task Agency in 6th of October' : 'تواصل مع Multi Task Agency في 6 أكتوبر'} description={copy.summary} url="/contact" schema={schema}/>
    <nav className="public-breadcrumb container" aria-label={isEnglish ? 'Breadcrumb' : 'مسار الصفحة'}><Link to={publicPath('/', isEnglish)}>{copy.home}</Link><CrumbArrow isEnglish={isEnglish}/><span aria-current="page">{isEnglish ? 'Contact' : 'تواصل معنا'}</span></nav>
    <PageHero className="public-contact-hero" eyebrow={copy.eyebrow} title={copy.title} summary={copy.summary} showMark={false}/>
    <section className="public-contact-info container" aria-label={isEnglish ? 'Company contact information' : 'بيانات التواصل مع الشركة'}>
      {contact.address && <a className="public-contact-info__item" href="#contact-map"><MapPin aria-hidden="true"/><span><small>{copy.address}</small><strong>{isEnglish ? contact.addressEn : contact.address}</strong></span></a>}
      {primaryPhone && <a className="public-contact-info__item" href={`tel:${companyPhoneTel(contact.phone)}`} aria-label={`${copy.primary}: ${primaryPhone}`} dir="ltr"><Phone aria-hidden="true"/><span><small>{copy.primary}</small><strong>{primaryPhone}</strong></span></a>}
      {secondaryPhone && <a className="public-contact-info__item" href={`tel:${companyPhoneTel(contact.phone2)}`} aria-label={`${copy.secondary}: ${secondaryPhone}`} dir="ltr"><Phone aria-hidden="true"/><span><small>{copy.secondary}</small><strong>{secondaryPhone}</strong></span></a>}
      <a className="public-contact-info__item" href={`mailto:${receivingEmail}`} aria-label={`${copy.emailLabel}: ${receivingEmail}`} dir="ltr"><Mail aria-hidden="true"/><span><small>{copy.emailLabel}</small><strong>{receivingEmail}</strong></span></a>
    </section>
    <section className="public-contact-workspace container">
      <div className="public-contact-form"><h2>{copy.form}</h2><form onSubmit={submit}><label>{copy.name}<input name="Name" required autoComplete="name"/></label><label>{copy.email}<input name="Email" type="email" required autoComplete="email" dir="ltr"/></label><label>{copy.phone}<input name="Phone" type="tel" autoComplete="tel" dir="ltr"/></label><label>{copy.choose}<select name="Service" value={service} onChange={event => setService(event.target.value)}><option value="">—</option>{publicServiceCatalog.map(item => <option key={item.slug} value={item.slug}>{(isEnglish ? item.en : item.ar).title}</option>)}</select></label><label className="public-contact-form__message">{copy.message}<textarea name="Message" rows="5" required/></label><button className="public-solid-button" type="submit">{copy.send}<Send/></button></form></div>
      <aside id="contact-map" className="public-contact-map-card"><header><MapPin aria-hidden="true"/><h2>{copy.map}</h2></header><iframe src="https://maps.google.com/maps?q=Multi%20Task%20Studio&t=&z=15&ie=UTF8&iwloc=&output=embed" title={isEnglish ? 'Multi Task Agency studio location' : 'موقع استديو Multi Task Agency'} loading="lazy" referrerPolicy="no-referrer-when-downgrade" /></aside>
    </section>
  </main>;
}

export function PortfolioPage() {
  const { i18n } = useTranslation(); const isEnglish = String(i18n.language).startsWith('en'); const { siteData } = useData(); const categories = siteData.portfolioCategories || []; const [filter, setFilter] = useState('all');
  const items = useMemo(() => filter === 'all' ? (siteData.portfolio || []) : (siteData.portfolio || []).filter(item => item.category === filter), [filter, siteData.portfolio]);
  const summary = isEnglish ? 'Selected projects in video, design and digital work.' : 'مشروعات مختارة في الفيديو والتصميم والعمل الرقمي.';
  return <main id="main-content" className="public-page"><SEO title={isEnglish ? 'Multi Task Agency Portfolio' : 'نماذج أعمال Multi Task Agency'} description={summary} url="/portfolio" section="portfolio"/><PageHero eyebrow={isEnglish ? 'Portfolio' : 'أعمالنا'} title={isEnglish ? 'Selected work' : 'نماذج أعمالنا'} summary={summary} index="▶"/>
    <section className="public-portfolio-page container"><div className="public-filter-bar" aria-label={isEnglish ? 'Portfolio filters' : 'تصنيفات الأعمال'}><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>{isEnglish ? 'All work' : 'كل الأعمال'}</button>{categories.map(category => <button key={category.id} className={filter === category.id ? 'active' : ''} onClick={() => setFilter(category.id)}>{isEnglish ? category.nameEn : category.nameAr}</button>)}</div><PublicPortfolioGrid items={items} categories={categories} isEnglish={isEnglish} emptyTitle={isEnglish ? 'No work in this filter yet' : 'لا توجد أعمال في هذا التصنيف بعد'} emptyText={isEnglish ? 'Choose another category or discuss a relevant project.' : 'اختر تصنيفًا آخر أو ناقش معنا مشروعًا مناسبًا.'}/></section>
  </main>;
}

export function StudiosPage() {
  const { i18n } = useTranslation(); const isEnglish = String(i18n.language).startsWith('en'); const summary = isEnglish ? 'View our October, Lebanon Square and New Cairo studios.' : 'تعرّف على استديوهات أكتوبر وميدان لبنان والقاهرة الجديدة.';
  return <main id="main-content" className="public-page"><SEO title={isEnglish ? 'Professional Studios in 6th of October' : 'استديوهات تصوير في 6 أكتوبر'} description={summary} url="/studios" section="studio"/><PageHero eyebrow={isEnglish ? 'Studios' : 'الاستديوهات'} title={isEnglish ? 'Choose your studio' : 'اختر الاستديو المناسب'} summary={summary} index="03"/><Suspense fallback={<div className="public-section-loading" role="status">{isEnglish ? 'Loading studios…' : 'جاري تحميل الاستديوهات…'}</div>}><StudioShowcase/></Suspense><section className="public-inline-cta container"><div><h2>{isEnglish ? 'Tell us your session needs' : 'احكِ لنا تفاصيل جلستك'}</h2></div><Link to={publicPath('/contact?service=studio-content-production', isEnglish)} className="public-solid-button">{isEnglish ? 'Ask about availability' : 'اسأل عن المواعيد'}<DirectionArrow isEnglish={isEnglish}/></Link></section></main>;
}

export function PublicNotFound() {
  const { i18n } = useTranslation(); const isEnglish = String(i18n.language).startsWith('en');
  return <main id="main-content" className="public-page public-not-found"><SEO title={isEnglish ? 'Page not found' : 'الصفحة غير موجودة'} description={isEnglish ? 'The requested page could not be found.' : 'تعذر العثور على الصفحة المطلوبة.'} url="/404" noIndex/><span>404</span><h1>{isEnglish ? 'This page is not part of the current site' : 'هذه الصفحة غير موجودة في الموقع الحالي'}</h1><p>{isEnglish ? 'Return home, explore the services, or contact the team.' : 'يمكنك العودة للرئيسية أو استكشاف الخدمات أو التواصل مع الفريق.'}</p><div><Link className="public-solid-button" to={publicPath('/', isEnglish)}>{isEnglish ? 'Home' : 'الرئيسية'}</Link><Link className="public-ghost-button" to={publicPath('/services', isEnglish)}>{isEnglish ? 'Services' : 'الخدمات'}</Link><Link className="public-ghost-button" to={publicPath('/contact', isEnglish)}>{isEnglish ? 'Contact' : 'تواصل معنا'}</Link></div></main>;
}
