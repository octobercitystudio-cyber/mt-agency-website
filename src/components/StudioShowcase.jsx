import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './StudioShowcase.css';

const studioData = {
  october: [
    { id: 1, url: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', alt: 'October Studio setup' },
    { id: 2, url: 'https://images.unsplash.com/photo-1516280440502-a2283be36f86?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', alt: 'Camera gear' },
    { id: 3, url: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', alt: 'Audio equipment' },
    { id: 4, url: 'https://images.unsplash.com/photo-1533280842240-547df9d94269?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', alt: 'Lighting' }
  ],
  lebanon: [
    { id: 5, url: 'https://images.unsplash.com/photo-1605810230434-7631ac76ec81?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', alt: 'Lebanon Studio mic' },
    { id: 6, url: 'https://images.unsplash.com/photo-1559535332-db9971090158?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', alt: 'Camera lens' },
    { id: 7, url: 'https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', alt: 'Editing suite' },
    { id: 8, url: 'https://images.unsplash.com/photo-1551103782-8ab07afd45c1?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', alt: 'Podcast setup' }
  ],
  newCairo: [
    { id: 9, url: 'https://images.unsplash.com/photo-1520697830682-8b43bd5e0ff1?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', alt: 'New Cairo lighting' },
    { id: 10, url: 'https://images.unsplash.com/photo-1527380992061-b126c88cbb41?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', alt: 'Green screen' },
    { id: 11, url: 'https://images.unsplash.com/photo-1493225457124-a312e947f9c4?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', alt: 'Dark studio' },
    { id: 12, url: 'https://images.unsplash.com/photo-1530635439971-b65fa367c330?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', alt: 'Audio mixing' }
  ]
};

const StudioShowcase = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('october');

  const tabs = t('studio.tabs', { returnObjects: true });
  const tabKeys = Object.keys(tabs);

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
