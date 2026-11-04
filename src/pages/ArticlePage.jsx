import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import ArticleContent from '../components/ArticleContent';
import ArticleCta from '../components/ArticleCta';
import ArticleShare from '../components/ArticleShare';
import { articleClosingCta } from '../lib/articleCta';
import ArticleCard from '../components/ArticleCard';
import ArticleSEO from '../components/ArticleSEO';
import { articleBootstrap, articlesRequest, articlesPath, articlesListPath, articleDate, articleHeadings } from '../lib/articlesApi';
import { publicLocaleFromPath } from '../lib/publicRoutes';
import { setArticleNavigation } from '../lib/articleNavigation';
import { SITE_URL } from '../seo/siteIdentity';
import './Articles.css';

export function ArticlePresentation({ article, related = [], locale = 'ar', preview = false }) {
  const en = locale === 'en'; const headings = articleHeadings(article.blocks);
  const shareUrl = `${SITE_URL}${articlesPath(locale, article.slug)}`;
  const category = article.category?.[en ? 'name_en' : 'name_ar'];
  const showUpdate = article.updated_at && article.published_at && new Date(article.updated_at).getTime() > new Date(article.published_at).getTime() + 60000;
  return <main id="main-content" className={`public-page articles-page article-detail${preview ? ' article-detail--preview' : ''}`} lang={locale} dir={en ? 'ltr' : 'rtl'}>
    <div className="articles-container">
      {!preview && <nav className="article-breadcrumb" aria-label={en ? 'Breadcrumb' : 'مسار التنقل'}><Link to={`/${locale}/`}>{en ? 'Home' : 'الرئيسية'}</Link><span aria-hidden="true">/</span><Link to={articlesPath(locale)}>{en ? 'Articles' : 'المقالات'}</Link><span aria-hidden="true">/</span><span aria-current="page">{article.title}</span></nav>}
      <article>
        <header className="article-heading"><div className="article-card__kicker">{category && (preview ? <span>{category}</span> : <Link to={articlesListPath(locale, { category: article.category.slug })}>{category}</Link>)}<span>{en ? 'PRACTICAL GUIDE' : 'دليل عملي'}</span></div><h1>{article.title}</h1><p className="article-lede">{article.excerpt}</p><div className="article-byline"><span>{article.author_name || (en ? 'Multi Task Agency editorial team' : 'فريق تحرير Multi Task Agency')}</span>{article.published_at ? <span>{en ? 'Published' : 'نُشر في'} <time dateTime={article.published_at}>{articleDate(article.published_at, locale)}</time></span> : <span>{en ? 'Unpublished draft' : 'مسودة غير منشورة'}</span>}{showUpdate && <span>{en ? 'Updated' : 'آخر تحديث'} <time dateTime={article.updated_at}>{articleDate(article.updated_at, locale)}</time></span>}{Number(article.reading_minutes) > 0 && <span>{article.reading_minutes} {en ? 'min read' : 'دقائق قراءة'}</span>}</div></header>
        {article.cover_url && <figure className="article-cover"><img src={article.cover_url} alt={article.cover_alt || ''} width="1600" height="900" fetchPriority="high" decoding="async"/></figure>}
        <div className={`article-reading-layout${headings.length < 3 ? ' article-reading-layout--simple' : ''}`}>
          {headings.length >= 3 && <nav className="article-toc" aria-label={en ? 'On this page' : 'محتويات المقال'}><h2>{en ? 'On this page' : 'في هذا المقال'}</h2><ol>{headings.map(heading => <li key={heading.id} className={heading.level === 3 ? 'article-toc__sub' : undefined}><a href={`#${heading.id}`}>{heading.text}</a></li>)}</ol></nav>}
          <div className="article-reading-column"><ArticleContent blocks={article.blocks || []} locale={locale}/>
            {!preview && <ArticleShare title={article.title} url={shareUrl} locale={locale}/>}
          </div>
        </div>
      </article>
      {!preview && !articleClosingCta(article.blocks || [], locale) && <ArticleCta locale={locale} service={article.service_slug}/>}
      {!preview && related.length > 0 && <section className="articles-related"><div className="articles-results__heading"><h2>{en ? 'Continue reading' : 'اقرأ أيضًا'}</h2><Link to={articlesPath(locale)}>{en ? 'All articles' : 'جميع المقالات'}</Link></div><div className="articles-grid">{related.map(item => <ArticleCard key={item.id} article={item} locale={locale}/>)}</div></section>}
    </div>
  </main>;
}

export default function ArticlePage() {
  const { slug } = useParams(); const location = useLocation(); const navigate = useNavigate();
  const locale = publicLocaleFromPath(location.pathname); const en = locale === 'en'; const key = location.pathname + location.search;
  const [result, setResult] = useState(() => ({ key, data: articleBootstrap(key, 'detail'), error: null }));
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    articlesRequest(`/public/articles/${encodeURIComponent(slug)}?lang=${locale}`).then(data => {
      if (!active) return;
      if (data.redirect) { navigate(data.redirect, { replace: true }); return; }
      setResult({ key, data, error: null });
    }).catch(error => {
      if (active) setResult(previous => previous.key === key && previous.data?.article && error.status !== 404 ? previous : { key, data: null, error });
    });
    return () => { active = false; };
  }, [key, locale, slug, navigate, retry]);
  const data = result.key === key ? result.data : null; const error = result.key === key ? result.error : null;
  useEffect(() => {
    setArticleNavigation(location.pathname, data?.translations || data?.article?.translations || {});
  }, [location.pathname, data]);
  if (!data?.article) return <main id="main-content" className="public-page articles-page" lang={locale} dir={en ? 'ltr' : 'rtl'}><ArticleSEO locale={locale} title={error?.status === 404 ? (en ? 'Article not found' : 'المقال غير موجود') : (en ? 'Article' : 'مقال')} description={error?.status === 404 ? (en ? 'The requested article is not available.' : 'المقال المطلوب غير متاح.') : (en ? 'Multi Task Agency articles and guides.' : 'مقالات وأدلة Multi Task Agency.')} path={articlesPath(locale, slug)} noIndex omitCanonical={error?.status === 404}/><div className="articles-container"><div className="articles-state" role={error ? 'alert' : 'status'}><h1>{error ? error.status === 404 ? (en ? 'Article not found' : 'المقال غير موجود') : (en ? 'We could not load this article' : 'تعذّر تحميل المقال') : (en ? 'Loading article…' : 'جارٍ تحميل المقال…')}</h1>{error && <><p>{en ? 'Explore our library or try again shortly.' : 'يمكنك تصفّح مكتبة المقالات أو المحاولة مرة أخرى.'}</p><Link className="article-button" to={articlesPath(locale)}>{en ? 'All articles' : 'جميع المقالات'}</Link>{error.status !== 404 && <button type="button" onClick={() => setRetry(value => value + 1)}>{en ? 'Try again' : 'حاول مرة أخرى'}</button>}</>}</div></div></main>;
  const article = data.article;
  return <><ArticleSEO locale={locale} title={article.seo_title || article.title} description={article.seo_description || article.excerpt} path={articlesPath(locale, article.slug)} article={article} translations={data.translations || article.translations || {}}/><ArticlePresentation article={article} related={data.related || []} locale={locale}/></>;
}
