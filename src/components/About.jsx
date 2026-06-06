import React from 'react';
import { useTranslation } from 'react-i18next';
import { useData } from '../store/DataContext';
import './About.css';

const About = () => {
  const { t, i18n } = useTranslation();
  const { siteData } = useData();
  const isEnglish = i18n.language === 'en';
  
  const aboutData = siteData.about;

  return (
    <section id="about" className="about-section">
      <div className="container">
        <div className="about-content glass-panel">
          <h2 className="section-title">{t('about.title1')} <span className="text-gradient">{t('about.title2')}</span></h2>
          
          <div className="about-text">
            <p dangerouslySetInnerHTML={{ __html: isEnglish ? aboutData.p1En : aboutData.p1 }}></p>
            <p dangerouslySetInnerHTML={{ __html: isEnglish ? aboutData.p2En : aboutData.p2 }}></p>
            <p dangerouslySetInnerHTML={{ __html: isEnglish ? aboutData.p3En : aboutData.p3 }}></p>
          </div>
          
          <div className="about-stats">
            <div className="stat-item">
              <h3>{aboutData.yearsOfExperience}</h3>
              <span>{t('about.stats.years')}</span>
            </div>
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
    </section>
  );
};

export default About;
