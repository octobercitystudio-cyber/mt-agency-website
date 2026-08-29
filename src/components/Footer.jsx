import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useData } from '../store/DataContext';
import { companyPhoneTel, normalizeCompanyPhone } from '../lib/companyContact';
import { localizePublicPath } from '../lib/publicRoutes';
import './Footer.css';

const Footer = () => {
  const { t, i18n } = useTranslation();
  const { siteData } = useData();
  const isEnglish = i18n.language === 'en';
  
  const { contact, footer } = siteData;
  const primaryPhone = normalizeCompanyPhone(contact.phone);
  const secondaryPhone = normalizeCompanyPhone(contact.phone2);
  const publicPath = value => localizePublicPath(value, isEnglish ? 'en' : 'ar');

  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer-section">
      <div className="container">
        <div className="footer-grid">
          
          <div className="footer-col footer-col-about">
            <img src="/logo.webp" alt="Multi Task Agency Logo" className="footer-logo" width="80" height="80"
                 onError={(e) => { e.target.style.display = 'none'; }} />
            <p className="footer-desc">
              {isEnglish 
                ? (footer?.descEn || "Multi Task Agency provides media production, digital marketing and technology services from 6th of October City, Giza.")
                : (footer?.descAr || "Multi Task Agency تقدم خدمات الإنتاج الإعلامي والتسويق الرقمي والحلول التقنية من مدينة 6 أكتوبر، الجيزة.")}
            </p>
          </div>
          
          <div className="footer-col">
            <h3>{isEnglish ? "Quick Links" : "روابط سريعة"}</h3>
            <div className="footer-links">
              <Link to={publicPath('/')}>{t('header.home')}</Link>
              <Link to={publicPath('/about')}>{t('header.about')}</Link>
              <Link to={publicPath('/services')}>{t('header.services')}</Link>
              <Link to={publicPath('/portfolio')}>{t('header.portfolio')}</Link>
              <Link to={publicPath('/studios')}>{t('header.studio')}</Link>
              <Link to={publicPath('/contact')}>{t('header.contact')}</Link>
            </div>
          </div>

          <div className="footer-col">
            <h3>{isEnglish ? "Contact Us" : "تواصل معنا"}</h3>
            <div className="footer-contact">
              <div className="footer-contact-item">
                <span className="footer-contact-icon">📍</span>
                <span>{isEnglish ? contact.addressEn : contact.address}</span>
              </div>
              <div className="footer-contact-item">
                <span className="footer-contact-icon">📞</span>
                <div style={{display: 'flex', flexDirection: 'column', gap: '5px'}}>
                  {primaryPhone && <a href={`tel:${companyPhoneTel(contact.phone)}`} dir="ltr" style={{textAlign: isEnglish ? 'left' : 'right'}}>{primaryPhone}</a>}
                  {secondaryPhone && (
                    <a href={`tel:${companyPhoneTel(contact.phone2)}`} dir="ltr" style={{textAlign: isEnglish ? 'left' : 'right'}}>{secondaryPhone}</a>
                  )}
                </div>
              </div>
              <div className="footer-contact-item">
                <span className="footer-contact-icon">✉️</span>
                <span dir="ltr">{contact.email}</span>
              </div>
            </div>
          </div>
          
        </div>
        
        <div className="footer-bottom">
          <p>&copy; {currentYear} {isEnglish ? (footer?.copyrightEn || "Multi Task Agency. All Rights Reserved.") : (footer?.copyrightAr || "Multi Task Agency. جميع الحقوق محفوظة.")}</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
