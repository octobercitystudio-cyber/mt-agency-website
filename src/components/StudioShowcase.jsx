import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useData } from '../store/DataContext';
import './StudioShowcase.css';

const StudioShowcase = () => {
  const { t, i18n } = useTranslation();
  const { siteData } = useData();
  const [activeTab, setActiveTab] = useState('october');
  const isEnglish = i18n.language === 'en';

  const tabs = siteData.studioCategories || [];
  const studioData = siteData.studio;

  return (
    <section id="studio" className="showcase-section">
      <div className="container">
        <h2 className="section-title">
          {t('studio.title1')} <span className="text-gradient">{t('studio.title2')}</span>
        </h2>
        
        <div className="studio-tabs">
          {tabs.map((tab) => (
            <button 
              key={tab.id} 
              className={`studio-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {i18n.language === 'en' ? tab.nameEn : tab.nameAr}
            </button>
          ))}
        </div>
        
        <div className="showcase-grid">
          {studioData[activeTab] && studioData[activeTab].map(img => (
            <div key={img.id || img.url} className="showcase-item">
              <img src={img.url} alt={`${isEnglish ? 'MT Agency Studio - ' : 'استوديو تصوير إم تي إيجنسي - '}${img.alt || ''}`} loading="lazy" />
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
