import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useData } from '../store/DataContext';
import './Portfolio.css';

const Portfolio = () => {
  const { t, i18n } = useTranslation();
  const { siteData } = useData();
  const [filter, setFilter] = useState('all');
  const isEnglish = i18n.language === 'en';
  
  const portfolioItems = siteData.portfolio;
  const categories = t('portfolio.categories', { returnObjects: true });

  const filteredPortfolio = filter === 'all' 
    ? portfolioItems 
    : portfolioItems.filter(item => item.category === filter);

  return (
    <section id="portfolio" className="portfolio-section">
      <div className="container">
        <h2 className="section-title">
          {t('portfolio.title1')} <span className="text-gradient">{t('portfolio.title2')}</span>
        </h2>
        
        <div className="portfolio-filters">
          {Object.keys(categories).map(key => (
            <button 
              key={key} 
              className={`filter-btn ${filter === key ? 'active' : ''}`}
              onClick={() => setFilter(key)}
            >
              {categories[key]}
            </button>
          ))}
        </div>
        
        <div className="portfolio-grid">
          {filteredPortfolio.map((item, index) => (
            <div key={item.id || index} className="portfolio-item glass-panel">
              <div className="portfolio-media">
                {item.projectUrl ? (
                  <a href={item.projectUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', width: '100%', height: '100%' }}>
                    <img src={item.imageUrl} alt={isEnglish ? item.titleEn : item.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </a>
                ) : item.embedUrl ? (
                  <iframe 
                    src={item.embedUrl} 
                    title={isEnglish ? item.titleEn : item.title}
                    frameBorder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowFullScreen
                  ></iframe>
                ) : (
                  <img src={item.imageUrl} alt={isEnglish ? item.titleEn : item.title} loading="lazy" />
                )}
                <div className="portfolio-overlay">
                  {item.projectUrl ? (
                    <a href={item.projectUrl} target="_blank" rel="noopener noreferrer" className="overlay-icon" style={{ textDecoration: 'none' }}>🔗</a>
                  ) : (
                    <div className="overlay-icon">▶</div>
                  )}
                </div>
              </div>
              <div className="portfolio-info">
                <h3>{isEnglish ? item.titleEn : item.title}</h3>
                <span>{categories[item.category] || item.category}</span>
              </div>
            </div>
          ))}
        </div>
        
      </div>
    </section>
  );
};

export default Portfolio;
