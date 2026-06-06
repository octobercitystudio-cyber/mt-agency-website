import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useData } from '../store/DataContext';
import './About.css';

const About = () => {
  const { t, i18n } = useTranslation();
  const { siteData } = useData();
  const isEnglish = i18n.language === 'en';
  
  const aboutData = siteData.about;

  // Experience Counter State
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const counterRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasAnimated) {
          setHasAnimated(true);
        }
      },
      { threshold: 0.3 }
    );

    if (counterRef.current) {
      observer.observe(counterRef.current);
    }

    return () => observer.disconnect();
  }, [hasAnimated]);

  useEffect(() => {
    if (hasAnimated) {
      let start = 0;
      const end = 15;
      const duration = 2000;
      const incrementTime = duration / end;

      const timer = setInterval(() => {
        start += 1;
        setCount(start);
        if (start === end) clearInterval(timer);
      }, incrementTime);

      return () => clearInterval(timer);
    }
  }, [hasAnimated]);

  return (
    <section id="about" className="about-section" ref={counterRef}>
      <div className="container">
        <div className="about-grid">
          
          {/* Left Column: Huge Experience Counter */}
          <div className="experience-box glass-panel">
            <div className="counter-number">
              {count}<span>+</span>
            </div>
            <div className="counter-text">
              <h2>{t('experience.title')}</h2>
              <p dir="auto">{t('experience.description')}</p>
            </div>
          </div>

          {/* Right Column: About Us Content */}
          <div className="about-content glass-panel">
            <h2 className="section-title">{t('about.title1')} <span className="text-gradient">{t('about.title2')}</span></h2>
            
            <div className="about-text">
              <p dangerouslySetInnerHTML={{ __html: isEnglish ? aboutData.p1En : aboutData.p1 }}></p>
            </div>
            
            <div className="about-stats">
              <div className="stat-item">
                <h3>{aboutData.successfulProjects}</h3>
                <span>{t('about.stats.projects')}</span>
              </div>
              <div className="stat-item">
                <h3>{aboutData.expertsCount}</h3>
                <span>{t('about.stats.experts')}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default About;
