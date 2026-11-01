import { staffPath } from '../lib/staffRoutes';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronLeft, ChevronRight, Menu, User, X, Mail, Phone } from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useData } from '../store/DataContext';
import { publicServiceCatalog } from '../data/publicServiceCatalog';
import { alternatePublicPath, localizePublicPath, stripPublicLocale } from '../lib/publicRoutes';
import { companyPhoneTel, normalizeCompanyPhone } from '../lib/companyContact';
import { siteIdentity } from '../seo/siteIdentity';
import { getHeaderSocialLinks } from '../data/publicHeader';
import './Header.css';

function HeaderSocialIcon({ platform }) {
  const paths = {
    facebook: <path d="M14 21v-8h3l.5-4H14V7c0-1.2.3-2 2-2h2V1.5a24 24 0 0 0-3-.2c-3 0-5 1.8-5 5.2V9H7v4h3v8z"/>,
    instagram: <><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="17.5" cy="6.5" r="1.2"/></>,
    linkedin: <><circle cx="4.5" cy="4.5" r="2"/><path d="M3 8h3v13H3zm6 0h3v1.8c1-1.4 2.2-2.1 4-2.1 3.1 0 5 1.8 5 5.5V21h-3.5v-7.1c0-2-.7-3.1-2.3-3.1-1.8 0-2.7 1.2-2.7 3.5V21H9z"/></>,
    youtube: <><path d="M21.5 6.5c-.3-1-1.1-1.8-2.1-2C17.6 4 12 4 12 4s-5.6 0-7.4.5c-1 .2-1.8 1-2.1 2C2 8.3 2 12 2 12s0 3.7.5 5.5c.3 1 1.1 1.8 2.1 2C6.4 20 12 20 12 20s5.6 0 7.4-.5c1-.2 1.8-1 2.1-2 .5-1.8.5-5.5.5-5.5s0-3.7-.5-5.5z" fill="none" stroke="currentColor" strokeWidth="1.7"/><path d="m10 8 6 4-6 4z"/></>,
    tiktok: <path d="M15 2h3c.2 2.1 1.4 3.6 4 4v3a9 9 0 0 1-4-1.2V16a6 6 0 1 1-6-6v3a3 3 0 1 0 3 3z"/>,
    x: <path d="M3 3h5.1l4.8 6.4L18.5 3H21l-7 8.2L22 21h-5.1l-5.5-7.2L5.2 21H2.7l7.4-8.8zm3.4 1.8L17.8 19.2h1.8L8.2 4.8z"/>,
  };
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{paths[platform]}</svg>;
}

const studioServices = [
  { slug: 'studio-content-production', ar: 'تصوير المحتوى التعليمي', en: 'Educational Content Filming' },
  { slug: 'podcast-production', ar: 'تصوير البودكاست', en: 'Podcast Production' },
];

export default function Header() {
  const { t, i18n } = useTranslation(); const { isErpAuth, siteData } = useData(); const location = useLocation();
  const [lang, setLang] = useState(i18n.language); const [isMenuOpen, setIsMenuOpen] = useState(false); const [servicesOpen, setServicesOpen] = useState(false);
  const [studiosOpen, setStudiosOpen] = useState(false);
  const [studiosPosition, setStudiosPosition] = useState({});
  const [isMobileHeader, setIsMobileHeader] = useState(() => window.matchMedia?.('(max-width: 1100px)').matches || false);
  const headerRef = useRef(null); const servicesRef = useRef(null); const servicesTriggerRef = useRef(null);
  const studiosTriggerRef = useRef(null);
  const servicesPanelRef = useRef(null); const studiosSubmenuRef = useRef(null);
  const menuTriggerRef = useRef(null); const closeMenuRef = useRef(null); const menuWasOpenRef = useRef(false);
  const isEnglish = String(lang).startsWith('en');
  const drawerClosed = isMobileHeader && !isMenuOpen;
  const drawerTabIndex = drawerClosed ? -1 : undefined;
  const servicesTabIndex = drawerClosed || !servicesOpen ? -1 : undefined;

  useLayoutEffect(() => {
    if (!studiosOpen || !servicesOpen || drawerClosed) return undefined;
    const positionSubmenu = () => {
      const panel = servicesPanelRef.current?.getBoundingClientRect();
      const trigger = studiosTriggerRef.current?.getBoundingClientRect();
      if (!panel || !trigger) return;
      const margin = 8; const gap = 6;
      const leftRoom = panel.left - gap - margin;
      const rightRoom = window.innerWidth - panel.right - gap - margin;
      const openLeft = isEnglish ? (rightRoom < 180 && leftRoom > rightRoom) : (leftRoom >= 180 || leftRoom >= rightRoom);
      const width = Math.min(260, Math.max(0, openLeft ? leftRoom : rightRoom));
      const maxHeight = window.innerHeight - margin * 2;
      const height = Math.min(studiosSubmenuRef.current?.scrollHeight || 110, maxHeight);
      setStudiosPosition({ width, maxHeight, left: openLeft ? panel.left - gap - width : panel.right + gap, top: Math.max(margin, Math.min(trigger.top, window.innerHeight - height - margin)) });
    };
    positionSubmenu();
    window.addEventListener('resize', positionSubmenu);
    window.addEventListener('scroll', positionSubmenu, true);
    return () => { window.removeEventListener('resize', positionSubmenu); window.removeEventListener('scroll', positionSubmenu, true); };
  }, [studiosOpen, servicesOpen, drawerClosed, isEnglish]);

  useEffect(() => {
    const applyLanguage = nextLanguage => { const next = String(nextLanguage || '').startsWith('en') ? 'en' : 'ar'; setLang(next); document.documentElement.lang = next; document.documentElement.dir = next === 'en' ? 'ltr' : 'rtl'; };
    applyLanguage(i18n.resolvedLanguage || i18n.language); i18n.on('languageChanged', applyLanguage); return () => i18n.off('languageChanged', applyLanguage);
  }, [i18n]);

  useEffect(() => {
    const media = window.matchMedia?.('(max-width: 1100px)');
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
    const outside = event => { if (!servicesRef.current?.contains(event.target) && !studiosSubmenuRef.current?.contains(event.target)) { setServicesOpen(false); setStudiosOpen(false); } };
    const keyboard = event => { if (event.key === 'Escape') {
      event.preventDefault();
      if (studiosOpen) { setStudiosOpen(false); studiosTriggerRef.current?.focus(); }
      else { setServicesOpen(false); servicesTriggerRef.current?.focus(); }
    } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', keyboard); };
  }, [servicesOpen, studiosOpen]);

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
    const closeOnEscape = event => { if (event.key === 'Escape' && !event.defaultPrevented && !(servicesOpen && (servicesRef.current?.contains(event.target) || studiosSubmenuRef.current?.contains(event.target)))) { event.preventDefault(); setIsMenuOpen(false); setStudiosOpen(false); } };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isMenuOpen, servicesOpen]);

  const closeNavigation = () => { setServicesOpen(false); setStudiosOpen(false); setIsMenuOpen(false); };
  const publicPath = value => localizePublicPath(value, isEnglish ? 'en' : 'ar');
  const alternateLanguagePath = alternatePublicPath(location, isEnglish ? 'ar' : 'en');
  const navLinks = [
    { label: t('header.home'), to: publicPath('/') }, { label: t('header.about'), to: publicPath('/about') },
    { label: t('header.portfolio'), to: publicPath('/portfolio') }, { label: t('header.contact'), to: publicPath('/contact') },
  ];

  const contact = siteData.contact || {};
  const email = contact.email || siteIdentity.email;
  const phone = contact.phone || siteIdentity.telephone;
  const socialLinks = getHeaderSocialLinks(contact);

  return <header className="top-bar brand-header" ref={headerRef}>
    <div className="header-utility">
      <div className="header-utility__social">{socialLinks.length > 0 ? <><span className="header-utility__label">{isEnglish ? 'Follow us' : 'تابعنا على'}</span>{socialLinks.map(item => {
        return <a key={item.key} href={item.href} target="_blank" rel="noopener noreferrer" aria-label={item.label}><HeaderSocialIcon platform={item.key}/></a>;
      })}</> : <Link className="header-utility__contact-link" to={publicPath('/contact')} onClick={closeNavigation}>{isEnglish ? 'Contact our team' : 'تواصل معنا'}</Link>}</div>
      <div className="header-utility__contact"><a href={`mailto:${email}`} className="header-utility__email" aria-label={`${isEnglish ? 'Email' : 'البريد الإلكتروني'}: ${email}`}><Mail aria-hidden="true"/><span dir="ltr">{email}</span></a><a href={`tel:${companyPhoneTel(phone)}`} aria-label={`${isEnglish ? 'Call' : 'اتصل على'} ${normalizeCompanyPhone(phone)}`}><Phone aria-hidden="true"/><span dir="ltr">{normalizeCompanyPhone(phone)}</span></a></div>
    </div>
    <div className="header-main">
    <div className="top-bar-right"><Link to={publicPath('/')} className="logo-link" onClick={closeNavigation}><img src="/brand/gold/mt-agency-logo.webp" alt="Multi Task Agency" className="header-logo" width="600" height="485"/><span className="logo-fallback" aria-hidden="true">MT</span></Link><Link className="lang-btn" to={alternateLanguagePath} onClick={closeNavigation} aria-label={isEnglish ? 'التبديل للعربية' : 'Switch to English'}>{isEnglish ? 'AR' : 'EN'}</Link><button ref={menuTriggerRef} className="mobile-menu-btn" onClick={() => setIsMenuOpen(open => !open)} aria-expanded={isMenuOpen} aria-controls="public-mobile-navigation" aria-label={isMenuOpen ? (isEnglish ? 'Close menu' : 'إغلاق القائمة') : (isEnglish ? 'Open menu' : 'فتح القائمة')}>{isMenuOpen ? <X/> : <Menu/>}</button></div>
    <button type="button" tabIndex={isMenuOpen ? 0 : -1} aria-hidden={!isMenuOpen} className={`mobile-menu-backdrop ${isMenuOpen ? 'open' : ''}`} aria-label={isEnglish ? 'Close navigation' : 'إغلاق التنقل'} onClick={closeNavigation} />
    <div id="public-mobile-navigation" className={`mobile-nav-wrapper ${isMenuOpen ? 'open' : ''}`} inert={drawerClosed} aria-hidden={drawerClosed}>
      <button ref={closeMenuRef} tabIndex={isMenuOpen ? 0 : -1} className="close-menu-btn" onClick={() => setIsMenuOpen(false)} aria-label={isEnglish ? 'Close menu' : 'إغلاق القائمة'}><X/></button>
      <div className="top-bar-center"><nav className="header-nav" aria-label={isEnglish ? 'Main navigation' : 'التنقل الرئيسي'}><ul className="nav-list">
        {navLinks.slice(0, 2).map(link => <li key={link.to}><NavLink to={link.to} end={stripPublicLocale(link.to) === '/'} className="nav-link" tabIndex={drawerTabIndex} onClick={closeNavigation}>{link.label}</NavLink></li>)}
        <li className="services-menu" ref={servicesRef}>
          <button ref={servicesTriggerRef} type="button" className={`nav-link services-menu__trigger${stripPublicLocale(location.pathname).startsWith('/services') ? ' active' : ''}`} tabIndex={drawerTabIndex} aria-expanded={servicesOpen} aria-controls="services-mega-menu" onClick={() => { setServicesOpen(open => !open); setStudiosOpen(false); }}>{t('header.services')}<ChevronDown aria-hidden="true"/></button>
          <div ref={servicesPanelRef} id="services-mega-menu" className={`services-mega-menu${servicesOpen ? ' open' : ''}${studiosOpen ? ' has-studios-open' : ''}`} inert={!servicesOpen} aria-hidden={!servicesOpen}>
            <ul className="services-dropdown-list">
              <li>
                <button ref={studiosTriggerRef} type="button" className={`services-studios-trigger${studioServices.some(service => stripPublicLocale(location.pathname).replace(/\/+$/, '') === `/services/${service.slug}`) ? ' active' : ''}`} tabIndex={servicesTabIndex} aria-expanded={studiosOpen} aria-controls="services-studios-submenu" onClick={() => setStudiosOpen(open => !open)} onKeyDown={event => { if (studiosOpen && event.key === 'Tab' && !event.shiftKey) { event.preventDefault(); studiosSubmenuRef.current?.querySelector('a')?.focus(); } }}>{isEnglish ? 'Our Studios' : 'استديوهاتنا'}{isEnglish ? <ChevronRight aria-hidden="true"/> : <ChevronLeft aria-hidden="true"/>}</button>
              </li>
              {publicServiceCatalog.filter(service => !studioServices.some(studio => studio.slug === service.slug)).map(service => <li key={service.slug}><NavLink to={publicPath(`/services/${service.slug}`)} tabIndex={servicesTabIndex} onClick={closeNavigation}>{(isEnglish ? service.en : service.ar).navLabel}</NavLink></li>)}
            </ul>
            <Link className="services-dropdown-all" to={publicPath('/services')} tabIndex={servicesTabIndex} onClick={closeNavigation}>{isEnglish ? 'View all services' : 'عرض كل الخدمات'}</Link>
          </div>
        </li>
        {navLinks.slice(2).map(link => <li key={link.to}><NavLink to={link.to} className="nav-link" tabIndex={drawerTabIndex} onClick={closeNavigation}>{link.label}</NavLink></li>)}
      </ul></nav></div>
      <div className="top-bar-left"><Link to={publicPath('/contact')} className="header-quote-btn" tabIndex={drawerTabIndex} onClick={closeNavigation}>{isEnglish ? 'Request a quote' : 'طلب عرض سعر'}</Link>{isErpAuth ? <Link to={staffPath('')} className="btn-secondary login-btn" tabIndex={drawerTabIndex} onClick={closeNavigation}><User/> {isEnglish ? 'Company workspace' : 'برنامج الشركة'}</Link> : <Link to="/login" className="btn-secondary login-btn" tabIndex={drawerTabIndex} onClick={closeNavigation}><User/> {isEnglish ? 'Login' : 'تسجيل الدخول'}</Link>}</div>
    </div>
    </div>
    {createPortal(<ul ref={studiosSubmenuRef} id="services-studios-submenu" className="services-studios-submenu" dir={isEnglish ? 'ltr' : 'rtl'} style={studiosPosition} hidden={!studiosOpen || !servicesOpen || drawerClosed} aria-label={isEnglish ? 'Our Studios' : 'استديوهاتنا'} onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const links = studiosSubmenuRef.current?.querySelectorAll('a');
      if (event.shiftKey && event.target === links?.[0]) { event.preventDefault(); studiosTriggerRef.current?.focus(); }
      else if (!event.shiftKey && event.target === links?.[links.length - 1]) { event.preventDefault(); studiosTriggerRef.current?.closest('li')?.nextElementSibling?.querySelector('a')?.focus(); }
    }}>
      {studioServices.map(service => <li key={service.slug}><NavLink to={publicPath(`/services/${service.slug}`)} onClick={closeNavigation}>{isEnglish ? service.en : service.ar}</NavLink></li>)}
      <li><Link to={publicPath('/services/podcast-production/#podcast-studios')} className="services-podcast-photos" onClick={closeNavigation}>{isEnglish ? 'Podcast studio photos' : 'صور استديوهات البودكاست'}</Link></li>
    </ul>, document.body)}
  </header>;
}
