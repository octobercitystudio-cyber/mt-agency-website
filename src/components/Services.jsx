import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useData } from '../store/DataContext';
import { publicServiceCatalog } from '../data/publicServiceCatalog';
import { localizePublicPath } from '../lib/publicRoutes';
import './Services.css';

export default function Services() {
  const { t, i18n } = useTranslation(); const { siteData } = useData(); const isEnglish = String(i18n.language).startsWith('en');
  return <section id="services" className="services-section"><div className="container"><h2 className="section-title">{t('services.title1')} <span className="text-gradient">{t('services.title2')}</span></h2>
    <div className="services-grid">{publicServiceCatalog.map((service, index) => {
      const editable = (siteData.services || []).find(item => item.slug === service.slug); const copy = isEnglish ? service.en : service.ar;
      return <Link key={service.slug} to={localizePublicPath(`/services/${service.slug}`, isEnglish ? 'en' : 'ar')} className="service-card glass-panel"><img className="reference-home-service-photo" src={service.heroImage} alt="" width="960" height="640" loading="lazy" decoding="async"/><div className="card-glow"/><span className="service-card__number">{String(index + 1).padStart(2, '0')}</span><h3 className="service-title">{(isEnglish ? editable?.titleEn : editable?.title) || copy.navLabel}</h3><p className="service-desc">{copy.cardSummary}</p><span className="service-card__link">{isEnglish ? 'Service details' : 'تفاصيل الخدمة'}{isEnglish ? <ArrowRight/> : <ArrowLeft/>}</span></Link>;
    })}</div><div className="services-all-link"><Link to={localizePublicPath('/services', isEnglish ? 'en' : 'ar')}>{isEnglish ? 'View all service details' : 'عرض تفاصيل كل الخدمات'}{isEnglish ? <ArrowRight/> : <ArrowLeft/>}</Link></div>
  </div></section>;
}
