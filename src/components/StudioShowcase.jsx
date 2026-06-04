import React from 'react';
import './StudioShowcase.css';

const images = [
  { id: 1, url: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', alt: 'Studio setup' },
  { id: 2, url: 'https://images.unsplash.com/photo-1516280440502-a2283be36f86?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', alt: 'Camera gear' },
  { id: 3, url: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', alt: 'Audio equipment' },
  { id: 4, url: 'https://images.unsplash.com/photo-1533280842240-547df9d94269?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', alt: 'Lighting' }
];

const StudioShowcase = () => {
  return (
    <section id="studio" className="showcase-section">
      <div className="container">
        <h2 className="section-title">استوديوهات <span className="text-gradient">احترافية</span></h2>
        
        <div className="showcase-grid">
          {images.map(img => (
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
