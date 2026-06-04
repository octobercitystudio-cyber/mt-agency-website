import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './Header.css';

const Header = () => {
  const { t, i18n } = useTranslation();
  const [lang, setLang] = useState(i18n.language);

  const toggleLanguage = () => {
    const newLang = lang === 'ar' ? 'en' : 'ar';
    setLang(newLang);
    i18n.changeLanguage(newLang);
    document.documentElement.lang = newLang;
  };

  const navLinks = [
    { name: t('header.home'), href: '#home' },
    { name: t('header.about'), href: '#about' },
    { name: t('header.services'), href: '#services' },
    { name: t('header.portfolio'), href: '#portfolio' },
    { name: t('header.studio'), href: '#studio' },
    { name: t('header.contact'), href: '#contact' },
  ];

  return (
    <div className="top-bar">
      {/* Right Column: Logo & Language */}
      <div className="top-bar-right">
        <a href="#home" className="logo-link">
          <img src="/logo.png" alt="MT Agency Logo" className="header-logo" 
               onError={(e) => {
                 e.target.style.display = 'none';
                 e.target.nextSibling.style.display = 'flex';
               }} 
          />
          <div className="logo-fallback" style={{display: 'none'}}>
            <span style={{color: 'var(--color-vibrant-purple)', fontWeight: '900'}}>M</span>
            <span style={{color: 'var(--color-silver)', fontWeight: '900'}}>T</span>
          </div>
        </a>
        
        <button className="lang-btn" onClick={toggleLanguage}>
          {t('header.lang')}
        </button>
      </div>

      {/* Center Column: Navigation */}
      <div className="top-bar-center">
        <header className="header-nav">
          <nav className="main-nav">
            <ul className="nav-list">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="nav-link">{link.name}</a>
                </li>
              ))}
            </ul>
          </nav>
        </header>
      </div>

      {/* Left Column: Actions */}
      <div className="top-bar-left">
        <a href="#contact" className="btn-primary quote-btn">
          {t('header.getQuote')}
        </a>
      </div>
    </div>
  );
};

export default Header;
