import { useLayoutEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { SITE_URL, formatPageTitle, organizationId, siteIdentity } from '../seo/siteIdentity';
import { releasePrerenderMetadata } from '../seo/publicPrerender';
import { articlesPath } from '../lib/articlesApi';

export default function ArticleSEO({ locale, title, description, path, translations = {}, article, noIndex = false, omitCanonical = false }) {
  useLayoutEffect(() => { releasePrerenderMetadata(); }, []);
  const canonical = `${SITE_URL}${path}`;
  const name = formatPageTitle(title);
  const image = article?.cover_url ? new URL(article.cover_url, SITE_URL).href : siteIdentity.logo;
  const schemas = [];
  if (article?.published_at && !noIndex) schemas.push({
    '@context': 'https://schema.org', '@type': 'BlogPosting', '@id': `${canonical}#article`,
    headline: article.title, description: article.excerpt, mainEntityOfPage: { '@type': 'WebPage', '@id': canonical }, url: canonical,
    inLanguage: locale, datePublished: article.published_at, dateModified: article.updated_at || article.published_at,
    ...(article.cover_url ? { image: [image] } : {}),
    author: { '@type': !article.author_name || /فريق التحرير|editorial|Multi Task Agency/i.test(article.author_name) ? 'Organization' : 'Person', name: article.author_name || 'Multi Task Agency' },
    publisher: { '@type': 'Organization', '@id': organizationId, name: 'Multi Task Agency', logo: { '@type': 'ImageObject', url: siteIdentity.logo, width: 600, height: 485 } },
  });
  if (!noIndex) schemas.push({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', '@id': `${canonical}#breadcrumb`, itemListElement: [
    { '@type': 'ListItem', position: 1, name: locale === 'en' ? 'Home' : 'الرئيسية', item: `${SITE_URL}/${locale}/` },
    { '@type': 'ListItem', position: 2, name: locale === 'en' ? 'Articles' : 'المقالات', item: `${SITE_URL}${articlesPath(locale)}` },
    ...(article ? [{ '@type': 'ListItem', position: 3, name: article.title, item: canonical }] : []),
  ] });
  return <Helmet htmlAttributes={{ lang: locale, dir: locale === 'en' ? 'ltr' : 'rtl' }}>
    <title>{name}</title><meta name="description" content={description}/><meta name="robots" content={noIndex ? 'noindex, follow' : 'index, follow'}/>
    {!omitCanonical && <link rel="canonical" href={canonical}/>}
    {!noIndex && Object.entries(translations).filter(([lang, href]) => ['ar', 'en'].includes(lang) && href).map(([lang, href]) => <link key={lang} rel="alternate" hrefLang={`${lang}-EG`} href={`${SITE_URL}${href}`}/>)}
    <meta property="og:type" content={article ? 'article' : 'website'}/><meta property="og:site_name" content="Multi Task Agency"/><meta property="og:locale" content={locale === 'en' ? 'en_EG' : 'ar_EG'}/>
    <meta property="og:title" content={name}/><meta property="og:description" content={description}/><meta property="og:url" content={canonical}/><meta property="og:image" content={image}/>
    <meta name="twitter:card" content="summary_large_image"/><meta name="twitter:title" content={name}/><meta name="twitter:description" content={description}/><meta name="twitter:image" content={image}/>
    {article?.published_at && <meta property="article:published_time" content={article.published_at}/>}{article?.updated_at && <meta property="article:modified_time" content={article.updated_at}/>}
    {schemas.map((schema, index) => <script key={index} type="application/ld+json">{JSON.stringify(schema).replaceAll('<', '\\u003c')}</script>)}
  </Helmet>;
}
