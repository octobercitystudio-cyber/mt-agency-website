import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useData } from '../store/DataContext';
import { getStudioFallback, STUDIO_CATEGORIES } from '../data/studioGalleries';
import './StudioShowcase.css';

const StudioShowcase = () => {
  const { t, i18n } = useTranslation();
  const { siteData } = useData();
  const [activeTab, setActiveTab] = useState('october');
  const isEnglish = i18n.language === 'en';

  const tabs = siteData.studioCategories || STUDIO_CATEGORIES;
  const studioData = siteData.studio || {};

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
              {isEnglish ? tab.nameEn : tab.nameAr}
            </button>
          ))}
        </div>

        <div className="showcase-grid">
          {(studioData[activeTab] || []).map((img, index) => {
            const fallbackUrl = getStudioFallback(activeTab, index);
            const imageUrl = img.url || fallbackUrl;
            const studioName = tabs.find((tab) => tab.id === activeTab);
            const defaultAlt = isEnglish
              ? `${studioName?.nameEn || 'MT Agency Studio'} - image ${index + 1}`
              : `${studioName?.nameAr || 'استديو MT Agency'} - صورة ${index + 1}`;

            return (
              <div
                key={img.id || img.url || `${activeTab}-${index}`}
                className="showcase-item"
                style={fallbackUrl ? { backgroundImage: `url("${fallbackUrl}")` } : undefined}
              >
                <img
                  src={imageUrl}
                  alt={(isEnglish ? img.altEn : img.alt) || img.alt || defaultAlt}
                  loading="lazy"
                  decoding="async"
                  onError={(event) => {
                    const fallbackHref = fallbackUrl
                      ? new URL(fallbackUrl, window.location.origin).href
                      : '';

                    if (fallbackUrl && event.currentTarget.src !== fallbackHref) {
                      event.currentTarget.src = fallbackUrl;
                      return;
                    }

                    event.currentTarget.hidden = true;
                  }}
                />
                <div className="showcase-overlay">
                  <div className="overlay-icon">✦</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default StudioShowcase;
