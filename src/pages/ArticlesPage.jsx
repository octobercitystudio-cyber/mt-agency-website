import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, BookOpen, ArrowLeft, ArrowRight } from 'lucide-react';
import ArticleSEO from '../components/ArticleSEO';
import ArticleCard from '../components/ArticleCard';
import { articleBootstrap, articlesRequest, articlesPath, articlesListPath } from '../lib/articlesApi';
import { publicLocaleFromPath } from '../lib/publicRoutes';
import './Articles.css';

export default function ArticlesPage() {
  const location = useLocation();
  const locale = publicLocaleFromPath(location.pathname); const en = locale === 'en';
  const key = location.pathname + location.search;
  const query = new URLSearchParams(location.search);
  const q = query.get('q') || ''; const category = query.get('category') || ''; const page = Math.max(1, Number(query.get('page')) || 1);
  const [result, setResult] = useState(() => ({ key, data: articleBootstrap(key, 'list'), error: null }));
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ lang: locale, q, category, page: String(page) });
    articlesRequest(`/public/articles?${params}`).then(data => { if (active) setResult({ key, data, error: null }); }).catch(error => {
      // A background refresh must not replace valid server-rendered content
      // with an error page when the connection drops during hydration.
      if (active) setResult(previous => previous.key === key && previous.data && error.status !== 404 ? previous : { key, data: null, error });
    });
    return () => { active = false; };
  }, [key, locale, q, category, page, retry]);
  const data = result.key === key ? result.data : null; const error = result.key === key ? result.error : null;
  const featured = !q && !category && page === 1 ? data?.featured : null;
  const items = (data?.items || []).filter(item => !featured || item.id !== featured.id);
  const title = en ? 'Articles' : 'المقالات';
  const description = en ? 'Answers to help you plan your next video, podcast, event coverage or social media project.' : 'إجابات تساعدك على التخطيط للتصوير والبودكاست وتغطية الفعاليات وإدارة محتواك.';
  return <main id="main-content" className="public-page articles-page" lang={locale} dir={en ? 'ltr' : 'rtl'}>
    <ArticleSEO locale={locale} title={`${title}${page > 1 ? ` — ${en ? 'Page' : 'صفحة'} ${page}` : ''}`} description={description} path={articlesListPath(locale, { page })} translations={!q && !category && page === 1 ? { ar: articlesPath('ar'), en: articlesPath('en') } : {}} noIndex={!!q || !!category || !!error || query.has('translation') || !data?.total}/>
    <div className="articles-container">
      <nav className="article-breadcrumb" aria-label={en ? 'Breadcrumb' : 'مسار التنقل'}><Link to={`/${locale}/`}>{en ? 'Home' : 'الرئيسية'}</Link><span aria-hidden="true">/</span><span>{en ? 'Articles' : 'المقالات'}</span></nav>
      <header className="articles-intro"><span className="articles-eyebrow">MULTI TASK AGENCY · {en ? 'KNOWLEDGE' : 'المعرفة'}</span><div><h1>{title}</h1></div></header>
      {query.get('translation') === 'unavailable' && <p className="articles-notice" role="status">{en ? 'This article is not available in English yet. Explore our English articles below.' : 'هذا المقال غير متاح بالعربية حاليًا. يمكنك تصفّح المقالات العربية هنا.'}</p>}
      <section className="articles-discovery" aria-label={en ? 'Find an article' : 'ابحث عن مقال'}>
        <form action={articlesPath(locale)} method="get" className="articles-search" role="search"><label htmlFor="article-search">{en ? 'What would you like to know?' : 'عن ماذا تريد أن تعرف؟'}</label><div><input id="article-search" name="q" type="search" defaultValue={q} key={key} placeholder={en ? 'Search articles…' : 'ابحث في المقالات…'} maxLength={120}/>{category && <input type="hidden" name="category" value={category}/>}<button type="submit"><Search size={18} aria-hidden="true"/><span>{en ? 'Search' : 'بحث'}</span></button></div></form>
        <nav className="articles-categories" aria-label={en ? 'Article categories' : 'تصنيفات المقالات'}><Link to={articlesListPath(locale, { q })} aria-current={!category ? 'page' : undefined}>{en ? 'All topics' : 'كل الموضوعات'}</Link>{(data?.categories || []).map(item => <Link key={item.id} to={articlesListPath(locale, { q, category: item.slug })} aria-current={category === item.slug ? 'page' : undefined}>{item[en ? 'name_en' : 'name_ar']}</Link>)}</nav>
      </section>
      {!data && !error && <div className="articles-state" role="status"><span className="articles-loading" aria-hidden="true"/><p>{en ? 'Loading articles…' : 'جارٍ تحميل المقالات…'}</p></div>}
      {error && <div className="articles-state" role="alert"><BookOpen aria-hidden="true"/><h2>{error.status === 404 ? (en ? 'This page was not found' : 'هذه الصفحة غير موجودة') : (en ? 'Articles could not be loaded' : 'تعذّر تحميل المقالات')}</h2><p>{en ? 'Please try again, or return to all articles.' : 'حاول مرة أخرى أو ارجع إلى جميع المقالات.'}</p><div><button type="button" className="article-button" onClick={() => setRetry(value => value + 1)}>{en ? 'Try again' : 'حاول مرة أخرى'}</button><Link to={articlesPath(locale)}>{en ? 'All articles' : 'جميع المقالات'}</Link></div></div>}
      {data && !data.total && <div className="articles-state"><BookOpen size={36} aria-hidden="true"/><h2>{q || category ? (en ? 'No articles match your search' : 'لا توجد مقالات مطابقة للبحث') : (en ? 'Our library is taking shape' : 'مكتبتنا قيد الإعداد')}</h2><p>{q || category ? (en ? 'Try another keyword or explore all topics.' : 'جرّب كلمة أخرى أو تصفّح كل الموضوعات.') : (en ? 'We’re preparing practical guides for your next project. You can explore our services in the meantime.' : 'نجهّز أدلة عملية لمشروعك القادم. يمكنك استكشاف خدماتنا في الوقت الحالي.')}</p><Link className="article-button" to={q || category ? articlesPath(locale) : `/${locale}/services/`}>{q || category ? (en ? 'Show all articles' : 'عرض جميع المقالات') : (en ? 'Explore our services' : 'استكشف خدماتنا')}</Link></div>}
      {data?.total > 0 && <section className="articles-results" aria-label={en ? 'Articles' : 'المقالات'}><div className="articles-results__heading"><h2>{q ? (en ? 'Search results' : 'نتائج البحث') : category ? data.categories.find(item => item.slug === category)?.[en ? 'name_en' : 'name_ar'] || (en ? 'Articles' : 'المقالات') : (en ? 'From the editorial desk' : 'من مكتبة المعرفة')}</h2><span>{data.total} {en ? 'articles' : 'مقال'}</span></div>{featured && <ArticleCard article={featured} locale={locale} featured/>}<div className="articles-grid">{items.map(article => <ArticleCard key={article.id} article={article} locale={locale}/>)}</div></section>}
      {data?.pages > 1 && <nav className="articles-pagination" aria-label={en ? 'Article pages' : 'صفحات المقالات'}>{page > 1 && <Link to={articlesListPath(locale, { q, category, page: page - 1 })} rel="prev">{en ? <ArrowLeft size={16}/> : <ArrowRight size={16}/>} {en ? 'Previous' : 'السابق'}</Link>}{Array.from({ length: data.pages }, (_, index) => index + 1).filter(number => number === 1 || number === data.pages || Math.abs(number - page) <= 2).map((number, index, numbers) => <span key={number}>{index > 0 && number - numbers[index - 1] > 1 && <span className="articles-pagination__gap">…</span>}<Link to={articlesListPath(locale, { q, category, page: number })} aria-current={page === number ? 'page' : undefined} aria-label={`${en ? 'Page' : 'صفحة'} ${number}`}>{number}</Link></span>)}{page < data.pages && <Link to={articlesListPath(locale, { q, category, page: page + 1 })} rel="next">{en ? 'Next' : 'التالي'} {en ? <ArrowRight size={16}/> : <ArrowLeft size={16}/>}</Link>}</nav>}
      <aside className="articles-contact"><div><span className="articles-eyebrow">{en ? 'YOUR NEXT PROJECT' : 'مشروعك القادم'}</span><h2>{en ? 'Have a project in mind?' : 'عندك مشروع في بالك؟'}</h2><p>{en ? 'Tell us what you need, and we’ll discuss the right scope together.' : 'احكِ لنا احتياجك، ونناقش معك نطاق العمل المناسب.'}</p></div><Link className="article-button article-button--light" to={`/${locale}/contact/`}>{en ? 'Request a quote' : 'اطلب عرض سعر'} {en ? <ArrowRight size={18}/> : <ArrowLeft size={18}/>}</Link></aside>
    </div>
  </main>;
}
