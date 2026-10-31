import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { localizePublicPath } from '../lib/publicRoutes';
import './About.css';

const About = () => {
  const { t, i18n } = useTranslation();
  const isEnglish = i18n.language === 'en';

  return (
    <section id="about" className="about-section">
      <div className="container">
        <div className="reference-home-about">
        <figure><img src="/brand/gold/services/ai-video-production.webp" alt={isEnglish ? 'Illustrative content production workspace' : 'صورة توضيحية لمساحة إنتاج المحتوى'} width="960" height="640" loading="lazy" decoding="async"/></figure>
        <div className="about-content glass-panel">
          <h2 className="section-title">{t('about.title1')} <span className="text-gradient">{t('about.title2')}</span></h2>
          
          <div className="about-text"><p>{isEnglish
            ? 'We produce video and content, manage social channels, design brands and develop websites and software. Every project has an agreed scope and deliverables.'
            : 'ننتج الفيديو والمحتوى، وندير منصات التواصل، ونصمم الهويات البصرية والمواقع والبرمجيات. لكل مشروع نطاق ومخرجات متفق عليها.'}</p></div>
          <Link className="public-preview-link" to={localizePublicPath('/about', isEnglish ? 'en' : 'ar')}>{isEnglish ? 'About us' : 'اعرف المزيد'}</Link>
        </div>
        </div>
      </div>
    </section>
  );
};

export default About;
