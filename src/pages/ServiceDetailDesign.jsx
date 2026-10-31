import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Camera, Check, ChevronLeft, ChevronRight, Clapperboard, Code2, FileText, Layers, Mic2, MonitorSmartphone, Palette, Play, Share2, Smartphone, Sparkles, WandSparkles } from 'lucide-react';
import SEO from '../components/SEO';
import PublicPortfolioGrid from '../components/PublicPortfolioGrid';
import { useData } from '../store/DataContext';
import { AL_MAJD_SOCIAL_PARTNER } from '../data/alMajdSocialPartner';
import { EDUCATIONAL_BOOKING_GALLERY } from '../data/educationalBooking';
import { getPublicService, getServicePortfolio } from '../data/publicServiceCatalog';
import { serviceVisualLayouts } from '../data/serviceVisualLayouts';
import { companyPhoneWhatsApp } from '../lib/companyContact';
import { localizePublicPath } from '../lib/publicRoutes';
import { organizationId, SITE_URL } from '../seo/siteIdentity';
import './ServiceReferenceDesign.css';

const publicPath = (value, isEnglish) => localizePublicPath(value, isEnglish ? 'en' : 'ar');
const publicUrl = (value, isEnglish) => `${SITE_URL}${publicPath(value, isEnglish)}`;
const featureIcons = [Layers, Camera, FileText, Check];
const serviceIcons = { education: Camera, reels: Smartphone, commercial: Clapperboard, podcast: Mic2, events: Camera, social: Share2, branding: Palette, web: MonitorSmartphone, software: Code2, ai: WandSparkles };
function DirectionArrow({ isEnglish }) { return isEnglish ? <ArrowRight aria-hidden="true"/> : <ArrowLeft aria-hidden="true"/>; }
function CrumbArrow({ isEnglish }) { return isEnglish ? <ChevronRight aria-hidden="true"/> : <ChevronLeft aria-hidden="true"/>; }
function HighlightTitle({ children }) {
  const words = children.split(' '); const highlighted = words.splice(-Math.min(2, Math.max(1, words.length - 1))).join(' ');
  return <>{words.join(' ')}{' '}<span>{highlighted}</span></>;
}
function Waveform() { return <div className="sd-waveform" aria-hidden="true">{Array.from({ length: 53 }, (_, index) => <i key={index} style={{ '--wave-height': `${8 + ((index * 13 + index % 7 * 9) % 54)}px` }}/>)}</div>; }
const workImage = item => {
  if (item?.imageUrl) return item.imageUrl;
  const url = item?.embedUrl || ''; const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:shorts\/|embed\/|watch\?v=))([\w-]{11})/);
  return match ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : '';
};
function Photo({ src, alt = '', eager = false, className = '' }) { return <img className={className} src={src} alt={alt} width="960" height="640" loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : 'auto'} decoding="async"/>; }
function ServiceVisual({ text, layout, work, isEnglish }) {
  const variant = layout.variant; const preview = work.filter(item => workImage(item)).slice(0, variant === 'events' ? 4 : 3);
  if (variant === 'reels') return <div className="sd-hero__visual sd-reels-strips">{(preview.length ? preview : [null, null, null]).map((item, index) => <div className="sd-reel-frame" key={item?.id || index}>
    <Photo src={workImage(item) || layout.heroImage} alt={item ? ((isEnglish ? item.titleEn : item.title) || item.title) : text.heroAlt} eager={index === 0}/>
    {item && <a href="#service-work" aria-label={`${(isEnglish ? item.titleEn : item.title) || item.title} — ${isEnglish ? 'See our work' : 'شاهد أعمالنا'}`}><Play aria-hidden="true"/></a>}
  </div>)}</div>;
  if (variant === 'events') return <div className="sd-hero__visual sd-event-mosaic">{(preview.length ? preview : [null, null, null, null]).map((item, index) => <figure key={item?.id || index}><Photo src={workImage(item) || layout.heroImage} alt={item ? ((isEnglish ? item.titleEn : item.title) || item.title) : text.heroAlt} eager={index === 0}/></figure>)}</div>;
  if (variant === 'social') return <div className="sd-hero__visual sd-social-composition"><Photo src={layout.heroImage} alt={text.heroAlt} eager/><div className="sd-social-floats" aria-hidden="true">{AL_MAJD_SOCIAL_PARTNER.images.slice(0, 2).map(image => <figure key={image.id}><Photo src={image.src}/><span><i/><i/><i/></span></figure>)}</div></div>;
  if (variant === 'web') {
    const primary = preview[0];
    return <div className="sd-hero__visual sd-device-composition"><div className="sd-desktop-screen"><div className="sd-window-chrome" aria-hidden="true"><i/><i/><i/><b/></div><Photo src={workImage(primary) || layout.heroImage} alt={primary ? ((isEnglish ? primary.titleEn : primary.title) || primary.title) : text.heroAlt} eager/></div><div className="sd-phone-screen" aria-hidden="true"><Photo src={workImage(primary) || layout.heroImage}/></div></div>;
  }
  if (variant === 'software') return <div className="sd-hero__visual sd-software-composition"><div className="sd-software-window"><div className="sd-window-chrome" aria-hidden="true"><i/><i/><i/><b/></div><Photo src={layout.heroImage} alt={text.heroAlt} eager/></div><div className="sd-software-mini" aria-hidden="true"><span/><i/><i/><i/><b/><b/><b/></div></div>;
  if (variant === 'branding') return <div className="sd-hero__visual sd-brand-composition"><Photo src={layout.heroImage} alt={text.heroAlt} eager/><div className="sd-brand-swatches" aria-hidden="true"><i/><i/><i/></div></div>;
  if (variant === 'ai') return <div className="sd-hero__visual sd-ai-cinema"><Photo src={layout.heroImage} alt={text.heroAlt} eager/><span className="sd-cinema-corner" aria-hidden="true"/><div className="sd-ai-filmstrip" aria-hidden="true">{[0,1,2].map(index => <Photo key={index} src={layout.heroImage}/>)}</div></div>;
  return <figure className={`sd-hero__visual sd-photo-${variant}`}><Photo src={layout.heroImage} alt={variant === 'education' ? (isEnglish ? EDUCATIONAL_BOOKING_GALLERY[0].altEn : EDUCATIONAL_BOOKING_GALLERY[0].alt) : text.heroAlt} eager/>{variant === 'podcast' && <Waveform/>}</figure>;
}
function ServiceHero({ service, text, layout, work, isEnglish, workTarget, hasSuccessPartner }) {
  return <header className={`sd-hero sd-hero--${layout.variant}`}>
    <div className="sd-hero__curve" aria-hidden="true"/>
    {layout.variant === 'commercial' && <Photo src={layout.heroImage} alt="" eager className="sd-hero__backdrop"/>}
    <div className="container sd-hero__grid">
      <div className="sd-hero__copy"><h1><HighlightTitle>{text.title}</HighlightTitle></h1><p>{text.heroSummary}</p><div className="public-hero-actions sd-hero__actions">
        <Link className="public-solid-button" to={publicPath(`/contact?service=${service.slug}`, isEnglish)} state={{ service: service.slug }}>{isEnglish ? 'Request a quote' : 'اطلب عرض سعر'}<DirectionArrow isEnglish={isEnglish}/></Link>
        {(work.length > 0 || hasSuccessPartner) && <a className="public-ghost-button" href={workTarget}>{isEnglish ? 'See our work' : 'شاهد أعمالنا'}</a>}
      </div></div>
      {layout.variant !== 'commercial' && <ServiceVisual text={text} layout={layout} work={work} isEnglish={isEnglish}/>}
    </div>
    {layout.variant === 'podcast' && <Waveform/>}
  </header>;
}
function Deliverables({ text, layout, isEnglish }) {
  const Icon = serviceIcons[layout.variant] || Sparkles;
  return <section className="sd-inclusions container" aria-labelledby="service-deliverables-title">
    <div className="public-section-heading"><span>01</span><h2 id="service-deliverables-title">{isEnglish ? 'What is included' : 'ما الذي تتضمنه الخدمة'}</h2></div>
    <div className={`sd-inclusions__layout sd-inclusions__layout--${layout.variant}`}>
      {['reels', 'podcast', 'events', 'software'].includes(layout.variant) && <figure className="sd-inclusions__photo"><Photo src={layout.companionImage}/>{layout.variant === 'podcast' && <Waveform/>}</figure>}
      <ul className="sd-deliverable-cards">{text.deliverables.map((item, index) => {
        const FeatureIcon = layout.variant === 'social' ? [FileText, Palette, Share2, MonitorSmartphone][index % 4] : featureIcons[index % featureIcons.length];
        return <li key={item}>{layout.variant === 'education' && <Photo src={EDUCATIONAL_BOOKING_GALLERY[index % EDUCATIONAL_BOOKING_GALLERY.length].url}/>}
          {layout.variant === 'ai' && <Photo src={layout.companionImage}/>}
          <div className="sd-deliverable-card__body"><span className="sd-feature-icon"><FeatureIcon aria-hidden="true"/></span><p>{item}</p></div>
        </li>;
      })}</ul>
      {layout.variant === 'branding' && <div className="sd-brand-system" aria-hidden="true"><span><i/><i/><i/></span><b>أبجد هوز</b><em>Aa</em><Palette/></div>}
      {layout.variant === 'social' && <div className="sd-content-calendar" aria-hidden="true"><div className="sd-calendar-top"><Icon/><span/><i/></div><div className="sd-calendar-grid">{Array.from({ length: 5 }, (_, column) => <div key={column}>{Array.from({ length: 3 }, (_, row) => <span key={row}><img src={AL_MAJD_SOCIAL_PARTNER.images[(column + row) % AL_MAJD_SOCIAL_PARTNER.images.length].src} alt="" loading="lazy"/><i/><b/></span>)}</div>)}</div></div>}
    </div>
  </section>;
}
function DecisionGuideSection({ content, number, layout }) {
  if (!content) return null;
  return <section className="public-decision-guide sd-decision-guide" aria-labelledby="decision-guide-title"><div className="container">
    <header className="public-decision-guide__header"><span className="public-section-number">{number}</span><div><h2 id="decision-guide-title">{content.title}</h2></div></header>
    <div className="public-decision-guide__options">{content.options.slice(0, 3).map((item, index) => <article key={item.title}>
      <div className="sd-decision-photo" aria-hidden="true"><Photo src={layout.companionImage}/></div><div className="sd-decision-body"><span>{String(index + 1).padStart(2, '0')}</span><h3>{item.title}</h3><p>{item.text}</p></div>
    </article>)}</div>
  </div></section>;
}
function AlMajdPartnerSection({ isEnglish, number }) {
  const partner = AL_MAJD_SOCIAL_PARTNER; const copy = isEnglish ? partner.en : partner.ar;
  return <section id="al-majd-work" className="public-success-partner sd-success-partner" aria-labelledby="al-majd-partner-title"><div className="container">
    <header className="public-success-partner__header"><span className="public-success-partner__number">{number}</span><div><span className="public-eyebrow">{copy.eyebrow}</span><h2 id="al-majd-partner-title"><a href={partner.website} target="_blank" rel="noopener noreferrer">{copy.name}<DirectionArrow isEnglish={isEnglish}/></a></h2><p>{copy.summary}</p><a className="public-success-partner__link" href={partner.website} target="_blank" rel="noopener noreferrer">{copy.websiteLabel}<DirectionArrow isEnglish={isEnglish}/></a></div></header>
    <div className="public-success-partner__gallery">{partner.images.map(image => <figure key={image.id}><img src={image.src} alt={isEnglish ? image.enAlt : image.arAlt} width={image.width} height={image.height} loading="lazy" decoding="async"/><figcaption>{isEnglish ? `Campaign design ${String(image.id).padStart(2, '0')}` : `تصميم إعلاني ${String(image.id).padStart(2, '0')}`}</figcaption></figure>)}</div>
  </div></section>;
}
function MissingService({ isEnglish }) {
  return <main id="main-content" className="public-page public-not-found"><SEO title={isEnglish ? 'Page not found' : 'الصفحة غير موجودة'} description={isEnglish ? 'The requested page could not be found.' : 'تعذر العثور على الصفحة المطلوبة.'} url="/404" noIndex/><span>404</span><h1>{isEnglish ? 'This page is not part of the current site' : 'هذه الصفحة غير موجودة في الموقع الحالي'}</h1><p>{isEnglish ? 'Return home, explore the services, or contact the team.' : 'يمكنك العودة للرئيسية أو استكشاف الخدمات أو التواصل مع الفريق.'}</p><div><Link className="public-solid-button" to={publicPath('/', isEnglish)}>{isEnglish ? 'Home' : 'الرئيسية'}</Link><Link className="public-ghost-button" to={publicPath('/services', isEnglish)}>{isEnglish ? 'Services' : 'الخدمات'}</Link><Link className="public-ghost-button" to={publicPath('/contact', isEnglish)}>{isEnglish ? 'Contact' : 'تواصل معنا'}</Link></div></main>;
}

export default function ServiceDetailPage() {
  const { slug } = useParams(); const service = getPublicService(slug); const { i18n } = useTranslation(); const isEnglish = String(i18n.language).startsWith('en'); const { siteData } = useData();
  if (!service) return <MissingService isEnglish={isEnglish}/>;
  const text = isEnglish ? service.en : service.ar; const work = getServicePortfolio(siteData.portfolio, service); const categories = siteData.portfolioCategories || [];
  const layout = serviceVisualLayouts[slug];
  const hasDecisionGuide = Boolean(text.decisionGuide); const hasSuccessPartner = service.slug === AL_MAJD_SOCIAL_PARTNER.serviceSlug;
  const workTarget = hasSuccessPartner ? '#al-majd-work' : '#service-work';
  let nextSection = 3; const sectionNumber = () => String(nextSection++).padStart(2, '0');
  const decisionSectionNumber = hasDecisionGuide ? sectionNumber() : null; const partnerSectionNumber = hasSuccessPartner ? sectionNumber() : null; const workSectionNumber = work.length ? sectionNumber() : null; const faqSectionNumber = text.faq.length ? sectionNumber() : null;
  const home = isEnglish ? 'Home' : 'الرئيسية'; const services = isEnglish ? 'Services' : 'الخدمات';
  const serviceUrl = publicUrl(`/services/${service.slug}`, isEnglish);
  const serviceSchema = { '@context': 'https://schema.org', '@type': 'Service', '@id': `${serviceUrl}#service`, name: text.title, serviceType: text.serviceType || text.title, description: text.metaDescription, url: serviceUrl, image: `${SITE_URL}${service.heroImage}`, inLanguage: isEnglish ? 'en-EG' : 'ar-EG', provider: { '@id': organizationId }, areaServed: [{ '@type': 'City', name: '6th of October City' }, { '@type': 'AdministrativeArea', name: 'Giza' }, { '@type': 'Country', name: 'Egypt' }] };
  const breadcrumbSchema = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: home, item: publicUrl('/', isEnglish) }, { '@type': 'ListItem', position: 2, name: services, item: publicUrl('/services', isEnglish) }, { '@type': 'ListItem', position: 3, name: text.title, item: publicUrl(`/services/${service.slug}`, isEnglish) }] };
  const faqSchema = text.faq.length ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: text.faq.map(([question, answer]) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } })) } : null;
  return <main id="main-content" className={`public-page service-detail-page reference-service sd--${layout.variant}`}>
    <SEO title={text.seoTitle} description={text.metaDescription} image={`${SITE_URL}${service.heroImage}`} url={`/services/${service.slug}`} schema={[serviceSchema, breadcrumbSchema, faqSchema].filter(Boolean)}/>
    <nav className="public-breadcrumb container sd-breadcrumb" aria-label={isEnglish ? 'Breadcrumb' : 'مسار الصفحة'}><Link to={publicPath('/', isEnglish)}>{home}</Link><CrumbArrow isEnglish={isEnglish}/><Link to={publicPath('/services', isEnglish)}>{services}</Link><CrumbArrow isEnglish={isEnglish}/><span aria-current="page">{text.navLabel}</span></nav>
    <ServiceHero service={service} text={text} layout={layout} work={work} isEnglish={isEnglish} workTarget={workTarget} hasSuccessPartner={hasSuccessPartner}/>
    <Deliverables text={text} layout={layout} isEnglish={isEnglish}/>
    <section className="public-suitable container sd-suitable"><div className="public-section-heading"><span>02</span><h2>{isEnglish ? 'Suitable for' : 'مناسبة لـ'}</h2></div><div>{text.suitableFor.map(item => <span key={item}>{item}</span>)}</div></section>
    <DecisionGuideSection content={text.decisionGuide} number={decisionSectionNumber} layout={layout}/>
    {hasSuccessPartner && <AlMajdPartnerSection isEnglish={isEnglish} number={partnerSectionNumber}/>}
    {work.length > 0 && <section id="service-work" className="public-work-section container sd-real-work"><div className="public-section-heading"><span>{workSectionNumber}</span><div><h2>{isEnglish ? 'Relevant work' : 'أعمال مرتبطة بالخدمة'}</h2></div></div><PublicPortfolioGrid items={work} categories={categories} isEnglish={isEnglish}/></section>}
    {text.faq.length > 0 && <section className="public-faq container sd-faq"><div className="public-section-heading"><span>{faqSectionNumber}</span><h2>{isEnglish ? 'Before you book' : 'قبل الاتفاق'}</h2></div><div>{text.faq.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></section>}
    <section className="public-final-cta sd-final-cta" style={{ '--sd-cta-image': `url("${layout.companionImage}")` }}><div className="container"><h2>{isEnglish ? 'Tell us what you need' : 'احكِ لنا احتياجك'}</h2><div><Link className="public-solid-button" to={publicPath(`/contact?service=${service.slug}`, isEnglish)}>{isEnglish ? 'Request a quote' : 'اطلب عرض سعر'}<DirectionArrow isEnglish={isEnglish}/></Link><a className="public-ghost-button" href={`https://wa.me/${companyPhoneWhatsApp(siteData.contact?.phone)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a></div></div></section>
  </main>;
}
