import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Menu, User, X } from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useData } from '../store/DataContext';
import { publicServiceCatalog, publicServiceGroups } from '../data/publicServiceCatalog';
import './Header.css';

export default function Header() {
  const { t, i18n } = useTranslation(); const { isErpAuth } = useData(); const location = useLocation();
  const [lang, setLang] = useState(i18n.language); const [isMenuOpen, setIsMenuOpen] = useState(false); const [servicesOpen, setServicesOpen] = useState(false);
  const [isMobileHeader, setIsMobileHeader] = useState(() => window.matchMedia?.('(max-width: 769px)').matches || false);
  const headerRef = useRef(null); const servicesRef = useRef(null); const servicesTriggerRef = useRef(null);
  const menuTriggerRef = useRef(null); const closeMenuRef = useRef(null); const menuWasOpenRef = useRef(false);
  const isEnglish = String(lang).startsWith('en');
  const drawerClosed = isMobileHeader && !isMenuOpen;
  const drawerTabIndex = drawerClosed ? -1 : undefined;
  const servicesTabIndex = drawerClosed || (isMobileHeader && !servicesOpen) ? -1 : undefined;

  useEffect(() => {
    const applyLanguage = nextLanguage => { const next = String(nextLanguage || '').startsWith('en') ? 'en' : 'ar'; setLang(next); document.documentElement.lang = next; document.documentElement.dir = next === 'en' ? 'ltr' : 'rtl'; };
    applyLanguage(i18n.resolvedLanguage || i18n.language); i18n.on('languageChanged', applyLanguage); return () => i18n.off('languageChanged', applyLanguage);
  }, [i18n]);

  useEffect(() => {
    const media = window.matchMedia?.('(max-width: 769px)');
    if (!media) return undefined;
    const update = event => {
      setIsMobileHeader(event.matches);
      if (!event.matches) setIsMenuOpen(false);
    };
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    const header = headerRef.current; if (!header) return undefined; const root = document.documentElement;
    const publishHeight = () => root.style.setProperty('--public-header-height', `${Math.ceil(header.getBoundingClientRect().height)}px`); publishHeight();
    const observer = new ResizeObserver(publishHeight); observer.observe(header); window.addEventListener('resize', publishHeight);
    return () => { observer.disconnect(); window.removeEventListener('resize', publishHeight); root.style.removeProperty('--public-header-height'); };
  }, []);

  useEffect(() => {
    if (!servicesOpen) return undefined;
    const outside = event => { if (!servicesRef.current?.contains(event.target)) setServicesOpen(false); };
    const keyboard = event => { if (event.key === 'Escape') { setServicesOpen(false); servicesTriggerRef.current?.focus(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', keyboard); };
  }, [servicesOpen]);

  useEffect(() => {
    let focusFrame;
    if (isMenuOpen) {
      menuWasOpenRef.current = true;
      focusFrame = window.requestAnimationFrame(() => closeMenuRef.current?.focus());
    } else if (menuWasOpenRef.current) {
      menuWasOpenRef.current = false;
      focusFrame = window.requestAnimationFrame(() => menuTriggerRef.current?.focus());
    }
    return () => { if (focusFrame) window.cancelAnimationFrame(focusFrame); };
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isMenuOpen) return undefined;
    const closeOnEscape = event => { if (event.key === 'Escape') { event.preventDefault(); setIsMenuOpen(false); } };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isMenuOpen]);

  const closeNavigation = () => { setServicesOpen(false); setIsMenuOpen(false); };
  const toggleLanguage = () => { i18n.changeLanguage(isEnglish ? 'ar' : 'en'); setServicesOpen(false); };
  const navLinks = [
    { label: t('header.home'), to: '/' }, { label: t('header.about'), to: '/about' },
    { label: t('header.portfolio'), to: '/portfolio' }, { label: t('header.studio'), to: '/studios' }, { label: t('header.contact'), to: '/contact' },
  ];

  return <header className="top-bar" ref={headerRef}>
    <div className="top-bar-right"><Link to="/" className="logo-link" onClick={closeNavigation}><img src="/logo.webp" alt="MT Agency" className="header-logo" width="50" height="50"/><span className="logo-fallback" aria-hidden="true">MT</span></Link><button className="lang-btn" onClick={toggleLanguage} aria-label={isEnglish ? 'التبديل للعربية' : 'Switch to English'}>{isEnglish ? 'AR' : 'EN'}</button><button ref={menuTriggerRef} className="mobile-menu-btn" onClick={() => setIsMenuOpen(open => !open)} aria-expanded={isMenuOpen} aria-controls="public-mobile-navigation" aria-label={isMenuOpen ? (isEnglish ? 'Close menu' : 'إغلاق القائمة') : (isEnglish ? 'Open menu' : 'فتح القائمة')}>{isMenuOpen ? <X/> : <Menu/>}</button></div>
    <button type="button" tabIndex={isMenuOpen ? 0 : -1} aria-hidden={!isMenuOpen} className={`mobile-menu-backdrop ${isMenuOpen ? 'open' : ''}`} onClick={() => setIsMenuOpen(false)} />
    <div id="public-mobile-navigation" className={`mobile-nav-wrapper ${isMenuOpen ? 'open' : ''}`} inert={drawerClosed} aria-hidden={drawerClosed}>
      <button ref={closeMenuRef} tabIndex={isMenuOpen ? 0 : -1} className="close-menu-btn" onClick={() => setIsMenuOpen(false)} aria-label={isEnglish ? 'Close menu' : 'إغلاق القائمة'}><X/></button>
      <div className="top-bar-center"><nav className="header-nav" aria-label={isEnglish ? 'Main navigation' : 'التنقل الرئيسي'}><ul className="nav-list">
        {navLinks.slice(0, 2).map(link => <li key={link.to}><NavLink to={link.to} end={link.to === '/'} className="nav-link" tabIndex={drawerTabIndex} onClick={closeNavigation}>{link.label}</NavLink></li>)}
        <li className="services-menu" ref={servicesRef}>
          <button ref={servicesTriggerRef} type="button" className={`nav-link services-menu__trigger${location.pathname.startsWith('/services') ? ' active' : ''}`} tabIndex={drawerTabIndex} aria-expanded={servicesOpen} aria-controls="services-mega-menu" onClick={() => setServicesOpen(open => !open)}>{t('header.services')}<ChevronDown aria-hidden="true"/></button>
          <div id="services-mega-menu" className={`services-mega-menu${servicesOpen ? ' open' : ''}`}>
            <div className="services-mega-menu__head"><span>{isEnglish ? 'Capabilities' : 'قدرات متكاملة'}</span><Link to="/services" tabIndex={servicesTabIndex} onClick={closeNavigation}>{isEnglish ? 'View all services' : 'عرض كل الخدمات'}</Link></div>
            <div className="services-mega-menu__groups">{publicServiceGroups.map(group => <section key={group.id}><h2>{isEnglish ? group.en : group.ar}</h2>{publicServiceCatalog.filter(service => service.group === group.id).map(service => <NavLink key={service.slug} to={`/services/${service.slug}`} tabIndex={servicesTabIndex} onClick={closeNavigation}>{(isEnglish ? service.en : service.ar).navLabel}</NavLink>)}</section>)}</div>
          </div>
        </li>
        {navLinks.slice(2).map(link => <li key={link.to}><NavLink to={link.to} className="nav-link" tabIndex={drawerTabIndex} onClick={closeNavigation}>{link.label}</NavLink></li>)}
      </ul></nav></div>
      <div className="top-bar-left">{isErpAuth ? <Link to="/erp" className="btn-secondary login-btn" tabIndex={drawerTabIndex} onClick={closeNavigation}><User/> {isEnglish ? 'ERP System' : 'برنامج الشركة'}</Link> : <Link to="/login" className="btn-secondary login-btn" tabIndex={drawerTabIndex} onClick={closeNavigation}><User/> {isEnglish ? 'Login' : 'تسجيل الدخول'}</Link>}</div>
    </div>
  </header>;
}
