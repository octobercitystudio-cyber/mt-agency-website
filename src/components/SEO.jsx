import React from 'react';
import { Helmet } from 'react-helmet-async';

const SEO = ({ title, description, keywords, url }) => {
  const siteName = "MT Agency";
  const defaultTitle = `${siteName} | We Drive Impact`;
  const defaultDescription = "إم تي إيجنسي متخصصة في الإنتاج الإعلامي، التسويق الرقمي، وصناعة محتوى مرئي يخطف الأنظار ويصنع تأثيراً حقيقياً لأعمالك.";
  const defaultKeywords = "إنتاج إعلامي, تسويق رقمي, تصوير فيديو, مونتاج, بودكاست, إدارة حسابات, هوية بصرية, MT Agency, استوديو";
  const defaultUrl = "https://multitaskagency.com";

  return (
    <Helmet>
      {/* Standard Meta */}
      <title>{title ? `${siteName} | ${title}` : defaultTitle}</title>
      <meta name="description" content={description || defaultDescription} />
      <meta name="keywords" content={keywords || defaultKeywords} />
      
      {/* Open Graph / Social Media */}
      <meta property="og:title" content={title ? `${siteName} | ${title}` : defaultTitle} />
      <meta property="og:description" content={description || defaultDescription} />
      <meta property="og:url" content={url ? `${defaultUrl}${url}` : defaultUrl} />
      
      {/* Twitter */}
      <meta name="twitter:title" content={title ? `${siteName} | ${title}` : defaultTitle} />
      <meta name="twitter:description" content={description || defaultDescription} />
    </Helmet>
  );
};

export default SEO;
