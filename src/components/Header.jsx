import React, { useState, useEffect } from 'react';
import './Header.css';

const Header = () => {
  const [lang, setLang] = useState('ar');

  const toggleLanguage = () => {
    const newLang = lang === 'ar' ? 'en' : 'ar';
    setLang(newLang);
    document.documentElement.lang = newLang;
    document.body.dir = newLang === 'ar' ? 'rtl' : 'ltr';
    // Here we can also add logic to update texts site-wide via Context or Redux
  };

  const navLinks = [
    { name: 'الرئيسية', href: '#home' },
    { name: 'من نحن', href: '#about' },
    { name: 'خدماتنا', href: '#services' },
    { name: 'أعمالنا', href: '#portfolio' },
    { name: 'استوديو', href: '#studio' },
    { name: 'تواصل معنا', href: '#contact' },
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
          {lang === 'ar' ? 'EN' : 'عربي'}
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
          الحصول على عرض سعر
        </a>
      </div>
    </div>
  );
};

export default Header;
