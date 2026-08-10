import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useData } from '../store/DataContext';

const SITE_URL = 'https://multitaskagency.com';

const SEO = ({ title, description, keywords, url = '', section = 'home', schema, noIndex = false }) => {
  const { i18n } = useTranslation();
  const { siteData } = useData();
  const isEn = String(i18n.language).startsWith('en');
  const seoData = siteData?.seo || {};
  const globalSeo = seoData.global || { siteName: 'MT Agency', siteNameEn: 'MT Agency', defaultImage: '' };
  const sectionSeo = seoData[section] || seoData.home || {};
  const siteName = (isEn ? globalSeo.siteNameEn : globalSeo.siteName) || 'MT Agency';
  const fallbackTitle = (isEn ? sectionSeo.titleEn : sectionSeo.titleAr) || `${siteName} | ${isEn ? 'We Drive Impact' : 'نصنع التأثير'}`;
  const fallbackDescription = (isEn ? sectionSeo.descEn : sectionSeo.descAr) || (isEn ? 'Integrated media production, marketing and digital products.' : 'إنتاج إعلامي وتسويق ومنتجات رقمية متكاملة.');
  const fallbackKeywords = (isEn ? sectionSeo.keywordsEn : sectionSeo.keywordsAr) || '';
  const finalTitle = title ? `${title} | ${siteName}` : fallbackTitle;
  const finalDescription = description || fallbackDescription;
  const finalKeywords = Array.isArray(keywords) ? keywords.join(', ') : (keywords || fallbackKeywords);
  const path = url ? (String(url).startsWith('/') ? String(url) : `/${url}`) : '/';
  const canonicalUrl = `${SITE_URL}${path === '/' ? '/' : path.replace(/\/$/, '')}`;
  const socialImage = globalSeo.defaultImage || `${SITE_URL}/logo.webp`;
  const schemas = (Array.isArray(schema) ? schema : schema ? [schema] : []).filter(Boolean);

  return (
    <Helmet>
      <title>{finalTitle}</title>
      <meta name="description" content={finalDescription} />
      {finalKeywords && <meta name="keywords" content={finalKeywords} />}
      <meta name="robots" content={noIndex ? 'noindex, nofollow' : 'index, follow'} />
      <link rel="canonical" href={canonicalUrl} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={siteName} />
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
