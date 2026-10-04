import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useData } from '../store/DataContext';
import './Hero.css';

const HERO_SLIDES = [
  { small: '/hero-service-1-v2-small.webp', tiny: '/hero-service-1-v2-tiny.webp', alt: 'كاميرا وإضاءة للتصوير الاحترافي', altEn: 'Camera and lighting for professional photography' },
  { small: '/hero-service-2-v2-small.webp', tiny: '/hero-service-2-v2-tiny.webp', alt: 'كاميرا وشاشة وميكروفون لإنتاج الفيديو في الاستديو', altEn: 'Camera, monitor and microphone for studio video production' },
  { small: '/hero-service-3-v2-small.webp', tiny: '/hero-service-3-v2-tiny.webp', alt: 'لوحة رسم رقمية وأدوات التصميم الإبداعي', altEn: 'Drawing tablet and creative design tools' },
  { small: '/hero-service-4-v2-small.webp', tiny: '/hero-service-4-v2-tiny.webp', alt: 'هاتف وبطاقات محتوى لمنصات التواصل الاجتماعي', altEn: 'Phone and content cards for social media' },
];

const Hero = () => {
  const { t, i18n } = useTranslation();
  const { siteData } = useData();
  const isEnglish = i18n.language === 'en';
  
  const heroData = siteData.hero;

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [readyImages, setReadyImages] = useState({});
  // Keep only the first photo on the initial connection. Once decoded, prepare
  // the following slide; already loaded slides stay mounted for smooth dissolves.
  const loadedSlideCount = Math.min(HERO_SLIDES.length, currentImageIndex + (readyImages[currentImageIndex] ? 2 : 1));

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => {
        const next = (prev + 1) % HERO_SLIDES.length;
        return readyImages[next] ? next : prev;
      });
    }, 4000); // Change image every 4 seconds
    return () => clearInterval(interval);
  }, [readyImages]);

  return (
    <section id="home" className="hero-section">
      <div className="container hero-container">
        
        {/* Visual Slider (Right side in RTL, or top in mobile) */}
        <div className="hero-visual">
          <div className="visual-banner">
            {HERO_SLIDES.slice(0, Math.max(loadedSlideCount, ...Object.keys(readyImages).map(index => Number(index) + 1))).map((slide, index) => <picture key={slide.small}>
              <source media="(max-width: 520px)" srcSet={slide.tiny} />
              <img
                src={slide.small}
                alt={`${isEnglish ? slide.altEn : slide.alt} - Multi Task Agency`}
                className={`hero-slider-img${index === currentImageIndex ? ' active' : ''}`}
                aria-hidden={index !== currentImageIndex}
                width="800"
                height="800"
                fetchPriority={index === 0 ? 'high' : 'low'}
                loading="eager"
                decoding="async"
                onLoad={async (event) => {
                  const image = event.currentTarget;
                  try { await image.decode(); } catch { return; }
                  setReadyImages((current) => current[index] ? current : { ...current, [index]: true });
                }}
              />
            </picture>)}
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
