import React, { useState } from 'react';
import './Portfolio.css';

const portfolioData = [
  { id: 1, category: 'فيديو', title: 'إعلان تجاري', embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
  { id: 2, category: 'تصميم', title: 'هوية بصرية', imageUrl: 'https://images.unsplash.com/photo-1626785773985-92731114b0b1?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80' },
  { id: 3, category: 'ريلز', title: 'حملة سوشيال ميديا', embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
  { id: 4, category: 'بودكاست', title: 'حلقة بودكاست', embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
  { id: 5, category: 'فيديو', title: 'تغطية فعالية', embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
  { id: 6, category: 'تصميم', title: 'موقع إلكتروني', imageUrl: 'https://images.unsplash.com/photo-1547658719-da2b51169166?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80' }
];

const categories = ['الكل', 'فيديو', 'تصميم', 'ريلز', 'بودكاست'];

const Portfolio = () => {
  const [filter, setFilter] = useState('الكل');

  const filteredData = filter === 'الكل' 
    ? portfolioData 
    : portfolioData.filter(item => item.category === filter);

  return (
    <section id="portfolio" className="portfolio-section">
      <div className="container">
        <h2 className="section-title">معرض <span className="text-gradient">الأعمال</span></h2>
        
        <div className="portfolio-filters">
          {categories.map((cat, index) => (
            <button 
              key={index} 
              className={`filter-btn ${filter === cat ? 'active' : ''}`}
              onClick={() => setFilter(cat)}
            >
              {cat}
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
                <span>{item.category}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Portfolio;
