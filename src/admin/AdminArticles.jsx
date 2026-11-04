import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, Plus, Save, Eye, Trash2, RotateCcw, X, Search, Languages, Settings2, CalendarClock, Send, ArrowRight } from 'lucide-react';
import { useData } from '../store/DataContext';
import { hostingerClient } from '../lib/hostingerClient';
import { staffPath } from '../lib/staffRoutes';
import { publicServiceCatalog } from '../data/publicServiceCatalog';
import ArticleBlockEditor, { ArticleField as Field } from './ArticleBlockEditor';
import { articleEditorCopy as copy } from './articleEditorCopy';
import './AdminArticles.css';

async function articleAdminRequest(path, options) { const { data, error } = await hostingerClient.request(path, options); if (error) throw error; return data; }
const request = articleAdminRequest;
const freshTranslation = () => ({ title: '', slug: '', excerpt: '', blocks: [], seo_title: '', seo_description: '', cover_url: '', cover_alt: '', status: 'draft', scheduled_at: null });
const freshArticle = () => ({ author_name: 'فريق تحرير Multi Task Agency', category_id: '', service_slug: '', featured: false, translations: { ar: freshTranslation() } });
const localInputDate = value => { if (!value) return ''; const date = new Date(value); return Number.isNaN(+date) ? '' : new Date(+date - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const formatDate = (value, locale) => value ? new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
const filterParams = filters => new URLSearchParams({ ...filters, status: filters.status === 'trashed' ? 'trash' : filters.status });

function Confirmation({ dialog, onClose, onConfirm, t }) {
  const ref = useRef(null);
  useEffect(() => { const previous = document.activeElement; ref.current?.showModal(); return () => { previous?.focus?.(); }; }, []);
  return <dialog ref={ref} className="aa-confirm" onCancel={e => { e.preventDefault(); onClose(); }} aria-labelledby="aa-confirm-title"><h3 id="aa-confirm-title">{dialog.title}</h3><p>{dialog.text}</p><div className="aa-actions"><button type="button" onClick={onClose}>{t.cancel}</button><button type="button" className="aa-primary" onClick={onConfirm}>{t.confirm}</button></div></dialog>;
}

export default function AdminArticles() {
  const { currentUser } = useData();
  const [ui, setUi] = useState('ar'); const t = copy[ui];
  const [list, setList] = useState([]), [categories, setCategories] = useState([]), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [uploading, setUploading] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [article, setArticle] = useState(null), [dirty, setDirty] = useState(false), [locale, setLocale] = useState('ar');
  const [filters, setFilters] = useState({ q: '', status: '', lang: '', category: '', page: 1 }), [query, setQuery] = useState('');
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const updateFilters = values => { setLoading(true); setError(''); setFilters(previous => ({ ...previous, ...values, page: 1 })); };
  const changePage = page => { setLoading(true); setError(''); setFilters(previous => ({ ...previous, page })); };
  const [categoryMode, setCategoryMode] = useState(false), [category, setCategory] = useState(null), [dialog, setDialog] = useState(null);
  const owner = currentUser?.role === 'owner'; const permitted = ['owner', 'admin'].includes(currentUser?.role); const active = article?.translations?.[locale];
  const locked = !owner && Object.values(article?.translations || {}).some(tr => tr.status !== 'draft'); const disabled = saving || uploading || locked || !!article?.deleted_at;
  const errorMessage = useCallback(e => {
    if (e?.code === 'article_version_conflict') return t.conflict;
    if (ui === 'ar') return e?.message || t.error;
    const english = {
      article_slug_exists: 'This URL is already used by another article, including a previous URL. Choose a unique slug.',
      article_invalid_slug: 'Use letters, numbers and hyphens for the URL slug.',
      article_title_required: 'An article title is required.',
      article_publish_incomplete: 'Publishing requires an opening summary, content and a category.',
      article_publish_forbidden: 'Only the owner can publish or change published content.',
      article_image_alt_required: 'Add alternative text to the featured image.',
      article_invalid_schedule: t.dateError,
      article_file_type: t.uploadError,
      article_file_size: t.uploadError,
      article_image_dimensions: 'This image is invalid or exceeds 24 megapixels.',
      article_invalid_media: 'Upload an image or video file, or use an allowed YouTube video URL.',
      article_video_caption_required: 'Add a video URL and a text summary.',
      article_invalid_link: 'Use a valid HTTPS URL or a service link on this website.',
      article_link_label_required: 'Add descriptive text for the link.',
      article_author_required: 'Enter a real author name or the editorial team.',
      article_invalid_category: 'Choose an existing category.',
      article_invalid_blocks: 'Article content must contain no more than 150 valid blocks.',
      article_content_too_large: 'This article is too large. Reduce its content before saving.',
      category_names_required: 'Enter both Arabic and English category names.',
      category_in_use: 'This category is used by articles and cannot be deleted.',
      category_slug_exists: 'This category slug already exists.',
      article_category_in_use: 'This category is used by articles and cannot be deleted.',
      article_category_exists: 'This category slug already exists.',
      forbidden: t.noPermission,
      unauthorized: 'Your session has expired. Sign in again.',
      csrf_failed: 'Your session protection expired. Refresh the page and try again.',
    };
    return english[e?.code] || t.error;
  }, [t, ui]);
  const load = useCallback(async () => { if (!permitted) return; setLoading(true); setError(''); try { const data = await request(`/articles/manage?${filterParams(filters)}`); setList(data.items || []); setCategories(data.categories || []); setPagination({ page: Number(data.page) || 1, pages: Math.max(1, Number(data.pages) || 1), total: Number(data.total) || 0 }); } catch (e) { setError(errorMessage(e)); } finally { setLoading(false); } }, [filters, permitted, errorMessage]);
  useEffect(() => {
    let alive = true;
    if (!permitted) return undefined;
    request(`/articles/manage?${filterParams(filters)}`).then(data => {
      if (alive) { setList(data.items || []); setCategories(data.categories || []); setPagination({ page: Number(data.page) || 1, pages: Math.max(1, Number(data.pages) || 1), total: Number(data.total) || 0 }); setLoading(false); }
    }).catch(e => { if (alive) { setError(errorMessage(e)); setLoading(false); } });
    return () => { alive = false; };
  }, [filters, permitted, errorMessage]);
  useEffect(() => { const handler = e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler); }, [dirty]);
  const confirm = (title, text, action) => setDialog({ title, text, action });
  const discard = action => dirty ? confirm(t.discardTitle, t.unsaved, () => { setDirty(false); action(); }) : action();
  const patch = values => { setArticle(prev => ({ ...prev, ...values })); setDirty(true); setNotice(''); };
  const patchTranslation = values => { setArticle(prev => ({ ...prev, translations: { ...prev.translations, [locale]: { ...prev.translations[locale], ...values } } })); setDirty(true); setNotice(''); };
  const open = async id => { setSaving(true); setError(''); try { const data = await request(`/articles/manage/${id}`); setArticle(data); setLocale(data.translations?.ar ? 'ar' : 'en'); setCategoryMode(false); setDirty(false); setNotice(''); } catch (e) { setError(errorMessage(e)); } finally { setSaving(false); } };
  const save = async (status = null) => {
    if (disabled) return;
    const next = structuredClone(article);
    if (status) { if (!next.translations[locale]) return; next.translations[locale].status = status; if (status !== 'scheduled') next.translations[locale].scheduled_at = null; }
    for (const [lang, translation] of Object.entries(next.translations || {})) {
      if (!translation.title.trim() && !translation.slug.trim() && !translation.blocks?.length && !translation.excerpt.trim()) delete next.translations[lang];
    }
    const translations = Object.values(next.translations || {});
    if (!translations.length || translations.some(tr => !tr.title.trim() || !tr.slug.trim() || (tr.cover_url && !tr.cover_alt.trim()) || (tr.status !== 'draft' && (!tr.excerpt.trim() || !tr.blocks?.length || !next.category_id)))) { setError(t.validation); return; }
    if (translations.some(tr => tr.status === 'scheduled' && (!tr.scheduled_at || +new Date(tr.scheduled_at) <= Date.now()))) { setError(t.dateError); return; }
    setSaving(true); setError(''); setNotice('');
    try { const data = await request(article.id ? `/articles/manage/${article.id}` : '/articles/manage', { method: article.id ? 'PATCH' : 'POST', body: JSON.stringify(next) }); setArticle(data); setDirty(false); setNotice(t.saved); await load(); return data; } catch (e) { setError(errorMessage(e)); } finally { setSaving(false); }
  };
  const upload = async file => {
    const isImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type), isVideo = ['video/mp4', 'video/webm'].includes(file.type);
    if ((!isImage && !isVideo) || file.size > (isImage ? 8 : 40) * 1024 * 1024) { setError(t.uploadError); return null; }
    setUploading(true); setError('');
    try { const body = new FormData(); body.append('file', file); const data = await request('/articles/media', { method: 'POST', body }); setNotice(t.successUpload); return data; } catch (e) { setError(errorMessage(e)); return null; } finally { setUploading(false); }
  };
  const trashRestore = async (item, action) => { setSaving(true); setError(''); try { await request(`/articles/manage/${item.id}/${action}`, { method: 'POST', body: JSON.stringify({ version: item.version }) }); setArticle(null); setDirty(false); setNotice(t.saved); await load(); } catch (e) { setError(errorMessage(e)); } finally { setSaving(false); } };
  const saveCategory = async e => { e.preventDefault(); setSaving(true); setError(''); try { await request(category.id ? `/articles/categories/${category.id}` : '/articles/categories', { method: category.id ? 'PATCH' : 'POST', body: JSON.stringify(category) }); setCategory(null); setNotice(t.categorySaved); await load(); } catch (err) { setError(errorMessage(err)); } finally { setSaving(false); } };
  const deleteCategory = async () => { setSaving(true); setError(''); try { await request(`/articles/categories/${category.id}`, { method: 'DELETE' }); setCategory(null); setNotice(t.saved); await load(); } catch (e) { setError(errorMessage(e)); } finally { setSaving(false); } };
  const newCategory = () => setCategory({ slug: '', name_ar: '', name_en: '', description_ar: '', description_en: '', service_slug: '' });
  const serviceOptions = <><option value="">{t.none}</option>{publicServiceCatalog.map(service => <option key={service.slug} value={service.slug}>{service[ui]?.title || service.title?.[ui] || service.slug}</option>)}</>;
  if (!permitted) return <div className="aa-admin"><p role="alert">{t.noPermission}</p></div>;
  return <div className="aa-admin" dir={ui === 'ar' ? 'rtl' : 'ltr'} lang={ui}>
    <header className="aa-page-heading"><div><p className="aa-eyebrow">MULTI TASK / EDITORIAL</p><h2><BookOpen size={26} />{t.title}</h2><p>{t.subtitle}</p></div><label className="aa-language-switch"><Languages size={18} /><span className="aa-sr-only">{t.editorLang}</span><select aria-label={t.editorLang} value={ui} onChange={e => setUi(e.target.value)}><option value="ar">العربية</option><option value="en">English</option></select></label></header>
    {error && <div className="aa-message aa-error" role="alert">{error}<button type="button" aria-label={t.remove} onClick={() => setError('')}><X size={18} /></button></div>}{notice && <div className="aa-message aa-success" role="status">{notice}</div>}{uploading && <div className="aa-message" role="status">{t.uploading}</div>}
    {article ? <>
      <div className="aa-editor-top"><button type="button" onClick={() => discard(() => setArticle(null))}><ArrowRight size={17} />{t.back}</button><span className="aa-status" data-status={article.deleted_at ? 'trashed' : active?.status || 'draft'}>{t[article.deleted_at ? 'trashed' : active?.status || 'draft']}</span>{dirty && <span className="aa-unsaved">● {ui === 'ar' ? 'تغييرات غير محفوظة' : 'Unsaved changes'}</span>}</div>
      {!owner && <p className="aa-permission-note">{locked ? t.locked : t.ownerNote}</p>}
      <div className="aa-editor-grid"><div className="aa-editor-main"><div className="aa-translation-tabs" role="tablist" aria-label={t.language}>{['ar', 'en'].map(lang => <button key={lang} id={`aa-tab-${lang}`} type="button" role="tab" tabIndex={locale === lang ? 0 : -1} aria-selected={locale === lang} aria-controls="aa-translation-panel" onClick={() => setLocale(lang)} onKeyDown={e => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) { e.preventDefault(); const target = e.key === 'Home' ? 'ar' : e.key === 'End' ? 'en' : locale === 'ar' ? 'en' : 'ar'; setLocale(target); document.getElementById(`aa-tab-${target}`)?.focus(); } }}>{lang === 'ar' ? 'العربية' : 'English'}<span>{article.translations[lang] ? t[article.translations[lang].status || 'draft'] : '—'}</span></button>)}</div><p className="aa-hint">{t.translationHint}</p>
        <div id="aa-translation-panel" role="tabpanel" aria-labelledby={`aa-tab-${locale}`} dir={locale === 'ar' ? 'rtl' : 'ltr'} lang={locale}>
          {!active ? <div className="aa-empty"><Languages size={30} /><h3>{t.noTranslation}</h3><button type="button" className="aa-primary" disabled={disabled} onClick={() => patch({ translations: { ...article.translations, [locale]: freshTranslation() } })}><Plus size={18} />{t.addTranslation}</button></div> : <fieldset className="aa-translation-fields" disabled={disabled}>
            <Field label={t.articleTitle} value={active.title} maxLength={200} onChange={e => patchTranslation({ title: e.target.value })} />
            <Field label={t.slug} hint={t.slugHint} dir="ltr" value={active.slug} maxLength={160} onChange={e => patchTranslation({ slug: e.target.value })} />
            <Field label={t.excerpt}>{id => <textarea id={id} rows={3} maxLength={1000} value={active.excerpt} onChange={e => patchTranslation({ excerpt: e.target.value })} />}</Field>
            <section className="aa-section"><h3>{t.cover}</h3><Field label={t.url} dir="ltr" value={active.cover_url || ''} onChange={e => patchTranslation({ cover_url: e.target.value })} /><Field label={t.upload} hint={t.mediaHint}>{id => <input id={id} type="file" accept="image/jpeg,image/png,image/webp" onChange={async e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) { const media = await upload(file); if (media) patchTranslation({ cover_url: media.url }); } }} />}</Field><Field label={t.alt} value={active.cover_alt || ''} onChange={e => patchTranslation({ cover_alt: e.target.value })} />{active.cover_url && <img className="aa-cover-preview" src={active.cover_url} alt={active.cover_alt || ''} />}<button type="button" disabled={!article.translations[locale === 'ar' ? 'en' : 'ar']?.cover_url} onClick={() => patchTranslation({ cover_url: article.translations[locale === 'ar' ? 'en' : 'ar'].cover_url })}>{t.copyCover}</button></section>
            <ArticleBlockEditor blocks={active.blocks || []} onChange={blocks => patchTranslation({ blocks })} locale={locale} t={t} disabled={disabled} onUpload={upload} />
            <details className="aa-seo"><summary>{t.seo}</summary><p className="aa-hint">{t.seoHint}</p><Field label={t.seoTitle} value={active.seo_title || ''} maxLength={200} onChange={e => patchTranslation({ seo_title: e.target.value })} /><Field label={t.seoDescription}>{id => <textarea id={id} rows={3} maxLength={400} value={active.seo_description || ''} onChange={e => patchTranslation({ seo_description: e.target.value })} />}</Field></details>
          </fieldset>}
        </div></div>
        <aside className="aa-editor-aside"><section className="aa-section"><h3>{t.details}</h3><fieldset disabled={disabled}><Field label={t.author} hint={t.authorHint} value={article.author_name || ''} maxLength={160} onChange={e => patch({ author_name: e.target.value })} /><Field label={t.category}>{id => <select id={id} value={article.category_id || ''} onChange={e => patch({ category_id: e.target.value ? Number(e.target.value) : null })}><option value="">{t.none}</option>{categories.map(c => <option key={c.id} value={c.id}>{c[`name_${ui}`]}</option>)}</select>}</Field><Field label={t.service}>{id => <select id={id} value={article.service_slug || ''} onChange={e => patch({ service_slug: e.target.value })}>{serviceOptions}</select>}</Field><label className="aa-check"><input type="checkbox" checked={!!article.featured} onChange={e => patch({ featured: e.target.checked })} />{t.featured}</label></fieldset></section>
          <section className="aa-section aa-publish"><h3>{t.publishing}</h3>{active && <><dl><dt>{t.publishedAt}</dt><dd>{formatDate(active.published_at, ui)}</dd><dt>{t.updatedAt}</dt><dd>{formatDate(active.updated_at, ui)}</dd></dl><button className="aa-primary" type="button" disabled={disabled} onClick={() => save()}><Save size={17} />{saving ? t.saving : t.save}</button>{article.id ? <a className="aa-button" href={staffPath(`/site/articles/${article.id}/preview/${locale}`)} target="_blank" rel="noopener noreferrer" onClick={e => { if (dirty) { e.preventDefault(); setError(t.notSaved); } }}><Eye size={17} />{t.preview}</a> : <p className="aa-hint">{t.notSaved}</p>}
            {owner && !article.deleted_at && <><button type="button" disabled={disabled} onClick={() => confirm(t.publishTitle, t.publishText, () => save('published'))}><Send size={17} />{t.publish}</button><Field label={t.scheduleDate} hint={`${t.timezone}: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`}>{id => <input id={id} type="datetime-local" disabled={disabled} value={localInputDate(active.scheduled_at)} onChange={e => patchTranslation({ scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />}</Field><button type="button" disabled={disabled || !active.scheduled_at} onClick={() => save('scheduled')}><CalendarClock size={17} />{t.schedule}</button><p className="aa-hint">{t.scheduledNotice}</p>{['published', 'scheduled'].includes(active.status) && <button type="button" disabled={disabled} onClick={() => confirm(t.unpublishTitle, t.unpublishText, () => save('draft'))}>{t.unpublish}</button>}</>}
            {active.status === 'published' && <a className="aa-button" href={`/${locale}/articles/${encodeURIComponent(active.slug)}/`} target="_blank" rel="noopener noreferrer">{t.viewSite}</a>}</>}
            {article.id && (owner || !locked) && <button type="button" className="aa-danger" disabled={saving} onClick={() => confirm(article.deleted_at ? t.restoreTitle : t.deleteTitle, article.deleted_at ? t.restoreText : t.deleteText, () => trashRestore(article, article.deleted_at ? 'restore' : 'trash'))}>{article.deleted_at ? <RotateCcw size={17} /> : <Trash2 size={17} />} {article.deleted_at ? t.restore : t.trash}</button>}</section></aside></div>
    </> : <>
      <nav className="aa-library-tabs" aria-label={t.title}><button type="button" aria-current={!categoryMode ? 'page' : undefined} onClick={() => { setCategoryMode(false); setCategory(null); }}><BookOpen size={18} />{t.library}</button><button type="button" aria-current={categoryMode ? 'page' : undefined} onClick={() => setCategoryMode(true)}><Settings2 size={18} />{t.categories}</button><button type="button" className="aa-primary" onClick={() => { setArticle(freshArticle()); setLocale('ar'); setDirty(false); setError(''); setNotice(''); setCategoryMode(false); }}><Plus size={18} />{t.new}</button></nav>
      {categoryMode ? <section className="aa-category-manager"><div className="aa-section-heading"><h3>{t.categoryTitle}</h3>{owner && <button type="button" onClick={newCategory}><Plus size={17} />{t.categoryNew}</button>}</div><div className="aa-category-list">{categories.map(c => <button type="button" key={c.id} onClick={() => setCategory({ ...c })}><strong>{c[`name_${ui}`]}</strong><span>{c.slug}</span></button>)}</div>{category && <form onSubmit={saveCategory} className="aa-category-form"><fieldset disabled={saving || !owner}><div className="aa-fields-two"><Field label={t.nameAr} required dir="rtl" value={category.name_ar} onChange={e => setCategory({ ...category, name_ar: e.target.value })} /><Field label={t.nameEn} required dir="ltr" value={category.name_en} onChange={e => setCategory({ ...category, name_en: e.target.value })} /><Field label={t.descAr}>{id => <textarea id={id} dir="rtl" value={category.description_ar || ''} onChange={e => setCategory({ ...category, description_ar: e.target.value })} />}</Field><Field label={t.descEn}>{id => <textarea id={id} dir="ltr" value={category.description_en || ''} onChange={e => setCategory({ ...category, description_en: e.target.value })} />}</Field><Field label={t.slug} required dir="ltr" value={category.slug} onChange={e => setCategory({ ...category, slug: e.target.value })} /><Field label={t.service}>{id => <select id={id} value={category.service_slug || ''} onChange={e => setCategory({ ...category, service_slug: e.target.value })}>{serviceOptions}</select>}</Field></div><div className="aa-actions"><button type="submit" className="aa-primary"><Save size={17} />{t.save}</button>{category.id && <button type="button" className="aa-danger" onClick={() => confirm(t.deleteCategory, t.deleteCategoryText, deleteCategory)}><Trash2 size={17} />{t.deleteCategory}</button>}</div></fieldset><button type="button" onClick={() => setCategory(null)}>{t.cancel}</button></form>}</section> : <>
        <form className="aa-filters" onSubmit={e => { e.preventDefault(); updateFilters({ q: query }); }}><Field label={t.search}>{id => <input id={id} value={query} onChange={e => setQuery(e.target.value)} placeholder={t.search} />}</Field><Field label={t.language}>{id => <select id={id} value={filters.lang} onChange={e => updateFilters({ lang: e.target.value })}><option value="">{t.all}</option><option value="ar">العربية</option><option value="en">English</option></select>}</Field><Field label={t.status}>{id => <select id={id} value={filters.status} onChange={e => updateFilters({ status: e.target.value })}><option value="">{t.all}</option>{['draft', 'published', 'scheduled', 'trashed'].map(status => <option key={status} value={status}>{t[status]}</option>)}</select>}</Field><Field label={t.category}>{id => <select id={id} value={filters.category} onChange={e => updateFilters({ category: e.target.value })}><option value="">{t.all}</option>{categories.map(c => <option key={c.id} value={c.slug}>{c[`name_${ui}`]}</option>)}</select>}</Field><button type="submit" aria-label={t.search}><Search size={18} /></button></form>
        <div className="aa-list-heading"><span>{t.filteredCount}: {pagination.total}</span><button type="button" disabled={loading} onClick={load}>{t.refresh}</button></div>
        {loading ? <p role="status" className="aa-empty">{t.loading}</p> : !list.length ? <div className="aa-empty"><BookOpen size={36} /><h3>{t.empty}</h3><p>{t.start}</p></div> : <div className="aa-article-list">{list.map(item => <article className="aa-article-row" key={item.id}><div className="aa-article-number">{String(item.id).padStart(2, '0')}</div><div className="aa-article-info"><h3>{item.translations?.[ui]?.title || item.translations?.ar?.title || item.translations?.en?.title || `#${item.id}`}</h3><div className="aa-row-meta">{Object.entries(item.translations || {}).map(([lang, tr]) => <span className="aa-status" data-status={item.deleted_at ? 'trashed' : tr.status} key={lang}>{lang === 'ar' ? 'العربية' : 'English'} · {t[item.deleted_at ? 'trashed' : tr.status]}</span>)}<span>{categories.find(c => Number(c.id) === Number(item.category_id))?.[`name_${ui}`] || t.none}</span></div></div><div className="aa-actions"><button type="button" disabled={saving} onClick={() => open(item.id)}>{t.edit}</button>{item.deleted_at && owner && <button type="button" disabled={saving} onClick={() => confirm(t.restoreTitle, t.restoreText, () => trashRestore(item, 'restore'))}><RotateCcw size={17} />{t.restore}</button>}</div></article>)}</div>}
        <nav className="aa-pagination" aria-label={t.pagination} aria-busy={loading}><button type="button" disabled={loading || pagination.page <= 1} onClick={() => changePage(pagination.page - 1)}>{t.previousPage}</button><span role="status">{t.pageOf.replace("{page}", pagination.page).replace("{pages}", pagination.pages)}</span><button type="button" disabled={loading || pagination.page >= pagination.pages} onClick={() => changePage(pagination.page + 1)}>{t.nextPage}</button></nav>
      </>}
    </>}
    {dialog && <Confirmation dialog={dialog} t={t} onClose={() => setDialog(null)} onConfirm={() => { const action = dialog.action; setDialog(null); action(); }} />}
  </div>;
}
