import { lazy, Suspense, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, CalendarRange, Camera, Check, ChevronLeft, ChevronRight, Clapperboard,
  Code2, Mail, MapPin, Mic2, MonitorSmartphone, Palette, Phone, Send, Share2, Smartphone,
  Sparkles, WandSparkles,
} from 'lucide-react';
import SEO from '../components/SEO';
import PublicPortfolioGrid from '../components/PublicPortfolioGrid';
import { useData } from '../store/DataContext';
import { getPublicService, getServicePortfolio, publicServiceCatalog, publicServiceGroups } from '../data/publicServiceCatalog';

const icons = { CalendarRange, Camera, Clapperboard, Code2, Mic2, MonitorSmartphone, Palette, Share2, Smartphone, WandSparkles };
const SITE = 'https://multitaskagency.com';
const StudioShowcase = lazy(() => import('../components/StudioShowcase'));

function DirectionArrow({ isEnglish }) { return isEnglish ? <ArrowRight aria-hidden="true" /> : <ArrowLeft aria-hidden="true" />; }
function CrumbArrow({ isEnglish }) { return isEnglish ? <ChevronRight aria-hidden="true" /> : <ChevronLeft aria-hidden="true" />; }

function PageHero({ eyebrow, title, summary, index, actions, children }) {
  return <header className="public-editorial-hero">
    <div className="container public-editorial-hero__grid">
      <div className="public-editorial-hero__copy"><span className="public-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{summary}</p>{actions && <div className="public-hero-actions">{actions}</div>}</div>
      <div className="public-editorial-hero__mark" aria-hidden="true"><span>{index || 'MT'}</span><i /></div>
      {children}
    </div>
  </header>;
}

export function ServicesIndexPage() {
  const { i18n } = useTranslation(); const isEnglish = String(i18n.language).startsWith('en');
  const copy = isEnglish ? {
    eyebrow: 'One agency. Connected capabilities.', title: 'Production, marketing and technology under one roof', summary: 'Choose a focused service or combine the right capabilities around one objective, one workflow and one accountable team.',
    intro: 'Explore all services', cta: 'Not sure what fits?', ctaText: 'Tell us what you want to achieve. We will help shape the right scope without forcing a preset package.', contact: 'Discuss your project',
  } : {
    eyebrow: 'وكالة واحدة. قدرات مترابطة.', title: 'الإنتاج والتسويق والتقنية تحت سقف واحد', summary: 'اختر خدمة محددة أو اجمع القدرات المناسبة حول هدف واحد ومسار عمل واضح وفريق مسؤول عن النتيجة.',
    intro: 'استكشف كل الخدمات', cta: 'لست متأكدًا مما تحتاجه؟', ctaText: 'احكِ لنا ما تريد تحقيقه، وسنساعدك في بناء نطاق مناسب دون إجبارك على باقة ثابتة.', contact: 'ناقش مشروعك معنا',
  };
  return <main id="main-content" className="public-page">
    <SEO title={isEnglish ? 'Integrated Services' : 'خدماتنا المتكاملة'} description={copy.summary} url="/services" section="services" />
    <PageHero eyebrow={copy.eyebrow} title={copy.title} summary={copy.summary} index="10" />
    <section className="public-service-index container" aria-labelledby="services-index-title"><div className="public-section-heading"><span>01</span><h2 id="services-index-title">{copy.intro}</h2></div>
      {publicServiceGroups.map(group => <div className="public-service-group" key={group.id}><h3>{isEnglish ? group.en : group.ar}</h3><div>
        {publicServiceCatalog.filter(service => service.group === group.id).map((service) => { const Icon = icons[service.icon] || Sparkles; const localized = isEnglish ? service.en : service.ar; const serviceNumber = publicServiceCatalog.indexOf(service) + 1; return <Link className="public-service-row" to={`/services/${service.slug}`} key={service.slug}>
          <span className="public-service-row__number">{String(serviceNumber).padStart(2, '0')}</span><Icon aria-hidden="true"/><div><h4>{localized.title}</h4><p>{localized.outcomes[0]}</p></div><DirectionArrow isEnglish={isEnglish}/>
        </Link>; })}
      </div></div>)}
    </section>
    <section className="public-inline-cta container"><div><span>{copy.cta}</span><h2>{copy.ctaText}</h2></div><Link to="/contact" className="public-solid-button">{copy.contact}<DirectionArrow isEnglish={isEnglish}/></Link></section>
  </main>;
}

export function ServiceDetailPage() {
  const { slug } = useParams(); const service = getPublicService(slug); const { i18n } = useTranslation(); const isEnglish = String(i18n.language).startsWith('en'); const { siteData } = useData();
  if (!service) return <PublicNotFound />;
  const text = isEnglish ? service.en : service.ar; const work = getServicePortfolio(siteData.portfolio, service); const categories = siteData.portfolioCategories || [];
  const home = isEnglish ? 'Home' : 'الرئيسية'; const services = isEnglish ? 'Services' : 'الخدمات';
  const serviceSchema = { '@context': 'https://schema.org', '@type': 'Service', name: text.title, description: text.heroSummary, url: `${SITE}/services/${service.slug}`, provider: { '@id': `${SITE}/#organization` }, areaServed: { '@type': 'Country', name: 'Egypt' } };
  const breadcrumbSchema = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: home, item: `${SITE}/` }, { '@type': 'ListItem', position: 2, name: services, item: `${SITE}/services` }, { '@type': 'ListItem', position: 3, name: text.title, item: `${SITE}/services/${service.slug}` }] };
  return <main id="main-content" className="public-page service-detail-page">
    <SEO title={text.seoTitle} description={text.metaDescription} keywords={text.keywords} url={`/services/${service.slug}`} schema={[serviceSchema, breadcrumbSchema]} />
    <nav className="public-breadcrumb container" aria-label={isEnglish ? 'Breadcrumb' : 'مسار الصفحة'}><Link to="/">{home}</Link><CrumbArrow isEnglish={isEnglish}/><Link to="/services">{services}</Link><CrumbArrow isEnglish={isEnglish}/><span aria-current="page">{text.navLabel}</span></nav>
    <PageHero eyebrow={text.eyebrow} title={text.title} summary={text.heroSummary} index={String(publicServiceCatalog.indexOf(service) + 1).padStart(2, '0')} actions={<>
      <Link className="public-solid-button" to={`/contact?service=${service.slug}`} state={{ service: service.slug }}>{isEnglish ? 'Start a conversation' : 'ابدأ مناقشة المشروع'}<DirectionArrow isEnglish={isEnglish}/></Link>
      <a className="public-ghost-button" href="#service-work">{isEnglish ? 'See relevant work' : 'شاهد الأعمال المرتبطة'}</a>
    </>} />
    <section className="public-intro container"><span className="public-section-number">01</span><div><h2>{isEnglish ? 'A focused solution, built around the result' : 'حل واضح مبني حول النتيجة'}</h2><p>{text.introduction}</p></div></section>
    <section className="public-split-section container">
      <div className="public-section-heading"><span>02</span><h2>{isEnglish ? 'What this solves' : 'ما الذي تحله الخدمة'}</h2></div>
      <div className="public-outcome-list">{text.outcomes.map(item => <article key={item}><Check aria-hidden="true"/><p>{item}</p></article>)}</div>
      <div className="public-deliverables"><h3>{isEnglish ? 'What you receive' : 'ما الذي تستلمه'}</h3><ul>{text.deliverables.map(item => <li key={item}>{item}</li>)}</ul></div>
    </section>
    <section className="public-process-section"><div className="container"><div className="public-section-heading"><span>03</span><h2>{isEnglish ? 'How the work moves' : 'كيف يتحرك العمل'}</h2></div><ol className="public-process-line">{text.process.map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, '0')}</span><h3>{step}</h3></li>)}</ol></div></section>
    <section className="public-suitable container"><div className="public-section-heading"><span>04</span><h2>{isEnglish ? 'A strong fit for' : 'مناسبة بشكل خاص لـ'}</h2></div><div>{text.suitableFor.map(item => <span key={item}>{item}</span>)}</div></section>
    <section id="service-work" className="public-work-section container"><div className="public-section-heading"><span>05</span><div><h2>{isEnglish ? 'Our work in this service' : 'أعمالنا في هذه الخدمة'}</h2><p>{isEnglish ? 'Only verified portfolio work connected to this capability appears here.' : 'نعرض هنا فقط الأعمال الموثقة والمرتبطة فعليًا بهذه الخدمة.'}</p></div></div>
      <PublicPortfolioGrid items={work} categories={categories} isEnglish={isEnglish} emptyTitle={isEnglish ? 'No verified work is published here yet' : 'لا توجد أعمال موثقة منشورة هنا بعد'} emptyText={isEnglish ? 'Ask us for the most relevant private examples or discuss a first project.' : 'تواصل معنا للاطلاع على أمثلة مناسبة غير منشورة أو لمناقشة مشروعك الأول.'}/>
      {!work.length && <Link className="public-text-link" to={`/contact?service=${service.slug}`}>{isEnglish ? 'Discuss this service' : 'ناقش هذه الخدمة'}<DirectionArrow isEnglish={isEnglish}/></Link>}
    </section>
    <section className="public-faq container"><div className="public-section-heading"><span>06</span><h2>{isEnglish ? 'Useful questions before we start' : 'أسئلة مهمة قبل أن نبدأ'}</h2></div><div>{text.faq.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></section>
    <section className="public-final-cta"><div className="container"><span>{isEnglish ? 'Ready when you are' : 'نبدأ عندما تكون مستعدًا'}</span><h2>{isEnglish ? 'Let us shape the right scope for your next project.' : 'دعنا نبني النطاق المناسب لمشروعك القادم.'}</h2><div><Link className="public-solid-button" to={`/contact?service=${service.slug}`}>{isEnglish ? 'Contact MT Agency' : 'تواصل مع MT Agency'}<DirectionArrow isEnglish={isEnglish}/></Link><a className="public-ghost-button" href={`https://wa.me/${String(siteData.contact?.phone || '').replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">WhatsApp</a></div></div></section>
  </main>;
}

export function AboutPage() {
  const { i18n } = useTranslation(); const isEnglish = String(i18n.language).startsWith('en'); const { siteData } = useData(); const about = siteData.about || {};
  const stats = [[about.yearsOfExperience, isEnglish ? 'years of experience' : 'عامًا من الخبرة'], [about.successfulProjects, isEnglish ? 'projects' : 'مشروعًا'], [about.expertsCount, isEnglish ? 'experts and creators' : 'خبيرًا ومبدعًا']].filter(([value]) => value !== undefined && value !== null && String(value).trim());
  const copy = isEnglish ? {
    eyebrow: 'About MT Agency', title: 'A production and technology partner that works as one team', summary: 'Strategy, production, marketing and software connected through one clear workflow and a team that understands the whole objective.',
    story: 'Our story is built around turning ideas into useful, visible results. We connect creative production with digital execution so clients do not have to coordinate disconnected suppliers.',
    difference: 'What makes the model different', values: ['Integrated thinking before isolated deliverables', 'Flexible custom scope instead of rigid packages', 'Clear stages, reviews and commercial visibility', 'A client dashboard for ongoing work and services'],
    capabilities: 'Connected capabilities', process: 'From the first call to ongoing support', steps: ['Understand the objective', 'Shape scope and milestones', 'Produce and review', 'Deliver, measure and support'], cta: 'Explore our services',
  } : {
    eyebrow: 'عن MT Agency', title: 'شريك إنتاج وتقنية يعمل كفريق واحد', summary: 'الاستراتيجية والإنتاج والتسويق والبرمجيات في مسار واضح وفريق يفهم الهدف كاملًا.',
    story: 'قصتنا مبنية على تحويل الأفكار إلى نتائج مفيدة ومرئية. نربط الإنتاج الإبداعي بالتنفيذ الرقمي حتى لا يضطر العميل لإدارة موردين منفصلين لا يتحدثون اللغة نفسها.',
    difference: 'ما الذي يجعل نموذجنا مختلفًا', values: ['تفكير متكامل قبل المخرجات المنفصلة', 'نطاق مرن حسب الاحتياج بدل الباقات الجامدة', 'مراحل ومراجعات وحالة مالية واضحة', 'لوحة عميل لمتابعة الخدمات والعمل الجاري'],
    capabilities: 'قدرات تعمل معًا', process: 'من أول مكالمة إلى التسليم والدعم', steps: ['نفهم الهدف', 'نبني النطاق والمراحل', 'ننتج ونراجع', 'نسلم ونقيس وندعم'], cta: 'استكشف خدماتنا',
  };
  const schema = { '@context': 'https://schema.org', '@type': 'AboutPage', name: copy.title, description: copy.summary, url: `${SITE}/about`, about: { '@id': `${SITE}/#organization` } };
  return <main id="main-content" className="public-page"><SEO title={isEnglish ? 'About Us' : 'من نحن'} description={copy.summary} url="/about" section="about" schema={schema}/><PageHero eyebrow={copy.eyebrow} title={copy.title} summary={copy.summary} index="15"/>
    <section className="public-about-story container"><div><span className="public-section-number">01</span><h2>{isEnglish ? 'One connected story' : 'قصة واحدة مترابطة'}</h2><p>{isEnglish ? (about.p1En || copy.story) : (about.p1 || copy.story)}</p><p>{copy.story}</p></div>{stats.length > 0 && <dl>{stats.map(([value, label]) => <div key={label}><dt>{value}</dt><dd>{label}</dd></div>)}</dl>}</section>
    <section className="public-about-difference"><div className="container"><div className="public-section-heading"><span>02</span><h2>{copy.difference}</h2></div><div className="public-principles">{copy.values.map((value, index) => <article key={value}><span>{String(index + 1).padStart(2, '0')}</span><h3>{value}</h3></article>)}</div></div></section>
    <section className="public-capabilities container"><div className="public-section-heading"><span>03</span><h2>{copy.capabilities}</h2></div>{publicServiceGroups.map(group => <article key={group.id}><h3>{isEnglish ? group.en : group.ar}</h3><ul>{publicServiceCatalog.filter(service => service.group === group.id).map(service => <li key={service.slug}><Link to={`/services/${service.slug}`}>{(isEnglish ? service.en : service.ar).navLabel}</Link></li>)}</ul></article>)}{(siteData.studioCategories || []).length > 0 && <article className="public-studio-presence"><h3>{isEnglish ? 'Studio presence' : 'تواجد الاستديوهات'}</h3><ul>{siteData.studioCategories.map(studio => <li key={studio.id}><Link to="/studios">{isEnglish ? studio.nameEn : studio.nameAr}</Link></li>)}</ul></article>}</section>
    <section className="public-process-section"><div className="container"><div className="public-section-heading"><span>04</span><h2>{copy.process}</h2></div><ol className="public-process-line">{copy.steps.map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, '0')}</span><h3>{step}</h3></li>)}</ol></div></section>
    <section className="public-inline-cta container"><div><span>MT Agency</span><h2>{isEnglish ? 'Choose one capability or build an integrated team.' : 'اختر قدرة واحدة أو ابنِ فريقًا متكاملًا.'}</h2></div><Link to="/services" className="public-solid-button">{copy.cta}<DirectionArrow isEnglish={isEnglish}/></Link></section>
  </main>;
}

export function ContactPage() {
  const { i18n } = useTranslation(); const isEnglish = String(i18n.language).startsWith('en'); const { siteData } = useData(); const location = useLocation();
  const requestedSlug = new URLSearchParams(location.search).get('service') || location.state?.service || ''; const initialService = getPublicService(requestedSlug) ? requestedSlug : '';
  const [service, setService] = useState(initialService); const contact = siteData.contact || {}; const receivingEmail = siteData.formSettings?.receivingEmail || contact.email || 'info@multitaskagency.com';
  const copy = isEnglish ? { eyebrow: 'Start a useful conversation', title: 'Tell us what you want to achieve', summary: 'Share the goal, timing and any useful context. We will respond with the next practical step.', direct: 'Direct contact', form: 'Project inquiry', name: 'Name', email: 'Email', phone: 'Phone', choose: 'Choose a service', message: 'What are you planning?', send: 'Prepare email', map: 'Studio location' } : { eyebrow: 'ابدأ محادثة مفيدة', title: 'احكِ لنا ما الذي تريد تحقيقه', summary: 'شاركنا الهدف والتوقيت وأي تفاصيل مهمة، وسنعود إليك بالخطوة العملية التالية.', direct: 'تواصل مباشر', form: 'استفسار عن مشروع', name: 'الاسم', email: 'البريد الإلكتروني', phone: 'رقم الهاتف', choose: 'اختر الخدمة', message: 'ما الذي تخطط له؟', send: 'تجهيز الرسالة', map: 'موقع الاستديو' };
  const submit = event => { event.preventDefault(); const form = new FormData(event.currentTarget); const selected = getPublicService(form.get('Service')); const subject = isEnglish ? `Project inquiry — ${selected?.en.title || 'MT Agency'}` : `استفسار مشروع — ${selected?.ar.title || 'MT Agency'}`; const body = [`${copy.name}: ${form.get('Name')}`, `${copy.email}: ${form.get('Email')}`, `${copy.phone}: ${form.get('Phone') || '-'}`, `${copy.choose}: ${selected ? (isEnglish ? selected.en.title : selected.ar.title) : '-'}`, '', String(form.get('Message') || '')].join('\n'); window.location.href = `mailto:${encodeURIComponent(receivingEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`; };
  const schema = { '@context': 'https://schema.org', '@type': 'ContactPage', name: copy.title, description: copy.summary, url: `${SITE}/contact`, mainEntity: { '@id': `${SITE}/#organization` } };
  return <main id="main-content" className="public-page"><SEO title={isEnglish ? 'Contact Us' : 'تواصل معنا'} description={copy.summary} url="/contact" schema={schema}/><PageHero eyebrow={copy.eyebrow} title={copy.title} summary={copy.summary} index="@"/>
    <section className="public-contact-grid container"><aside><span className="public-section-number">01</span><h2>{copy.direct}</h2>{contact.address && <a href="#contact-map"><MapPin/>{isEnglish ? contact.addressEn : contact.address}</a>}<a href={`tel:${String(contact.phone || '').replace(/\s/g, '')}`} dir="ltr"><Phone/>{contact.phone}</a>{contact.phone2 && <a href={`tel:${String(contact.phone2).replace(/\s/g, '')}`} dir="ltr"><Phone/>{contact.phone2}</a>}<a href={`mailto:${receivingEmail}`} dir="ltr"><Mail/>{receivingEmail}</a><a className="public-whatsapp-link" href={`https://wa.me/${String(contact.phone || '').replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">WhatsApp<Send/></a></aside>
      <div className="public-contact-form"><span className="public-section-number">02</span><h2>{copy.form}</h2><form onSubmit={submit}><label>{copy.name}<input name="Name" required autoComplete="name"/></label><label>{copy.email}<input name="Email" type="email" required autoComplete="email" dir="ltr"/></label><label>{copy.phone}<input name="Phone" type="tel" autoComplete="tel" dir="ltr"/></label><label>{copy.choose}<select name="Service" value={service} onChange={event => setService(event.target.value)}><option value="">—</option>{publicServiceCatalog.map(item => <option key={item.slug} value={item.slug}>{(isEnglish ? item.en : item.ar).title}</option>)}</select></label><label className="public-contact-form__message">{copy.message}<textarea name="Message" rows="6" required/></label><button className="public-solid-button" type="submit">{copy.send}<Send/></button></form></div>
    </section>
    <section id="contact-map" className="public-map container"><div><span className="public-section-number">03</span><h2>{copy.map}</h2></div><iframe src="https://maps.google.com/maps?q=Multi%20Task%20Studio&t=&z=15&ie=UTF8&iwloc=&output=embed" title="MT Agency location" loading="lazy" referrerPolicy="no-referrer-when-downgrade" /></section>
  </main>;
}

export function PortfolioPage() {
  const { i18n } = useTranslation(); const isEnglish = String(i18n.language).startsWith('en'); const { siteData } = useData(); const categories = siteData.portfolioCategories || []; const [filter, setFilter] = useState('all');
  const items = useMemo(() => filter === 'all' ? (siteData.portfolio || []) : (siteData.portfolio || []).filter(item => item.category === filter), [filter, siteData.portfolio]);
  const summary = isEnglish ? 'Verified production, design and digital work from the existing MT Agency portfolio.' : 'أعمال موثقة في الإنتاج والتصميم والمنتجات الرقمية من معرض MT Agency الحالي.';
  return <main id="main-content" className="public-page"><SEO title={isEnglish ? 'Portfolio' : 'معرض الأعمال'} description={summary} url="/portfolio" section="portfolio"/><PageHero eyebrow={isEnglish ? 'Selected work' : 'أعمال مختارة'} title={isEnglish ? 'Work that shows the thinking and the finish' : 'أعمال توضح الفكرة وجودة التنفيذ'} summary={summary} index="▶"/>
    <section className="public-portfolio-page container"><div className="public-filter-bar" aria-label={isEnglish ? 'Portfolio filters' : 'تصنيفات الأعمال'}><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>{isEnglish ? 'All work' : 'كل الأعمال'}</button>{categories.map(category => <button key={category.id} className={filter === category.id ? 'active' : ''} onClick={() => setFilter(category.id)}>{isEnglish ? category.nameEn : category.nameAr}</button>)}</div><PublicPortfolioGrid items={items} categories={categories} isEnglish={isEnglish} emptyTitle={isEnglish ? 'No work in this filter yet' : 'لا توجد أعمال في هذا التصنيف بعد'} emptyText={isEnglish ? 'Choose another category or discuss a relevant project.' : 'اختر تصنيفًا آخر أو ناقش معنا مشروعًا مناسبًا.'}/></section>
  </main>;
}

export function StudiosPage() {
  const { i18n } = useTranslation(); const isEnglish = String(i18n.language).startsWith('en'); const summary = isEnglish ? 'Explore the current October, Lebanon Square and New Cairo studio galleries.' : 'تعرّف على استديوهات أكتوبر وميدان لبنان والقاهرة الجديدة من الصور الحالية.';
  return <main id="main-content" className="public-page"><SEO title={isEnglish ? 'Professional Studios' : 'الاستديوهات'} description={summary} url="/studios" section="studio"/><PageHero eyebrow={isEnglish ? 'Spaces built for production' : 'مساحات مجهزة للإنتاج'} title={isEnglish ? 'Choose the studio that fits the format' : 'اختر الاستديو الأنسب لشكل المحتوى'} summary={summary} index="03"/><Suspense fallback={<div className="public-section-loading" role="status">{isEnglish ? 'Loading studios…' : 'جاري تحميل الاستديوهات…'}</div>}><StudioShowcase/></Suspense><section className="public-inline-cta container"><div><span>{isEnglish ? 'Plan the session' : 'خطط للجلسة'}</span><h2>{isEnglish ? 'Tell us the format, guests and expected recording time.' : 'شاركنا نوع المحتوى وعدد الضيوف والوقت المتوقع للتسجيل.'}</h2></div><Link to="/contact?service=studio-content-production" className="public-solid-button">{isEnglish ? 'Book a conversation' : 'ابدأ الحجز'}<DirectionArrow isEnglish={isEnglish}/></Link></section></main>;
}

export function PublicNotFound() {
  const { i18n } = useTranslation(); const isEnglish = String(i18n.language).startsWith('en');
  return <main id="main-content" className="public-page public-not-found"><SEO title={isEnglish ? 'Page not found' : 'الصفحة غير موجودة'} description={isEnglish ? 'The requested page could not be found.' : 'تعذر العثور على الصفحة المطلوبة.'} url="/404" noIndex/><span>404</span><h1>{isEnglish ? 'This page is not part of the current site' : 'هذه الصفحة غير موجودة في الموقع الحالي'}</h1><p>{isEnglish ? 'Return home, explore the services, or contact the team.' : 'يمكنك العودة للرئيسية أو استكشاف الخدمات أو التواصل مع الفريق.'}</p><div><Link className="public-solid-button" to="/">{isEnglish ? 'Home' : 'الرئيسية'}</Link><Link className="public-ghost-button" to="/services">{isEnglish ? 'Services' : 'الخدمات'}</Link><Link className="public-ghost-button" to="/contact">{isEnglish ? 'Contact' : 'تواصل معنا'}</Link></div></main>;
}
