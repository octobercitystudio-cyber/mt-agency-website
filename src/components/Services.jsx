import React from 'react';
import { useTranslation } from 'react-i18next';
import './Services.css';

const serviceIcons = ['📸', '🎪', '🎙️', '🤖', '🎨', '📱', '💻'];

const Services = () => {
  const { t } = useTranslation();
  const services = t('services.items', { returnObjects: true });

  return (
    <section id="services" className="services-section">
      <div className="container">
        <h2 className="section-title">
          {t('services.title1')} <span className="text-gradient">{t('services.title2')}</span>
        </h2>
        
        <div className="services-grid">
          {Array.isArray(services) && services.map((service, index) => (
            <div key={index} className="service-card glass-panel">
              <div className="service-icon-wrapper">
                <div className="service-icon">{serviceIcons[index]}</div>
              </div>
              <h3 className="service-title">{service.title}</h3>
              <p className="service-desc">{service.desc}</p>
              <div className="card-glow"></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Services;
