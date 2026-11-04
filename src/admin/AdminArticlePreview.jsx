import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useData } from '../store/DataContext';
import { hostingerClient } from '../lib/hostingerClient';
import { staffPath } from '../lib/staffRoutes';
import { ArticlePresentation } from '../pages/ArticlePage';
import { articleEditorCopy } from './articleEditorCopy';
import './AdminArticles.css';

export default function AdminArticlePreview() {
  const { id, locale: requestedLocale } = useParams();
  const locale = requestedLocale === 'en' ? 'en' : 'ar';
  const t = articleEditorCopy[locale];
  const { currentUser } = useData();
  const allowed = ['owner', 'admin'].includes(currentUser?.role);
  const [data, setData] = useState(null), [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    if (!allowed) return undefined;
    hostingerClient.request(`/articles/manage/${encodeURIComponent(id)}/preview?lang=${locale}`).then(({ data: result, error: problem }) => {
      if (!alive) return;
      if (problem) setError(locale === 'ar' ? problem.message : t.error); else setData(result);
    });
    return () => { alive = false; };
  }, [id, locale, allowed, t.error]);
  return <div className="aa-admin" lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
    <Helmet htmlAttributes={{ lang: locale, dir: locale === 'ar' ? 'rtl' : 'ltr' }}><title>{t.preview} | Multi Task Agency</title><meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex" /><meta name="referrer" content="no-referrer" /></Helmet>
    <div className="aa-preview-banner"><strong>{t.privateNote}</strong><Link to={staffPath('/site/articles')}>{t.back}</Link></div>
    {!allowed ? <p role="alert">{t.noPermission}</p> : error ? <p role="alert">{error}</p> : !data ? <p role="status">{t.loading}</p> : <div className="aa-private-preview"><ArticlePresentation article={data.article} related={[]} locale={locale} preview /></div>}
  </div>;
}
