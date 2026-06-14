import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useData } from '../store/DataContext';
import './Portfolio.css';

const Portfolio = () => {
  const { t, i18n } = useTranslation();
  const { siteData } = useData();
  const categories = siteData.portfolioCategories || [];
  const [filter, setFilter] = useState(categories.length > 0 ? categories[0].id : '');
  const isEnglish = i18n.language === 'en';
  
  const portfolioItems = siteData.portfolio;

  const filteredPortfolio = portfolioItems.filter(item => item.category === filter);

  const getYouTubeId = (url) => {
    if (!url) return '';
    if (url.includes('youtube.com/embed/')) return url.split('embed/')[1]?.split('?')[0];
    
    let videoId = '';
    try {
      if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1]?.split('?')[0];
      } else if (url.includes('youtube.com/watch')) {
        const urlParams = new URLSearchParams(url.split('?')[1]);
        videoId = urlParams.get('v');
      } else if (url.includes('youtube.com/shorts/')) {
        videoId = url.split('youtube.com/shorts/')[1]?.split('?')[0];
      }
    } catch(e) {}
    
    return videoId || url;
  };

  const LiteYouTube = ({ url, title }) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const videoId = getYouTubeId(url);
    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

    if (isLoaded || !videoId) {
      const embedSrc = videoId === url ? url : `https://www.youtube.com/embed/${videoId}?autoplay=1`;
      return (
        <iframe 
          src={embedSrc} 
          title={title}
          frameBorder="0" 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
          allowFullScreen
          loading="lazy"
          style={{width: '100%', height: '100%', position: 'absolute', top: 0, left: 0}}
        ></iframe>
      );
    }

    return (
      <div 
        style={{width: '100%', height: '100%', cursor: 'pointer', position: 'absolute', top: 0, left: 0}}
        onClick={() => setIsLoaded(true)}
      >
        <img src={thumbnailUrl} alt={title} style={{width: '100%', height: '100%', objectFit: 'cover'}} loading="lazy" />
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: '68px', height: '48px', backgroundColor: 'rgba(255,0,0,0.9)', borderRadius: '12px',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
        }}>
          <div style={{width: 0, height: 0, borderTop: '10px solid transparent', borderBottom: '10px solid transparent', borderLeft: '16px solid white', marginLeft: '4px'}}></div>
        </div>
      </div>
    );
  };

  return (
    <section id="portfolio" className="portfolio-section">
      <div className="container">
        <h2 className="section-title">
          {t('portfolio.title1')} <span className="text-gradient">{t('portfolio.title2')}</span>
        </h2>
        
        <div className="portfolio-filters">
          {categories.map(cat => (
            <button 
              key={cat.id} 
              className={`filter-btn ${filter === cat.id ? 'active' : ''}`}
              onClick={() => setFilter(cat.id)}
            >
              {isEnglish ? cat.nameEn : cat.nameAr}
            </button>
          ))}
        </div>
        
        <div className="portfolio-grid">
          {filteredPortfolio.map((item, index) => (
            <div key={item.id || index} className="portfolio-item glass-panel">
              <div className="portfolio-media">
                {item.projectUrl ? (
                  <a href={item.projectUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', width: '100%', height: '100%' }}>
                    <img src={item.imageUrl} alt={`${isEnglish ? item.titleEn : item.title} ${isEnglish ? '- MT Agency Portfolio' : '- معرض أعمال إم تي إيجنسي'}`} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </a>
                ) : item.embedUrl ? (
                  <LiteYouTube url={item.embedUrl} title={isEnglish ? item.titleEn : item.title} />
                ) : (
                  <img src={item.imageUrl} alt={`${isEnglish ? item.titleEn : item.title} ${isEnglish ? '- MT Agency Portfolio' : '- معرض أعمال إم تي إيجنسي'}`} loading="lazy" />
                )}
                <div className="portfolio-overlay" style={{pointerEvents: 'none'}}>
                  {item.projectUrl ? (
                    <a href={item.projectUrl} target="_blank" rel="noopener noreferrer" className="overlay-icon" style={{ textDecoration: 'none', pointerEvents: 'auto' }}>🔗</a>
                  ) : item.embedUrl ? null : (
                    <div className="overlay-icon">▶</div>
                  )}
                </div>
              </div>
              <div className="portfolio-info">
                <h3>{isEnglish ? item.titleEn : item.title}</h3>
                <span>{categories.find(c => c.id === item.category)?.[isEnglish ? 'nameEn' : 'nameAr'] || item.category}</span>
              </div>
            </div>
          ))}
        </div>
        
      </div>
    </section>
  );
};

export default Portfolio;
