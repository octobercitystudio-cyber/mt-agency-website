import React from 'react';
import { useTranslation } from 'react-i18next';
import { useData } from '../store/DataContext';
import './Services.css';

const Services = () => {
  const { t, i18n } = useTranslation();
  const { siteData } = useData();
  const isEnglish = i18n.language === 'en';

  // Use dynamic services from the DataContext
  const services = siteData.services;

  return (
    <section id="services" className="services-section">
      <div className="container">
        <h2 className="section-title">
          {t('services.title1')} <span className="text-gradient">{t('services.title2')}</span>
        </h2>
        
        <div className="services-grid">
          {services.map((service, index) => (
            <div key={index} className="service-card glass-panel">
              <div className="card-glow"></div>
              <div className="service-icon-wrapper">
                <span className="service-icon">{service.icon}</span>
              </div>
              <h3 className="service-title">{isEnglish ? service.titleEn : service.title}</h3>
              <p className="service-desc">{isEnglish ? service.descEn : service.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Services;
