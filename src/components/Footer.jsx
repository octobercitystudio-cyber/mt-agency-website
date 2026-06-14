import React from 'react';
import { useTranslation } from 'react-i18next';
import { useData } from '../store/DataContext';
import './Footer.css';

const Footer = () => {
  const { t, i18n } = useTranslation();
  const { siteData } = useData();
  const isEnglish = i18n.language === 'en';
  
  const { contact, footer } = siteData;

  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer-section">
      <div className="container">
        <div className="footer-grid">
          
          <div className="footer-col footer-col-about">
            <img src="/logo.webp" alt="MT Agency Logo" className="footer-logo" width="80" height="80"
                 onError={(e) => { e.target.style.display = 'none'; }} />
            <p className="footer-desc">
              {isEnglish 
                ? (footer?.descEn || "MT Agency specializes in media production, digital marketing, and creating visually stunning content that drives real impact for your business.")
                : (footer?.descAr || "إم تي إيجنسي متخصصة في الإنتاج الإعلامي والتسويق الرقمي وصناعة محتوى مرئي يخطف الأنظار ويصنع تأثيراً حقيقياً لأعمالك.")}
            </p>
          </div>
          
          <div className="footer-col">
            <h3>{isEnglish ? "Quick Links" : "روابط سريعة"}</h3>
            <div className="footer-links">
              <a href="#home">{t('header.home')}</a>
              <a href="#about">{t('header.about')}</a>
              <a href="#services">{t('header.services')}</a>
              <a href="#portfolio">{t('header.portfolio')}</a>
              <a href="#studio">{t('header.studio')}</a>
              <a href="#contact">{t('header.contact')}</a>
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
                  <span dir="ltr" style={{textAlign: isEnglish ? 'left' : 'right'}}>{contact.phone}</span>
                  {contact.phone2 && (
                    <span dir="ltr" style={{textAlign: isEnglish ? 'left' : 'right'}}>{contact.phone2}</span>
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
          <p>&copy; {currentYear} {isEnglish ? (footer?.copyrightEn || "MT Agency. All Rights Reserved.") : (footer?.copyrightAr || "MT Agency. جميع الحقوق محفوظة.")}</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
