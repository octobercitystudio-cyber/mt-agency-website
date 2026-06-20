import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useData } from '../store/DataContext';

const SEO = ({ title, description, keywords, url, isPage = false }) => {
  const { i18n } = useTranslation();
  const { siteData } = useData();
  const isEn = i18n.language === 'en';

  const seoData = siteData?.seo || {
    siteName: "MT Agency",
    siteNameEn: "MT Agency",
    titleAr: "إم تي إيجنسي | نصنع التأثير",
    titleEn: "MT Agency | We Drive Impact",
    descAr: "إم تي إيجنسي متخصصة في الإنتاج الإعلامي",
    descEn: "MT Agency specializes in media production",
    keywordsAr: "إنتاج إعلامي, تسويق رقمي",
    keywordsEn: "media production, digital marketing",
    socialImage: ""
  };

  const siteName = isEn ? seoData.siteNameEn : seoData.siteName;
  const defaultTitle = isEn ? seoData.titleEn : seoData.titleAr;
  const defaultDescription = isEn ? seoData.descEn : seoData.descAr;
  const defaultKeywords = isEn ? seoData.keywordsEn : seoData.keywordsAr;
  const defaultUrl = "https://multitaskagency.com";
  
  const finalTitle = title ? `${siteName} | ${title}` : defaultTitle;
  const finalDescription = description || defaultDescription;
  const finalKeywords = keywords || defaultKeywords;
  const finalUrl = url ? `${defaultUrl}${url}` : defaultUrl;

  // JSON-LD Structured Data
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "name": siteName,
    "image": seoData.socialImage || "https://multitaskagency.com/logo.png",
    "@id": defaultUrl,
    "url": defaultUrl,
    "telephone": siteData?.contact?.phone || "",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "6th of October City",
      "addressRegion": "Giza",
      "addressCountry": "EG"
    },
    "description": defaultDescription,
    "sameAs": [
      siteData?.contact?.facebook,
      siteData?.contact?.instagram,
      siteData?.contact?.youtube
    ].filter(Boolean)
  };

  return (
    <Helmet>
      {/* Standard Meta */}
      <title>{finalTitle}</title>
      <meta name="description" content={finalDescription} />
      <meta name="keywords" content={finalKeywords} />
      
      {/* Open Graph / Social Media */}
      <meta property="og:title" content={finalTitle} />
      <meta property="og:description" content={finalDescription} />
      <meta property="og:url" content={finalUrl} />
      {seoData.socialImage && <meta property="og:image" content={seoData.socialImage} />}
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={finalTitle} />
      <meta name="twitter:description" content={finalDescription} />
      {seoData.socialImage && <meta name="twitter:image" content={seoData.socialImage} />}

      {/* Structured Data (Only inject on main pages to avoid duplicates) */}
      {!isPage && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
    </Helmet>
  );
};

export default SEO;
