import { Link } from 'react-router-dom';
import { ArrowUpLeft, ArrowUpRight } from 'lucide-react';
import { articleDate, articlesPath } from '../lib/articlesApi';

export default function ArticleCard({ article, locale, featured = false }) {
  const en = locale === 'en';
  const path = articlesPath(locale, article.slug);
  const category = article.category?.[en ? 'name_en' : 'name_ar'];
  return <article className={`article-card${featured ? ' article-card--featured' : ''}`}>
    {article.cover_url && <Link to={path} className="article-card__media" tabIndex={-1} aria-hidden="true"><img src={article.cover_url} alt="" width="1200" height="675" loading={featured ? 'eager' : 'lazy'} decoding="async"/></Link>}
    <div className="article-card__copy">
      <div className="article-card__kicker">{featured && <span>{en ? 'Editor’s pick' : 'اختيار التحرير'}</span>}{category && <span>{category}</span>}</div>
      <h2><Link to={path}>{article.title}</Link></h2>
      <p>{article.excerpt}</p>
      <div className="article-card__footer"><span><time dateTime={article.published_at}>{articleDate(article.published_at, locale)}</time>{Number(article.reading_minutes) > 0 && <> · {article.reading_minutes} {en ? 'min read' : 'دقائق قراءة'}</>}</span><Link to={path} aria-label={`${en ? 'Read' : 'اقرأ'}: ${article.title}`}>{en ? <ArrowUpRight aria-hidden="true"/> : <ArrowUpLeft aria-hidden="true"/>}</Link></div>
    </div>
  </article>;
}
