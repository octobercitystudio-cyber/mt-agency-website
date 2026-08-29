import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useData } from '../store/DataContext';
import { localizePublicPath } from '../lib/publicRoutes';
import { SITE_URL, siteIdentity } from '../seo/siteIdentity';

const SEO = ({ title, description, url = '', section = 'home', schema, noIndex = false }) => {
  const { i18n } = useTranslation();
  const { siteData } = useData();
  const isEn = String(i18n.language).startsWith('en');
  const seoData = siteData?.seo || {};
  const globalSeo = seoData.global || { defaultImage: '' };
  const sectionSeo = seoData[section] || seoData.home || {};
  const siteName = siteIdentity.name;
  const fallbackTitle = (isEn ? sectionSeo.titleEn : sectionSeo.titleAr) || `${siteName} | ${isEn ? 'We Drive Impact' : 'نصنع التأثير'}`;
  const fallbackDescription = (isEn ? sectionSeo.descEn : sectionSeo.descAr) || (isEn ? 'Media production, digital marketing and technology services from 6th of October City, Giza.' : 'إنتاج إعلامي وتسويق رقمي وحلول تقنية من مدينة 6 أكتوبر، الجيزة.');
  const finalTitle = title ? `${title} | ${siteName}` : fallbackTitle;
  const finalDescription = description || fallbackDescription;
  const path = url ? (String(url).startsWith('/') ? String(url) : `/${url}`) : '/';
  const canonicalPath = localizePublicPath(path, isEn ? 'en' : 'ar');
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;
  const arabicUrl = `${SITE_URL}${localizePublicPath(path, 'ar')}`;
  const englishUrl = `${SITE_URL}${localizePublicPath(path, 'en')}`;
  const defaultUrl = path === '/' ? `${SITE_URL}/` : arabicUrl;
  const socialImage = globalSeo.defaultImage || `${SITE_URL}/logo.webp`;
  const schemas = (Array.isArray(schema) ? schema : schema ? [schema] : []).filter(Boolean);

  return (
    <Helmet htmlAttributes={{ lang: isEn ? 'en' : 'ar', dir: isEn ? 'ltr' : 'rtl' }}>
      <title>{finalTitle}</title>
      <meta name="description" content={finalDescription} />
      <meta name="robots" content={noIndex ? 'noindex, nofollow' : 'index, follow'} />
      <link rel="canonical" href={canonicalUrl} />
      <link rel="alternate" hrefLang="ar-EG" href={arabicUrl} />
      <link rel="alternate" hrefLang="en-EG" href={englishUrl} />
      <link rel="alternate" hrefLang="x-default" href={defaultUrl} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:locale" content={isEn ? 'en_EG' : 'ar_EG'} />
      <meta property="og:locale:alternate" content={isEn ? 'ar_EG' : 'en_EG'} />
      <meta property="og:title" content={finalTitle} />
      <meta property="og:description" content={finalDescription} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={socialImage} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={finalTitle} />
      <meta name="twitter:description" content={finalDescription} />
      <meta name="twitter:image" content={socialImage} />
      {schemas.map((item, index) => <script key={`${item['@type'] || 'schema'}-${index}`} type="application/ld+json">{JSON.stringify(item)}</script>)}
    </Helmet>
  );
};

export default SEO;
