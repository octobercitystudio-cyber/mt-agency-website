import React from 'react';
import { useTranslation } from 'react-i18next';
import { useData } from '../store/DataContext';
import './Hero.css';

const Hero = () => {
  const { t, i18n } = useTranslation();
  const { siteData } = useData();
  const isEnglish = i18n.language === 'en';
  
  const heroData = siteData.hero;

  return (
    <section id="home" className="hero-section">
      <div className="container hero-container">
        
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
        
        <div className="hero-visual">
          <div className="monogram-container glass-panel">
            <img src="/logo.png" alt="MT Agency Large Logo" className="hero-main-logo" 
                 onError={(e) => {
                   e.target.style.display = 'none';
                   e.target.nextSibling.style.display = 'block';
                 }} 
            />
            {/* Fallback geometric monogram if logo is missing */}
            <div className="hero-logo-fallback" style={{display: 'none', textAlign: 'center'}}>
               <span style={{color: 'var(--color-vibrant-purple)', fontSize: '8rem', fontWeight: '900'}}>{t('hero.fallbackLogoTitle')[0]}</span>
               <span style={{color: 'var(--color-silver)', fontSize: '8rem', fontWeight: '900'}}>{t('hero.fallbackLogoTitle')[1]}</span>
            </div>
            <div className="glow-effect"></div>
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
