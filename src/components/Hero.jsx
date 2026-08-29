import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useData } from '../store/DataContext';
import './Hero.css';

const HERO_SLIDES = [
  { small: '/hero-service-1-small.webp', tiny: '/hero-service-1-tiny.webp', alt: 'تصوير منتجات احترافي' },
  { small: '/hero-service-2-small.webp', tiny: '/hero-service-2-tiny.webp', alt: 'إنتاج فيديو سينمائي' },
  { small: '/hero-service-3-small.webp', tiny: '/hero-service-3-tiny.webp', alt: 'تصميم هويات بصرية' },
  { small: '/hero-service-4-small.webp', tiny: '/hero-service-4-tiny.webp', alt: 'إدارة منصات التواصل الاجتماعي' },
];

const Hero = () => {
  const { t, i18n } = useTranslation();
  const { siteData } = useData();
  const isEnglish = i18n.language === 'en';
  
  const heroData = siteData.hero;

  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 4000); // Change image every 4 seconds
    return () => clearInterval(interval);
  }, []);

  const activeSlide = HERO_SLIDES[currentImageIndex];

  return (
    <section id="home" className="hero-section">
      <div className="container hero-container">
        
        {/* Visual Slider (Right side in RTL, or top in mobile) */}
        <div className="hero-visual">
          <div className="visual-banner">
            <picture key={activeSlide.small}>
              <source media="(max-width: 520px)" srcSet={activeSlide.tiny} />
              <img
                src={activeSlide.small}
                alt={`${activeSlide.alt} - Multi Task Agency`}
                className="hero-slider-img active"
                width="800"
                height="800"
                fetchPriority={currentImageIndex === 0 ? 'high' : 'auto'}
                loading={currentImageIndex === 0 ? 'eager' : 'lazy'}
                decoding="async"
              />
            </picture>
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
