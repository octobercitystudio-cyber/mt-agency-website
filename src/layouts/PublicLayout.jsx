import { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation } from 'react-router-dom';
import Header from '../components/Header';
import PublicPromotions from '../components/PublicPromotions';
import Footer from '../components/Footer';
import { useData } from '../store/DataContext';
import { normalizeCompanyPhone } from '../lib/companyContact';
import { publicLocaleFromPath, stripPublicLocale } from '../lib/publicRoutes';
import { organizationId, siteIdentity, websiteId } from '../seo/siteIdentity';
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
  const { pathname } = useLocation();
  const { siteData } = useData();
  const isEnglish = String(i18n.language).startsWith('en');
  const contact = siteData?.contact || {};
  const sameAs = [contact.facebook, contact.instagram, contact.youtube].filter(link => link && link !== '#');
  useEffect(() => {
    const routeLanguage = publicLocaleFromPath(pathname);
    if (!String(i18n.language).startsWith(routeLanguage)) i18n.changeLanguage(routeLanguage);
  }, [i18n, pathname]);

  const organization = {
    '@type': ['Organization', 'ProfessionalService'], '@id': organizationId,
    name: siteIdentity.name, alternateName: siteIdentity.alternateName, url: siteIdentity.url, logo: siteIdentity.logo,
    description: isEnglish ? 'Media production, digital marketing and technology services from 6th of October City, Giza.' : 'إنتاج إعلامي وتسويق رقمي وحلول تقنية من مدينة 6 أكتوبر، الجيزة.',
    telephone: normalizeCompanyPhone(contact.phone) || undefined, email: contact.email || 'info@multitaskagency.com', sameAs,
    address: { '@type': 'PostalAddress', streetAddress: (isEnglish ? contact.addressEn : contact.address) || undefined, addressLocality: siteIdentity.address.locality, addressRegion: siteIdentity.address.region, addressCountry: siteIdentity.address.country },
    areaServed: [{ '@type': 'City', name: '6th of October City' }, { '@type': 'AdministrativeArea', name: 'Giza' }, { '@type': 'Country', name: 'Egypt' }],
  };
  const graph = [{ '@context': 'https://schema.org', ...organization }];
  if (stripPublicLocale(pathname) === '/') graph.unshift({ '@context': 'https://schema.org', '@type': 'WebSite', '@id': websiteId, url: siteIdentity.url, name: siteIdentity.name, alternateName: siteIdentity.alternateName, publisher: { '@id': organizationId }, inLanguage: isEnglish ? 'en-EG' : 'ar-EG' });
  const structuredData = graph.length === 1 ? graph[0] : {
    '@context': 'https://schema.org',
    '@graph': graph.map(item => Object.fromEntries(Object.entries(item).filter(([key]) => key !== '@context'))),
  };

  return <div className="app-container public-site-shell">
    <Helmet><script type="application/ld+json">{JSON.stringify(structuredData)}</script></Helmet>
    <a className="public-skip-link" href="#main-content">{isEnglish ? 'Skip to content' : 'تخطَّ إلى المحتوى'}</a>
    <PublicScrollManager />
    <Header />
    <PublicPromotions />
    <Outlet />
    <Footer />
  </div>;
}
