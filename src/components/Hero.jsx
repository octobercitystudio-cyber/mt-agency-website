import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useData } from '../store/DataContext';
import './Hero.css';

const Hero = () => {
  const { t, i18n } = useTranslation();
  const { siteData } = useData();
  const isEnglish = i18n.language === 'en';
  
  const heroData = siteData.hero;

  const sliderImages = [
    '/hero-service-1-small.webp', // Photography
    '/hero-service-2-small.webp', // AI Video
    '/hero-service-3-small.webp', // Creative Design
    '/hero-service-4-small.webp'  // Social Media
  ];

  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % sliderImages.length);
    }, 4000); // Change image every 4 seconds
    return () => clearInterval(interval);
  }, [sliderImages.length]);

  return (
    <section id="home" className="hero-section">
      <div className="container hero-container">
        
        {/* Visual Slider (Right side in RTL, or top in mobile) */}
        <div className="hero-visual">
          <div className="visual-banner">
            {sliderImages.map((img, index) => {
              const altTexts = ['تصوير منتجات احترافي', 'إنتاج فيديو سينمائي', 'تصميم هويات بصرية', 'إدارة منصات التواصل الاجتماعي'];
              return (
              <img 
                key={index} 
                src={img} 
                alt={`${altTexts[index]} - MT Agency`}
                className={`hero-slider-img ${index === currentImageIndex ? 'active' : ''}`}
                width="600" height="600"
                fetchpriority={index === 0 ? "high" : "auto"}
                loading={index === 0 ? "eager" : "lazy"}
              />
            )})}
            <div className="visual-overlay"></div>
          </div>
        </div>
        
        {/* Text Content (Left side in RTL, or bottom in mobile) */}
        <div className="hero-content">
          <h1 className="hero-title">
            {isEnglish ? heroData.title1En : heroData.title1}{' '}
            <span className="text-gradient">{isEnglish ? heroData.title2En : heroData.title2}</span>
          </h1>
          <p className="hero-subtitle">
            {isEnglish ? heroData.subtitleEn : heroData.subtitle}
          </p>
          <div className="hero-actions">
            <a href="#portfolio" className="btn-primary">{t('hero.discover')}</a>
            <a href="#contact" className="btn-secondary">{t('hero.contact')}</a>
          </div>
        </div>
        
      </div>
      
      {/* Background elements */}
      <div className="bg-blob blob-1"></div>
      <div className="bg-blob blob-2"></div>
    </section>
  );
};

export default Hero;
