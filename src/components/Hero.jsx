import React from 'react';
import './Hero.css';

const Hero = () => {
  return (
    <section id="home" className="hero-section">
      <div className="container hero-container">
        <div className="hero-content">
          <h1 className="hero-title">
            نصنع رؤيتك،<br />
            <span className="text-gradient">ونقود التأثير</span>
          </h1>
          <p className="hero-subtitle">
            خلف كل محتوى عظيم، 15 عاماً من الخبرة. نحن نقدم لك الحلول الرقمية الشاملة.
          </p>
          <button className="btn-primary">ابدأ مشروعك الآن</button>
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
               <span style={{color: 'var(--color-vibrant-purple)', fontSize: '8rem', fontWeight: '900'}}>M</span>
               <span style={{color: 'var(--color-silver)', fontSize: '8rem', fontWeight: '900'}}>T</span>
            </div>
            <div className="glow-effect"></div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
