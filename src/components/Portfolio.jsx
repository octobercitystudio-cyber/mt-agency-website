import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './Portfolio.css';

const portfolioMedia = [
  { id: 1, embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
  { id: 2, imageUrl: 'https://images.unsplash.com/photo-1626785773985-92731114b0b1?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80' },
  { id: 3, embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
  { id: 4, embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
  { id: 5, embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
  { id: 6, imageUrl: 'https://images.unsplash.com/photo-1547658719-da2b51169166?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80' }
];

const Portfolio = () => {
  const { t } = useTranslation();
  const [filterKey, setFilterKey] = useState('all');

  const categories = t('portfolio.categories', { returnObjects: true });
  const items = t('portfolio.items', { returnObjects: true });

  const categoryKeys = Object.keys(categories); // ['all', 'video', 'design', 'reels', 'podcast']

  // Combine translations with media
  const portfolioData = items.map((item, index) => ({
    ...item,
    ...portfolioMedia[index],
    id: index + 1
  }));

  const filteredData = filterKey === 'all' 
    ? portfolioData 
    : portfolioData.filter(item => item.category === filterKey);

  return (
    <section id="portfolio" className="portfolio-section">
      <div className="container">
        <h2 className="section-title">
          {t('portfolio.title1')} <span className="text-gradient">{t('portfolio.title2')}</span>
        </h2>
        
        <div className="portfolio-filters">
          {categoryKeys.map((key) => (
            <button 
              key={key} 
              className={`filter-btn ${filterKey === key ? 'active' : ''}`}
              onClick={() => setFilterKey(key)}
            >
              {categories[key]}
            </button>
          ))}
        </div>

        <div className="portfolio-grid">
          {filteredData.map((item) => (
            <div key={item.id} className="portfolio-item glass-panel">
              <div className="portfolio-media">
                {item.embedUrl ? (
                  <iframe 
                    src={item.embedUrl} 
                    title={item.title}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                  ></iframe>
                ) : (
                  <img src={item.imageUrl} alt={item.title} loading="lazy" />
                )}
              </div>
              <div className="portfolio-info">
                <h4>{item.title}</h4>
                <span>{categories[item.category]}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Portfolio;
