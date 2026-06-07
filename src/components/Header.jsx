import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu, X, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import './Header.css';

const Header = () => {
  const { t, i18n } = useTranslation();
  const [lang, setLang] = useState(i18n.language);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
      {/* Right Column: Logo & Language & Hamburger */}
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
          {lang === 'ar' ? 'EN' : 'AR'}
        </button>

        <button className="mobile-menu-btn" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* Mobile Menu Backdrop */}
      <div 
        className={`mobile-menu-backdrop ${isMenuOpen ? 'open' : ''}`} 
        onClick={() => setIsMenuOpen(false)}
      ></div>

      {/* Center & Left Columns: Navigation (Side Drawer on mobile) */}
      <div className={`mobile-nav-wrapper ${isMenuOpen ? 'open' : ''}`}>
        <button className="close-menu-btn" onClick={() => setIsMenuOpen(false)}>
          <X size={28} />
        </button>

        <div className="top-bar-center">
          <header className="header-nav">
            <nav className="main-nav">
              <ul className="nav-list">
                {navLinks.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} className="nav-link" onClick={() => setIsMenuOpen(false)}>
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </header>
        </div>

        <div className="top-bar-left" style={{ display: 'flex', gap: '10px' }}>
          <Link to="/login" className="btn-secondary login-btn" onClick={() => setIsMenuOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <User size={16} /> تسجيل الدخول
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Header;
