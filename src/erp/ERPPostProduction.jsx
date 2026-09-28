import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Clapperboard, CloudUpload, ExternalLink, Film, History, MapPin, Pin, Plus, RefreshCw, Save, Search, Trash2, X } from 'lucide-react';
import { dataClient } from '../dataClient';
import useChangeSync from '../hooks/useChangeSync';
import useModalDialog from '../hooks/useModalDialog';
import { useData } from '../store/DataContext';
import { formatBookingDate, formatDateTime12, formatTime12 } from '../lib/businessFormat';
import CompanyPickupScheduleEditor from './CompanyPickupScheduleEditor';
import ClientCombobox from '../components/ClientCombobox';
import { ACTIVE_POST_PRODUCTION_STATUSES, POST_PRODUCTION_STATUS, UPLOAD_COMPLETED_NOTICE, deliveryLinkDraft, postProductionDuration, postProductionMeta, postProductionSessionLabel } from '../lib/postProduction';
import './ERPPostProduction.css';

const emptyLink = () => ({ title: '', link_kind: 'folder', url: '', is_active: 1, is_pinned: 0 });

export default function ERPPostProduction() {
  const { currentUser } = useData(); const [jobs, setJobs] = useState([]); const [clients, setClients] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [statusFilter, setStatusFilter] = useState('active'); const [clientFilter, setClientFilter] = useState('all'); const [search, setSearch] = useState(''); const [selected, setSelected] = useState(null); const [busy, setBusy] = useState(''); const [dialogError, setDialogError] = useState(''); const [pendingStatus, setPendingStatus] = useState(''); const [links, setLinks] = useState([]);
  const [statusCorrection, setStatusCorrection] = useState({ status: '', reason: '' });
  const [pickupScheduleOpen, setPickupScheduleOpen] = useState(() => new URLSearchParams(window.location.search).get('pickup') === '1');
  const dialogTriggerRef = useRef(null);
  const selectedId = selected?.id; const selectedVersion = selected?.version;
  const closeDialog = useCallback(() => { setSelected(null); setPendingStatus(''); setStatusCorrection({ status: '', reason: '' }); setDialogError(''); }, []); const dialogRef = useModalDialog(Boolean(selected), closeDialog, { returnFocusRef: dialogTriggerRef });

  const loadJobs = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true); setError(''); const [{ data, error: requestError }, clientsResult] = await Promise.all([dataClient.request('/post-production?status=all', { method: 'GET' }), dataClient.from('clients').select('id,name,phone1,phone2,status').order('name')]);
    if (requestError) setError(requestError.message || 'تعذر تحميل مركز المونتاج.');
    else { const items = Array.isArray(data?.items) ? data.items : []; const fetchedClients = clientsResult.data || [...new Map(items.map(job => [Number(job.client_id), { id: Number(job.client_id), name: job.client_name, status: 'active' }])).values()]; setJobs(items); setClients(fetchedClients.filter(client => items.some(job => Number(job.client_id) === Number(client.id)))); setSelected(current => current ? items.find(item => Number(item.id) === Number(current.id)) || null : null); }
    if (!quiet) setLoading(false);
  }, []);
  // Remote state is intentionally hydrated when the page mounts.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadJobs(); }, [loadJobs]);
  // Keep the editor in sync after an optimistic-version refresh.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (selected) setLinks((selected.delivery_links || []).map(deliveryLinkDraft)); }, [selected, selectedId, selectedVersion]);
  useChangeSync(useCallback(topics => { if (topics.includes('post_production')) loadJobs(true); }, [loadJobs]), !currentUser?.is_local_preview);

  const filtered = useMemo(() => jobs.filter(job => {
    if (statusFilter === 'active' && !ACTIVE_POST_PRODUCTION_STATUSES.includes(job.status)) return false; if (statusFilter !== 'all' && statusFilter !== 'active' && job.status !== statusFilter) return false;
    if (clientFilter !== 'all' && Number(job.client_id) !== Number(clientFilter)) return false; const needle = search.trim().toLocaleLowerCase('ar'); return !needle || `${job.client_name} ${job.service} ${job.package_name || ''} ${job.booking_id}`.toLocaleLowerCase('ar').includes(needle);
  }), [clientFilter, jobs, search, statusFilter]);
  const kpis = useMemo(() => ({ editing: jobs.filter(job => ['editing_in_progress', 'editing_completed'].includes(job.status)).length, upload: jobs.filter(job => ['uploading', 'upload_completed'].includes(job.status)).length, pickup: jobs.filter(job => job.status === 'ready_for_pickup').length, delivered: jobs.filter(job => job.status === 'delivered').length }), [jobs]);
  const announce = message => { setNotice(message); window.setTimeout(() => setNotice(''), 4500); };
  const openJob = (job, event) => { dialogTriggerRef.current = event.currentTarget; setSelected(job); setDialogError(''); setPendingStatus(''); setStatusCorrection({ status: job.status, reason: '' }); };

  const saveDraftBeforeStatus = async () => {
    if (JSON.stringify(links) === JSON.stringify((selected.delivery_links || []).map(deliveryLinkDraft))) return Number(selected.version);
    const { data, error: requestError } = await dataClient.request(`/post-production/${selected.id}/delivery-links`, { method: 'PUT', body: JSON.stringify({ expected_version: Number(selected.version), links }) });
    if (requestError) { setDialogError(requestError.message || 'تعذر حفظ الفولدر. لم يتم تغيير الحالة.'); return null; }
    setSelected(current => ({ ...current, version: data.version, delivery_links: data.links }));
    return Number(data.version);
  };

  const updateStatus = async () => {
    if (!selected || !pendingStatus) return; setBusy('status'); setDialogError(''); const version = await saveDraftBeforeStatus(); if (version == null) { setBusy(''); return; } const { error: requestError } = await dataClient.request(`/post-production/${selected.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: pendingStatus, expected_version: version }) }); setBusy('');
    if (requestError) { setDialogError(requestError.message || 'تعذر تغيير الحالة.'); if (requestError.status === 409 || requestError.code === 'post_production_version_conflict') await loadJobs(true); return; }
    setPendingStatus(''); announce(`تم تغيير الحالة إلى: ${postProductionMeta(pendingStatus).label}`); await loadJobs(true);
  };
  const correctStatus = async event => {
    event.preventDefault(); if (!selected || currentUser?.role !== 'owner') return; setBusy('status-correction'); setDialogError(''); const target = statusCorrection.status; const version = await saveDraftBeforeStatus(); if (version == null) { setBusy(''); return; } const { error: requestError } = await dataClient.request(`/owner/post-production/${selected.id}/status-correction`, { method: 'POST', body: JSON.stringify({ status: target, reason: statusCorrection.reason, expected_version: version }) }); setBusy(''); if (requestError) { setDialogError(requestError.message || 'تعذر تصحيح حالة المونتاج.'); if (requestError.status === 409) await loadJobs(true); return; } setStatusCorrection({ status: target, reason: '' }); announce(`صحح المالك الحالة إلى: ${postProductionMeta(target).label}`); await loadJobs(true);
  };
  const saveLinks = async event => {
    event.preventDefault(); if (!selected) return; setBusy('links'); setDialogError(''); const { error: requestError } = await dataClient.request(`/post-production/${selected.id}/delivery-links`, { method: 'PUT', body: JSON.stringify({ expected_version: Number(selected.version), links }) }); setBusy('');
    if (requestError) { setDialogError(requestError.message || 'تعذر حفظ روابط التسليم.'); if (requestError.status === 409 || requestError.code === 'post_production_version_conflict') await loadJobs(true); return; }
    announce('تم حفظ روابط Google Drive بأمان.'); await loadJobs(true);
  };
  const publishLegacy = async () => {
    if (!selected) return; setBusy('publish'); setDialogError(''); const { error: requestError } = await dataClient.request(`/post-production/${selected.id}/publish`, { method: 'POST', body: JSON.stringify({ status: selected.status, expected_version: Number(selected.version) }) }); setBusy('');
    if (requestError) return setDialogError(requestError.message || 'تعذر نشر الجلسة القديمة.'); announce('تمت مراجعة الجلسة وإظهارها للعميل.'); await loadJobs(true);
  };


  return <main className="post-production-center" dir="rtl">
    <header className="post-production-head"><div><span>الخدمات والعمل</span><h1>المونتاج والتسليم</h1><p>تابع كل جلسة مكتملة من المونتاج حتى رفع الفيديو أو استلامه من الشركة.</p></div><button type="button" onClick={() => loadJobs()} aria-label="تحديث مركز المونتاج"><RefreshCw className={loading ? 'is-spinning' : ''} /></button></header>
    {notice && <div className="post-production-notice" role="status"><Check /> {notice}</div>}
    <button type="button" className="post-production-schedule-toggle" aria-expanded={pickupScheduleOpen} aria-controls="post-production-pickup-schedule" onClick={() => setPickupScheduleOpen(open => !open)}><MapPin aria-hidden="true" />{pickupScheduleOpen ? 'إخفاء جدول مواعيد التسليمات' : 'جدول مواعيد التسليمات'}</button>
    <div id="post-production-pickup-schedule" hidden={!pickupScheduleOpen}><CompanyPickupScheduleEditor syncEnabled={!currentUser?.is_local_preview} /></div>
    <section className="post-production-kpis" aria-label="ملخص حالات المونتاج">{[['editing', Clapperboard, 'قيد المونتاج'], ['upload', CloudUpload, 'الرفع والجاهز رقميًا'], ['pickup', MapPin, 'جاهز للاستلام'], ['delivered', Check, 'تم التسليم']].map(([key, Icon, label]) => <article key={key}><Icon /><span>{label}</span><strong>{error ? '—' : kpis[key]}</strong></article>)}</section>
    <section className="post-production-toolbar" aria-label="تصفية جلسات المونتاج"><label className="post-production-search"><Search /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="ابحث بالعميل أو الخدمة أو رقم الحجز" /></label><label><span>الحالة</span><select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="active">العمل النشط</option><option value="all">كل الحالات</option>{Object.entries(POST_PRODUCTION_STATUS).map(([value, meta]) => <option value={value} key={value}>{meta.label}</option>)}</select></label><ClientCombobox clients={clients} value={clientFilter} onChange={setClientFilter} label="العميل" allowAll allValue="all" allLabel="كل العملاء" allowedStatuses={client => client.status !== 'archived'}/></section>
    {loading && <CenterState icon={RefreshCw} spinning title="جارٍ تجهيز مركز المونتاج" text="نجمع الجلسات والتاريخ وروابط التسليم…" />}
    {!loading && error && <CenterState icon={Film} title="تعذر تحميل مركز المونتاج" text={error} action="إعادة المحاولة" onAction={() => loadJobs()} error />}
    {!loading && !error && !filtered.length && <CenterState icon={Clapperboard} title="لا توجد جلسات تطابق الفلتر" text="غيّر الحالة أو العميل، أو انتظر اكتمال جلسة تصوير جديدة." />}
    {!loading && !error && filtered.length > 0 && <section className="post-production-list" aria-label="جلسات المونتاج">{filtered.map(job => { const meta = postProductionMeta(job.status); return <article className={`post-production-record tone-${meta.tone}`} key={job.id}><div className="post-production-record__identity"><i><Clapperboard /></i><div><span>جلسة #{job.booking_id}</span><h2>{job.client_name}</h2><p>{postProductionSessionLabel(job)}</p></div></div><dl><div><dt>التاريخ والوقت</dt><dd>{formatBookingDate(job.session_date)} · {formatTime12(job.start_time, '--:--')}</dd></div><div><dt>المدة المصورة</dt><dd>{postProductionDuration(job.actual_seconds)}</dd></div><div><dt>آخر تغيير</dt><dd>{formatDateTime12(job.status_changed_at)}</dd></div><div><dt>روابط التسليم</dt><dd>{job.delivery_link_count || 0}</dd></div></dl><div className="post-production-record__state"><b>{meta.label}</b>{job.status === 'upload_completed' && <span className="post-production-upload-note">تم الرفع بنجاح — يُرجى مراجعة رابط فولدر التسليم.</span>}{Number(job.needs_review) === 1 ? <span className="is-review">يحتاج مراجعة قبل الظهور للعميل</span> : <span>{Number(job.is_client_visible) === 1 ? 'ظاهر للعميل' : 'غير ظاهر للعميل'}</span>}</div><button type="button" onClick={event => openJob(job, event)}>التفاصيل والتحكم</button></article>; })}</section>}

    {selected && <div className="post-production-modal" onMouseDown={event => { if (event.target === event.currentTarget) closeDialog(); }}><section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="post-production-dialog-title" className="post-production-dialog"><header><div><span>جلسة #{selected.booking_id}</span><h2 id="post-production-dialog-title">{selected.client_name} — {postProductionSessionLabel(selected)}</h2><p>{formatBookingDate(selected.session_date)} · {postProductionDuration(selected.actual_seconds)}</p></div><button type="button" data-dialog-initial onClick={closeDialog} aria-label="إغلاق"><X /></button></header>{dialogError && <div className="post-production-dialog__error" role="alert">{dialogError}</div>}
      <section className="post-production-dialog__section"><div className="post-production-dialog__title"><div><span>الحالة الحالية</span><h3>{postProductionMeta(selected.status).label}</h3></div><b>نسخة {selected.version}</b></div><OwnerProgressRail status={selected.status} />{selected.status === 'upload_completed' && <p className="post-production-upload-note">{UPLOAD_COMPLETED_NOTICE}</p>}<PinnedFolders links={selected.delivery_links || []} />{Number(selected.needs_review) === 1 ? <div className="post-production-legacy"><p>هذه جلسة قديمة أُضيفت للمراجعة ولم تظهر للعميل.</p><button type="button" disabled={busy === 'publish' || !['owner', 'admin'].includes(currentUser?.role)} onClick={publishLegacy}>{busy === 'publish' ? 'جارٍ النشر…' : 'اعتماد الحالة وإظهارها للعميل'}</button></div> : selected.valid_next_statuses?.length ? <div className="post-production-next"><p>اختر الخطوة التالية فقط. سيصل للعميل إشعار يوضح الحالة الجديدة.</p><div>{selected.valid_next_statuses.map(status => <button key={status} className={pendingStatus === status ? 'active' : ''} onClick={() => setPendingStatus(status)}>{postProductionMeta(status).label}</button>)}</div>{pendingStatus && <div className="post-production-confirm"><p>تأكيد النقل إلى «{postProductionMeta(pendingStatus).label}» وإرسال إشعار للعميل؟</p><button type="button" disabled={busy === 'status'} onClick={updateStatus}>{busy === 'status' ? 'جارٍ الحفظ…' : 'تأكيد الحالة'}</button><button type="button" onClick={() => setPendingStatus('')}>رجوع</button></div>}</div> : <p className="post-production-complete"><Check /> اكتمل مسار هذه الجلسة وتم تسليمها.</p>}{currentUser?.role === 'owner' && <details className="post-production-owner-correction"><summary>تصحيح أي حالة بصلاحية المالك</summary><form onSubmit={correctStatus}><p>يُستخدم لتصحيح تسجيل خاطئ، بما في ذلك الرجوع لمرحلة سابقة. سيظل التاريخ محفوظًا ويصل إشعار جديد للعميل.</p><label>الحالة الصحيحة<select value={statusCorrection.status} onChange={event => setStatusCorrection(current => ({ ...current, status: event.target.value }))}>{Object.entries(POST_PRODUCTION_STATUS).map(([value, meta]) => <option value={value} key={value}>{meta.label}</option>)}</select></label><label>سبب التصحيح<textarea required minLength="5" rows="3" value={statusCorrection.reason} onChange={event => setStatusCorrection(current => ({ ...current, reason: event.target.value }))}/></label><button disabled={busy === 'status-correction' || statusCorrection.reason.trim().length < 5}>{busy === 'status-correction' ? 'جارٍ التصحيح…' : 'اعتماد تصحيح المالك'}</button></form></details>}</section>
      <form className="post-production-dialog__section" onSubmit={saveLinks}><div className="post-production-dialog__title"><div><span>التسليم الرقمي</span><h3>روابط Google Drive</h3></div><button type="button" onClick={() => setLinks(current => [...current, emptyLink()])}><Plus /> إضافة رابط</button></div><p className="post-production-help">احفظ فولدر الرفع داخل الإدارة وثبّته ليظل محفوظًا عند تغيير الحالة. يظهر للعميل فقط عند اكتمال الرفع، وتبدأ مهلة التحميل 48 ساعة من وقت إتاحته. يُسمح بروابط HTTPS من Google Drive فقط.</p><div className="post-production-links">{links.map((link, index) => <article key={index}><label>اسم الرابط<input required value={link.title} onChange={event => setLinks(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))} /></label><label>النوع<select disabled={Number(link.is_pinned) === 1} value={link.link_kind} onChange={event => setLinks(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, link_kind: event.target.value } : item))}><option value="folder">فولدر</option><option value="video">فيديو</option></select></label><label className="post-production-link-url">الرابط<input readOnly={Number(link.is_pinned) === 1 && selected.delivery_links?.some(saved => saved.url === link.url && Number(saved.is_pinned) === 1)} required type="url" inputMode="url" dir="ltr" placeholder="https://drive.google.com/..." value={link.url} onChange={event => setLinks(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, url: event.target.value } : item))} /></label><label className="post-production-link-active"><input type="checkbox" checked={Number(link.is_active) === 1} onChange={event => setLinks(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, is_active: event.target.checked ? 1 : 0 } : item))} /> نشط</label><label className="post-production-link-pin"><input type="checkbox" disabled={link.link_kind !== 'folder'} checked={Number(link.is_pinned) === 1} onChange={event => setLinks(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, is_pinned: event.target.checked ? 1 : 0 } : item))} /><Pin aria-hidden="true" /> تثبيت فولدر الرفع</label><button type="button" disabled={Number(link.is_pinned) === 1 || selected.delivery_links?.some(saved => saved.url === link.url && Number(saved.is_pinned) === 1)} title="للفولدر المثبت: ألغِ التثبيت واحفظ قبل الحذف" className="post-production-link-remove" aria-label={`حذف الرابط ${index + 1}`} onClick={() => setLinks(current => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 /></button></article>)}</div><button className="post-production-save" disabled={busy === 'links'}><Save /> {busy === 'links' ? 'جارٍ الحفظ…' : 'حفظ مجموعة الروابط'}</button></form>

      <section className="post-production-dialog__section"><div className="post-production-dialog__title"><div><span>سجل لا يتغير</span><h3>تاريخ الحالات</h3></div><History /></div><ol className="post-production-history">{(selected.history || []).map(item => <li key={item.id || item.version}><i /><div><strong>{postProductionMeta(item.to_status).label}</strong><time>{formatDateTime12(item.changed_at)}</time></div><b>v{item.version}</b></li>)}</ol></section>
    </section></div>}
  </main>;
}

function PinnedFolders({ links }) {
  const pinned = links.filter(link => link.link_kind === 'folder' && Number(link.is_pinned) === 1);
  if (!pinned.length) return null;
  return <section className="post-production-pinned-folders" aria-label="فولدرات الرفع المثبتة"><h4><Pin aria-hidden="true" /> فولدر الرفع المثبّت</h4><p>محفوظ داخل الإدارة عند تغيير الحالة. إتاحته للعميل مرتبطة باكتمال الرفع ومهلة التحميل.</p>{pinned.map(link => <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer"><span>{link.title}</span><ExternalLink aria-hidden="true" /></a>)}</section>;
}

function OwnerProgressRail({ status }) {
  const index = status === 'editing_in_progress' ? 0 : ['editing_completed', 'uploading'].includes(status) ? 1 : ['upload_completed', 'ready_for_pickup'].includes(status) ? 2 : 3;
  const steps = [[Clapperboard, 'المونتاج'], [CloudUpload, 'التجهيز والرفع'], [MapPin, 'جاهز'], [Check, 'التسليم']];
  return <ol className="owner-production-rail" aria-label={`تقدم الجلسة: ${postProductionMeta(status).label}`}>{steps.map(([Icon, label], step) => <li key={label} className={step < index ? 'is-done' : step === index ? 'is-current' : step === index + 1 ? 'is-next' : ''}><i><Icon /></i><span>{label}<small>{step === index ? 'الحالي' : step === index + 1 ? 'التالي' : step < index ? 'اكتمل' : ''}</small></span></li>)}</ol>;
}

function CenterState({ icon: Icon, title, text, action, onAction, spinning = false, error = false }) { return <div className={`post-production-state${error ? ' is-error' : ''}`}><Icon className={spinning ? 'is-spinning' : ''} /><strong>{title}</strong><p>{text}</p>{action && <button type="button" onClick={onAction}>{action}</button>}</div>; }
