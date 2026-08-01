import React from 'react';
import { useTranslation } from 'react-i18next';
import { useData } from '../store/DataContext';
import './Testimonials.css';

const Testimonials = () => {
  const { t, i18n } = useTranslation();
  const { siteData } = useData();
  const isEnglish = i18n.language === 'en';

  if (!siteData?.testimonials || siteData.testimonials.length === 0) return null;

  return (
    <section id="testimonials" className="testimonials-section">
      <div className="container">
        <div className="section-header text-center" data-aos="fade-up">
          <h2 className="section-title">
            {isEnglish ? 'Client Testimonials' : 'آراء شركاء النجاح'}
          </h2>
          <p className="section-subtitle">
            {isEnglish 
              ? 'What our clients say about their experience with us.' 
              : 'ماذا يقول عملاؤنا عن تجربتهم معنا'}
          </p>
        </div>

        <div className="testimonials-grid">
          {siteData.testimonials.map((testi, idx) => (
            <div 
              key={testi.id} 
              className="testimonial-card" 
              data-aos="fade-up" 
              data-aos-delay={idx * 100}
            >
              <div className="quote-icon">❝</div>
              <p className="testimonial-text">
                {isEnglish ? testi.textEn : testi.textAr}
              </p>
              <div className="testimonial-author">
                <div className="author-info">
                  <h4 className="author-name">
                    {isEnglish ? testi.authorEn : testi.authorAr}
                  </h4>
                  <span className="author-role">
                    {isEnglish ? testi.roleEn : testi.roleAr}
                  </span>
                  <span className="author-company">
                    {isEnglish ? testi.companyEn : testi.companyAr}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
