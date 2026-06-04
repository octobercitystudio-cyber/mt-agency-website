import React from 'react';
import { useTranslation } from 'react-i18next';
import './About.css';

const About = () => {
  const { t } = useTranslation();

  return (
    <section id="about" className="about-section">
      <div className="container">
        <div className="about-content glass-panel">
          <h2 className="section-title">{t('about.title1')} <span className="text-gradient">{t('about.title2')}</span></h2>
          <div className="about-text">
            <p dangerouslySetInnerHTML={{ __html: t('about.p1') }}></p>
            <p>{t('about.p2')}</p>
            <p>{t('about.p3')}</p>
          </div>
          <div className="about-stats">
            <div className="stat-item">
              <h3>+15</h3>
              <span>{t('about.stats.years')}</span>
            </div>
            <div className="stat-item">
              <h3>+500</h3>
              <span>{t('about.stats.projects')}</span>
            </div>
            <div className="stat-item">
              <h3>+50</h3>
              <span>{t('about.stats.experts')}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
