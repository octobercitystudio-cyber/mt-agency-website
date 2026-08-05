import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive, CalendarClock, Check, CirclePause, Copy, Eye, LayoutPanelTop,
  Megaphone, MonitorUp, Pencil, Plus, RefreshCw, Rocket, Save, Sparkles, Tag, X,
} from 'lucide-react';
import ERPPageHero from './ERPPageHero';
import { formatDateTime12, formatEGP } from '../lib/businessFormat';
import { promotionApi } from '../lib/promotionApi';
import { cairoDateTimeToEpoch } from '../lib/promotionTime';
import './ERPPromotions.css';

const cairoInput = (date = new Date()) => new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
}).format(date).replace(' ', 'T');

const emptyPromotion = () => {
  const start = new Date(); const end = new Date(start.getTime() + 7 * 86400000);
  return {
    internal_title: '', public_title: '', public_title_en: '', badge: 'لفترة محدودة', badge_en: '', description: '', description_en: '', original_price: '', promotional_price: '', discount_text: '', discount_text_en: '',
    starts_at: cairoInput(start), ends_at: cairoInput(end), cta_label: 'اشترك في العرض', cta_label_en: '', cta_url: '#contact', status: 'draft',
    popup_enabled: true, banner_enabled: true, priority: 50, terms: '',
  };
};

const parseLocal = cairoDateTimeToEpoch;
const effectiveStatus = (promotion, now) => {
  if (promotion.status === 'paused') return 'paused';
  if (promotion.status === 'draft') return 'draft';
  if (promotion.status === 'expired' || parseLocal(promotion.ends_at) <= now) return 'expired';
  if (parseLocal(promotion.starts_at) > now) return 'scheduled';
  return 'active';
};
const STATUS = {
  active: ['نشط الآن', 'success'], scheduled: ['مجدول', 'info'], paused: ['متوقف', 'warning'], draft: ['مسودة', 'neutral'], expired: ['منتهي', 'danger'],
};
const toForm = promotion => ({ ...promotion, starts_at: String(promotion.starts_at).replace(' ', 'T').slice(0, 16), ends_at: String(promotion.ends_at).replace(' ', 'T').slice(0, 16), popup_enabled: Boolean(Number(promotion.popup_enabled)), banner_enabled: Boolean(Number(promotion.banner_enabled)), original_price: promotion.original_price ?? '', promotional_price: promotion.promotional_price ?? '', terms: promotion.terms || '', badge: promotion.badge || '', discount_text: promotion.discount_text || '', public_title_en: promotion.public_title_en || '', badge_en: promotion.badge_en || '', description_en: promotion.description_en || '', discount_text_en: promotion.discount_text_en || '', cta_label_en: promotion.cta_label_en || '' });
const remaining = (end, now) => {
  const seconds = Math.max(0, Math.floor((parseLocal(end) - now) / 1000));
  const days = Math.floor(seconds / 86400); const hours = Math.floor((seconds % 86400) / 3600); const minutes = Math.floor((seconds % 3600) / 60);
  return days ? `${days} يوم و${hours} ساعة` : `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} متبقية`;
};

export default function ERPPromotions() {
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyPromotion);
  const [busy, setBusy] = useState('');
  const [previewMode, setPreviewMode] = useState('popup');
  const [now, setNow] = useState(0);
  const drawerRef = useRef(null);
  const triggerRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const result = await promotionApi.request('', { method: 'GET' }); setPromotions(result?.items || []); setNow(Date.now()); }
    catch (requestError) { setError(requestError.message || 'تعذر تحميل العروض الحصرية.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);

  const metrics = useMemo(() => promotions.reduce((totals, promotion) => {
    const state = effectiveStatus(promotion, now); totals[state] = (totals[state] || 0) + 1; return totals;
  }, { active: 0, scheduled: 0, expired: 0 }), [promotions, now]);
  const visible = useMemo(() => promotions.filter(promotion => filter === 'all' || effectiveStatus(promotion, now) === filter), [promotions, filter, now]);

  const openCreate = event => { triggerRef.current = event?.currentTarget || null; setEditingId(null); setForm(emptyPromotion()); setPreviewMode('popup'); setError(''); setDrawerOpen(true); };
  const openEdit = (promotion, event) => { triggerRef.current = event?.currentTarget || null; setEditingId(promotion.id); setForm(toForm(promotion)); setPreviewMode(promotion.popup_enabled ? 'popup' : 'banner'); setError(''); setDrawerOpen(true); };
  const closeDrawer = useCallback(() => { setDrawerOpen(false); setEditingId(null); }, []);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const dialog = drawerRef.current; const previous = triggerRef.current;
    const focusables = () => [...(dialog?.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href]') || [])];
    const oldOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const onKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); closeDrawer(); return; }
      if (event.key !== 'Tab') return; const items = focusables(); if (!items.length) return;
      const first = items[0]; const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey); window.requestAnimationFrame(() => focusables()[0]?.focus());
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = oldOverflow; window.requestAnimationFrame(() => previous?.focus()); };
  }, [drawerOpen, closeDrawer]);

  const validate = () => {
    if (!form.internal_title.trim() || !form.public_title.trim() || !form.description.trim()) return 'أكمل العنوان الداخلي والعام والوصف.';
    if (!form.starts_at || !form.ends_at || parseLocal(form.ends_at) <= parseLocal(form.starts_at)) return 'نهاية العرض يجب أن تكون بعد بدايته.';
    if (form.promotional_price === '' && !form.discount_text.trim()) return 'أدخل السعر الترويجي أو نص قيمة العرض.';
    if (form.original_price !== '' && form.promotional_price !== '' && Number(form.promotional_price) >= Number(form.original_price)) return 'السعر الترويجي يجب أن يكون أقل من الأصلي.';
    if (!/^#[-\w]+$/.test(form.cta_url) && !/^\/(?!\/)/.test(form.cta_url) && !/^https?:\/\//i.test(form.cta_url)) return 'أدخل رابطًا داخليًا أو رابط ويب آمنًا.';
    return '';
  };

  const save = async event => {
    event.preventDefault(); const validation = validate(); if (validation) return setError(validation);
    setBusy('save'); setError(''); setNotice('');
    try {
      await promotionApi.request(editingId ? `/${editingId}` : '', { method: editingId ? 'PATCH' : 'POST', body: JSON.stringify(form) });
      setNotice(editingId ? 'تم تحديث العرض ونسخته العامة.' : 'تم إنشاء العرض. فعّله عندما يصبح جاهزًا للنشر.'); closeDrawer(); await load();
    } catch (requestError) { setError(requestError.message || 'تعذر حفظ العرض.'); }
    finally { setBusy(''); }
  };

  const changeStatus = async (promotion, status) => {
    setBusy(`status-${promotion.id}`); setError('');
    try { await promotionApi.request(`/${promotion.id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); setNotice(status === 'active' ? 'أصبح العرض جاهزًا للظهور خلال نافذته الزمنية.' : 'تم إيقاف العرض مؤقتًا.'); await load(); }
    catch (requestError) { setError(requestError.message || 'تعذر تغيير حالة العرض.'); }
    finally { setBusy(''); }
  };

  const duplicate = async promotion => {
    setBusy(`duplicate-${promotion.id}`);
    try { await promotionApi.request(`/${promotion.id}/duplicate`, { method: 'POST', body: '{}' }); setNotice('تم إنشاء نسخة مسودة مستقلة.'); await load(); }
    catch (requestError) { setError(requestError.message || 'تعذر نسخ العرض.'); }
    finally { setBusy(''); }
  };

  const archive = async promotion => {
    if (!window.confirm(`أرشفة العرض «${promotion.internal_title}»؟ لن يظهر بعد ذلك على الموقع.`)) return;
    setBusy(`archive-${promotion.id}`);
    try { await promotionApi.request(`/${promotion.id}`, { method: 'DELETE' }); setNotice('تمت أرشفة العرض.'); await load(); }
    catch (requestError) { setError(requestError.message || 'تعذر أرشفة العرض.'); }
    finally { setBusy(''); }
  };

  return <div className="promotions-center" dir="rtl">
    <ERPPageHero icon={Sparkles} eyebrow="مركز الحملات التسويقية" title="العروض الحصرية" description="أنشئ عروضًا محدودة المدة للموقع، واضبط النافذة المنبثقة والشريط المستمر من مكان واحد." actions={<button data-variant="primary" type="button" onClick={openCreate}><Plus /> إنشاء عرض</button>} details={<div className="promotion-hero-note"><MonitorUp /><div><span>الظهور العام</span><strong>Popup + Banner</strong></div></div>} />

    <section className="promotion-metrics" aria-label="ملخص العروض"><Metric label="نشط الآن" value={metrics.active} tone="success" /><Metric label="مجدول" value={metrics.scheduled} tone="info" /><Metric label="منتهي" value={metrics.expired} tone="muted" /></section>
    {notice && <div className="promotion-feedback success" role="status"><Check />{notice}<button type="button" onClick={() => setNotice('')}>إخفاء</button></div>}
    {error && <div className="promotion-feedback error" role="alert"><X />{error}<button type="button" onClick={() => setError('')}>إخفاء</button></div>}

    <section className="promotion-toolbar" aria-label="مرشحات العروض">
      <div>{[['all','الكل'],['active','نشط الآن'],['scheduled','مجدول'],['draft','مسودة'],['paused','متوقف'],['expired','منتهي']].map(([key,label]) => <button type="button" key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>{label}</button>)}</div>
      <button className="promotion-refresh" type="button" onClick={load}><RefreshCw className={loading ? 'spin' : ''} /> تحديث</button>
    </section>

    {loading && !promotions.length ? <PromotionState loading title="جارٍ تجهيز مركز العروض" text="نسترجع الحملات ومواعيد ظهورها." /> : error && !promotions.length ? <PromotionState title="تعذر تحميل العروض" text="تحقق من الاتصال أو تطبيق ترحيل قاعدة البيانات، ثم أعد المحاولة." action="إعادة المحاولة" onAction={load} /> : !visible.length ? <PromotionState title={promotions.length ? 'لا توجد عروض ضمن هذا المرشح' : 'ابدأ أول حملة حصرية'} text={promotions.length ? 'اختر حالة أخرى أو أنشئ عرضًا جديدًا.' : 'أنشئ عرضًا مؤقتًا مع نافذة منبثقة وشريط بيع مستمر للموقع.'} action="إنشاء عرض" onAction={openCreate} /> : <section className="promotion-list" aria-label="قائمة العروض">{visible.map(promotion => <PromotionCard key={promotion.id} promotion={promotion} now={now} busy={busy} onEdit={openEdit} onStatus={changeStatus} onDuplicate={duplicate} onArchive={archive} />)}</section>}

    {drawerOpen && <PromotionDrawer drawerRef={drawerRef} form={form} setForm={setForm} editing={Boolean(editingId)} previewMode={previewMode} setPreviewMode={setPreviewMode} busy={busy} onSave={save} onClose={closeDrawer} />}
  </div>;
}

function Metric({ label, value, tone }) { return <article className={tone || ''}><span>{label}</span><strong>{Number(value).toLocaleString('ar-EG')}</strong></article>; }

function PromotionState({ loading, title, text, action, onAction }) { return <section className="promotion-state">{loading ? <span className="promotion-loader" /> : <Megaphone />}<h2>{title}</h2><p>{text}</p>{action && <button type="button" onClick={onAction}>{action}</button>}</section>; }

function PromotionCard({ promotion, now, busy, onEdit, onStatus, onDuplicate, onArchive }) {
  const state = effectiveStatus(promotion, now); const [label, tone] = STATUS[state]; const value = promotion.promotional_price !== null ? formatEGP(promotion.promotional_price) : promotion.discount_text;
  return <article className={`promotion-card promotion-card--${tone}`}>
    <header><div><span className={`promotion-status ${tone}`}>{label}</span><small>أولوية {promotion.priority}</small></div><h2>{promotion.internal_title}</h2><p>{promotion.public_title}</p></header>
    <div className="promotion-card__value"><span>{promotion.badge || 'عرض حصري'}</span><strong>{value}</strong>{promotion.original_price !== null && <del>{formatEGP(promotion.original_price)}</del>}</div>
    <dl><div><dt>نافذة الظهور</dt><dd>{formatDateTime12(String(promotion.starts_at).replace(' ', 'T'))}<br />حتى {formatDateTime12(String(promotion.ends_at).replace(' ', 'T'))}</dd></div><div><dt>{state === 'active' ? 'الوقت المتبقي' : 'الحالة الزمنية'}</dt><dd>{state === 'active' ? remaining(promotion.ends_at, now) : state === 'scheduled' ? `يبدأ ${formatDateTime12(String(promotion.starts_at).replace(' ', 'T'))}` : label}</dd></div></dl>
    <div className="promotion-card__placements"><span className={Number(promotion.popup_enabled) ? 'on' : ''}><LayoutPanelTop /> نافذة منبثقة</span><span className={Number(promotion.banner_enabled) ? 'on' : ''}><MonitorUp /> شريط الموقع</span><span><Tag /> {promotion.cta_label}</span></div>
    <footer><button type="button" onClick={event => onEdit(promotion, event)}><Pencil /> تعديل / معاينة</button>{promotion.status === 'active' ? <button type="button" disabled={busy} onClick={() => onStatus(promotion, 'paused')}><CirclePause /> إيقاف</button> : <button className="activate" type="button" disabled={busy || state === 'expired'} onClick={() => onStatus(promotion, 'active')}><Rocket /> تفعيل</button>}<button type="button" disabled={busy} onClick={() => onDuplicate(promotion)}><Copy /> نسخ</button><button className="archive" type="button" disabled={busy} onClick={() => onArchive(promotion)}><Archive /> أرشفة</button></footer>
  </article>;
}

const PromotionDrawer = ({ drawerRef, form, setForm, editing, previewMode, setPreviewMode, busy, onSave, onClose }) => {
  const update = (field, value) => setForm(current => ({ ...current, [field]: value }));
  return <div className="promotion-drawer-overlay" onMouseDown={event => event.target === event.currentTarget && onClose()}><aside ref={drawerRef} className="promotion-drawer" role="dialog" aria-modal="true" aria-labelledby="promotion-drawer-title">
    <header><div><span>{editing ? 'تعديل حملة' : 'حملة جديدة'}</span><h2 id="promotion-drawer-title">{editing ? form.internal_title : 'إنشاء عرض حصري'}</h2><p>المحتوى والتوقيت والظهور العام في مسار مراجعة واحد.</p></div><button type="button" onClick={onClose} aria-label="إغلاق محرر العرض"><X /></button></header>
    <form onSubmit={onSave}>
      <div className="promotion-form-column">
        <fieldset><legend><span>01</span> المحتوى</legend><label>العنوان الداخلي<input value={form.internal_title} onChange={event => update('internal_title', event.target.value)} required placeholder="مثال: حملة افتتاح فرع أكتوبر" /></label><label>العنوان الظاهر للزائر<input value={form.public_title} onChange={event => update('public_title', event.target.value)} required placeholder="صوّر حملتك القادمة بسعر حصري" /></label><div className="promotion-form-grid"><label>شارة قصيرة<input value={form.badge} onChange={event => update('badge', event.target.value)} maxLength="60" /></label><label>الأولوية<input type="number" min="0" max="999" value={form.priority} onChange={event => update('priority', event.target.value)} /></label></div><label>الوصف المقنع<textarea rows="3" value={form.description} onChange={event => update('description', event.target.value)} required placeholder="وصف مختصر يوضح القيمة ويحفز الزائر على اتخاذ الإجراء." /></label></fieldset>
        <fieldset className="promotion-english-fields"><legend><span>EN</span> النسخة الإنجليزية <small>اختيارية</small></legend><label>Public title<input dir="ltr" value={form.public_title_en} onChange={event => update('public_title_en', event.target.value)} maxLength="180" placeholder="Exclusive campaign title" /></label><div className="promotion-form-grid"><label>Badge<input dir="ltr" value={form.badge_en} onChange={event => update('badge_en', event.target.value)} maxLength="60" placeholder="Limited time" /></label><label>CTA label<input dir="ltr" value={form.cta_label_en} onChange={event => update('cta_label_en', event.target.value)} maxLength="80" placeholder="Claim the offer" /></label></div><label>Description<textarea dir="ltr" rows="3" value={form.description_en} onChange={event => update('description_en', event.target.value)} placeholder="A concise English description for visitors." /></label><label>Discount / value text<input dir="ltr" value={form.discount_text_en} onChange={event => update('discount_text_en', event.target.value)} maxLength="100" placeholder="Save EGP 5,100" /></label></fieldset>
        <fieldset><legend><span>02</span> القيمة والسعر</legend><div className="promotion-form-grid"><label>السعر الأصلي (ج.م)<input type="number" min="0" step="0.01" value={form.original_price} onChange={event => update('original_price', event.target.value)} /></label><label>السعر الترويجي (ج.م)<input type="number" min="0" step="0.01" value={form.promotional_price} onChange={event => update('promotional_price', event.target.value)} /></label></div><label>أو نص قيمة العرض<input value={form.discount_text} onChange={event => update('discount_text', event.target.value)} placeholder="مثال: خصم 30% + استشارة مجانية" /></label></fieldset>
        <fieldset><legend><span>03</span> التوقيت</legend><div className="promotion-form-grid"><label>يبدأ في<input type="datetime-local" value={form.starts_at} onChange={event => update('starts_at', event.target.value)} required /></label><label>ينتهي في<input type="datetime-local" value={form.ends_at} onChange={event => update('ends_at', event.target.value)} required /></label></div><p className="promotion-field-note"><CalendarClock /> تُفسَّر كل المواعيد بتوقيت القاهرة وتظهر للزائر بصيغة 12 ساعة.</p></fieldset>
        <fieldset><legend><span>04</span> الظهور والإجراء</legend><div className="promotion-placement-options"><label><input type="checkbox" checked={form.popup_enabled} onChange={event => update('popup_enabled', event.target.checked)} /><span><LayoutPanelTop /><b>نافذة منبثقة</b><small>تظهر مرة لكل نسخة عرض في الجلسة.</small></span></label><label><input type="checkbox" checked={form.banner_enabled} onChange={event => update('banner_enabled', event.target.checked)} /><span><MonitorUp /><b>شريط الموقع</b><small>يبقى ظاهرًا حتى انتهاء العرض.</small></span></label></div><div className="promotion-form-grid"><label>نص زر الإجراء<input value={form.cta_label} onChange={event => update('cta_label', event.target.value)} required /></label><label>الرابط / القسم<input dir="ltr" value={form.cta_url} onChange={event => update('cta_url', event.target.value)} required placeholder="#contact أو /path" /></label></div><label>شروط أو ملاحظات داخلية<textarea rows="2" value={form.terms} onChange={event => update('terms', event.target.value)} /></label></fieldset>
      </div>
      <aside className="promotion-live-preview"><header><div><Eye /><span>معاينة مباشرة</span></div><nav><button type="button" className={previewMode === 'popup' ? 'active' : ''} onClick={() => setPreviewMode('popup')}>Popup</button><button type="button" className={previewMode === 'banner' ? 'active' : ''} onClick={() => setPreviewMode('banner')}>Banner</button></nav></header><PromotionPreview form={form} mode={previewMode} /></aside>
      <footer><select aria-label="حالة العرض" value={form.status} onChange={event => update('status', event.target.value)}><option value="draft">حفظ كمسودة</option><option value="active">نشط / مجدول</option><option value="paused">متوقف مؤقتًا</option></select><div><button type="button" onClick={onClose}>إلغاء</button><button className="primary" type="submit" disabled={busy === 'save'}><Save /> {busy === 'save' ? 'جارٍ الحفظ…' : editing ? 'حفظ التعديلات' : 'إنشاء العرض'}</button></div></footer>
    </form>
  </aside></div>;
};

function PromotionPreview({ form, mode }) {
  const value = form.promotional_price !== '' ? formatEGP(form.promotional_price) : form.discount_text || 'قيمة العرض';
  if (mode === 'banner') return <div className="promotion-preview-stage"><div className="promotion-preview-banner"><span>{form.badge || 'عرض حصري'}</span><div><strong>{form.public_title || 'عنوان العرض الحصري'}</strong><small>{value}</small></div><time>02 : 18 : 45</time><button type="button">{form.cta_label || 'اشترك في العرض'}</button></div><small>الموقع العام · شريط علوي مستمر</small></div>;
  return <div className="promotion-preview-stage"><div className="promotion-preview-popup"><span>{form.badge || 'لفترة محدودة'}</span><h3>{form.public_title || 'عنوان العرض الحصري'}</h3><p>{form.description || 'سيظهر هنا الوصف المقنع المختصر للزائر.'}</p><strong>{value}</strong>{form.original_price !== '' && <del>{formatEGP(form.original_price)}</del>}<time>ينتهي خلال 02 يوم : 18 ساعة</time><button type="button">{form.cta_label || 'اشترك في العرض'}</button></div><small>الموقع العام · نافذة منبثقة</small></div>;
}
