import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useData } from '../store/DataContext';
import './StudioShowcase.css';

const StudioShowcase = () => {
  const { t } = useTranslation();
  const { siteData } = useData();
  const [activeTab, setActiveTab] = useState('october');

  const tabs = t('studio.tabs', { returnObjects: true });
  const tabKeys = Object.keys(tabs);
  const studioData = siteData.studio;

  return (
    <section id="studio" className="showcase-section">
      <div className="container">
        <h2 className="section-title">
          {t('studio.title1')} <span className="text-gradient">{t('studio.title2')}</span>
        </h2>
        
        <div className="studio-tabs">
          {tabKeys.map((key) => (
            <button 
              key={key} 
              className={`studio-tab-btn ${activeTab === key ? 'active' : ''}`}
              onClick={() => setActiveTab(key)}
            >
              {tabs[key]}
            </button>
          ))}
        </div>
        
        <div className="showcase-grid">
          {studioData[activeTab].map(img => (
            <div key={img.id} className="showcase-item">
              <img src={img.url} alt={img.alt} loading="lazy" />
              <div className="showcase-overlay">
                <div className="overlay-icon">✦</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StudioShowcase;
