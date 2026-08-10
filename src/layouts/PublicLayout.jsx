import { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation } from 'react-router-dom';
import Header from '../components/Header';
import PublicPromotions from '../components/PublicPromotions';
import Footer from '../components/Footer';
import { useData } from '../store/DataContext';
import '../components/GoldenTicketTheme.css';
import '../pages/PublicPages.css';

const legacySections = new Set(['home', 'about', 'services', 'portfolio', 'studio', 'contact']);

export function PublicScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    const section = hash.replace(/^#/, '');
    if (pathname === '/' && legacySections.has(section)) {
      const timer = window.setTimeout(() => document.getElementById(section)?.scrollIntoView({ block: 'start' }), 80);
      return () => window.clearTimeout(timer);
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    return undefined;
  }, [pathname, hash]);
  return null;
}

export default function PublicLayout() {
  const { i18n } = useTranslation();
  const { siteData } = useData();
  const isEnglish = String(i18n.language).startsWith('en');
  const contact = siteData?.contact || {};
  const sameAs = [contact.facebook, contact.instagram, contact.youtube].filter(link => link && link !== '#');
  const organization = {
    '@context': 'https://schema.org', '@type': ['ProfessionalService', 'Organization'], '@id': 'https://multitaskagency.com/#organization',
    name: 'MT Agency', url: 'https://multitaskagency.com/', logo: 'https://multitaskagency.com/logo.webp',
    description: isEnglish ? 'Integrated media production, digital marketing and software services in Cairo.' : 'خدمات متكاملة في الإنتاج الإعلامي والتسويق الرقمي والبرمجيات في القاهرة.',
    telephone: contact.phone || undefined, email: contact.email || 'info@multitaskagency.com', sameAs,
    address: contact.address ? { '@type': 'PostalAddress', streetAddress: isEnglish ? contact.addressEn : contact.address, addressCountry: 'EG' } : undefined,
  };

  return <div className="app-container public-site-shell">
    <Helmet><script type="application/ld+json">{JSON.stringify(organization)}</script></Helmet>
    <a className="public-skip-link" href="#main-content">{isEnglish ? 'Skip to content' : 'تخطَّ إلى المحتوى'}</a>
    <PublicScrollManager />
    <Header />
    <PublicPromotions />
    <Outlet />
    <Footer />
  </div>;
}
