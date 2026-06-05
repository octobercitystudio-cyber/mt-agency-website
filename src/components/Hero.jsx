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
    '/hero-service-1.png', // Photography
    '/hero-service-2.png', // AI Video
    '/hero-service-3.png', // Creative Design
    '/hero-service-4.png'  // Social Media
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
      <div className="container">
        <div className="hero-banner-wrapper glass-panel">
          
          {/* Background Slider */}
          <div className="slider-container">
            {sliderImages.map((img, index) => (
              <img 
                key={index}
                src={img} 
                alt={`Our Service ${index + 1}`} 
                className={`hero-slider-img ${index === currentImageIndex ? 'active' : ''}`}
              />
            ))}
            <div className="hero-overlay"></div>
          </div>
          
          {/* Text Content */}
          <div className="hero-content">
            <h1 className="hero-title">
              <span className="text-gradient">{isEnglish ? heroData.title1En : heroData.title1}</span><br/>
              {isEnglish ? heroData.title2En : heroData.title2}
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
      </div>
      
      {/* Background elements */}
      <div className="bg-blob blob-1"></div>
      <div className="bg-blob blob-2"></div>
    </section>
  );
};

export default Hero;
