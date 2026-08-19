import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Check, Clock3, Clapperboard, CloudUpload, ExternalLink, Film, FolderOpen, MapPin, RefreshCw, Video } from 'lucide-react';
import { dataClient } from '../dataClient';
import useChangeSync from '../hooks/useChangeSync';
import { formatBookingDate, formatTime12 } from '../lib/businessFormat';
import { postProductionDuration, postProductionMeta, postProductionSessionLabel } from '../lib/postProduction';
import './ClientPostProduction.css';

export const VIDEO_DOWNLOAD_NOTICE = 'برجاء التحميل في خلال 48 ساعة من الرفع ويتم حذف الروابط بشكل تلقائي ويمكنكم استلامها من مقر الشركة فيما بعد في مدة اقصاها اسبوع من تاريخ التصوير';

const progressStage = status => ({ editing_in_progress: 1, editing_completed: 2, uploading: 2, upload_completed: 3, ready_for_pickup: 3, delivered: 4 })[status] || 0;
const railSteps = [[Clapperboard, 'المونتاج'], [CloudUpload, 'التجهيز والرفع'], [Film, 'جاهز'], [Check, 'التسليم']];
const pickupDate = value => {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
};
const dateTimeLabel = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }).format(date);
};
const activeDeliveryLinks = (job, effectiveNow) => (job.delivery_links || []).filter(link => {
  const availableUntil = new Date(link.available_until || '').getTime();
  return Number(link.is_active) === 1 && (!Number.isFinite(availableUntil) || availableUntil > effectiveNow);
});

export default function ClientPostProduction({ highlightJobId = null }) {
  const [jobs, setJobs] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [serverOffset, setServerOffset] = useState(0); const [clock, setClock] = useState(() => Date.now());
  const highlightedRef = useRef(false);

  const loadJobs = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true); setError('');
    const requestedAt = Date.now(); const { data, error: requestError } = await dataClient.request('/client/post-production', { method: 'GET' });
    if (requestError) setError(requestError.message || 'تعذر تحميل تسليمات الفيديوهات.');
    else {
      setJobs(Array.isArray(data?.items) ? data.items : []);
      const serverNow = new Date(data?.server_now || '').getTime(); if (Number.isFinite(serverNow)) setServerOffset(serverNow - requestedAt);
    }
    if (!quiet) setLoading(false);
  }, []);

  // Remote state is intentionally hydrated when the page mounts.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadJobs(); }, [loadJobs]);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  useChangeSync(useCallback(topics => {
    if (topics.some(topic => ['post_production', 'notifications'].includes(topic))) loadJobs(true);
  }, [loadJobs]));
  useEffect(() => {
    if (!highlightJobId || highlightedRef.current || loading) return;
    const target = document.querySelector(`[data-post-production-job="${Number(highlightJobId)}"]`);
    if (target) { highlightedRef.current = true; target.focus({ preventScroll: true }); target.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }, [highlightJobId, jobs, loading]);

  const effectiveNow = clock + serverOffset;
  const visibleJobs = useMemo(() => jobs.map(job => ({ ...job, active_delivery_links: activeDeliveryLinks(job, effectiveNow) })), [effectiveNow, jobs]);

  return <section className="client-post-production client-post-production--videos" aria-labelledby="client-videos-title">
    <header className="client-post-production__head">
      <div><span>كل أعمالك بعد التصوير</span><h2 id="client-videos-title">تسليمات الفيديوهات</h2><p>تابع حالة كل جلسة، نزّل الفيديوهات المتاحة، أو راجع فترة استلامها من مقر الشركة.</p></div>
      <button type="button" onClick={() => loadJobs()} aria-label="تحديث صفحة تسليمات الفيديوهات"><RefreshCw className={loading ? 'is-spinning' : ''} /></button>
    </header>

    {loading && <div className="client-post-production__state" role="status"><RefreshCw className="is-spinning" /><strong>نجمع حالات جلساتك…</strong></div>}
    {!loading && error && <div className="client-post-production__state is-error" role="alert"><Film /><strong>تعذر تحميل الصفحة</strong><p>{error}</p><button type="button" onClick={() => loadJobs()}>إعادة المحاولة</button></div>}
    {!loading && !error && !visibleJobs.length && <div className="client-post-production__state"><Clapperboard /><strong>لا توجد تسليمات فيديو حاليًا</strong><p>بعد إنهاء جلسة تصوير جديدة ستظهر مراحلها وتسليماتها هنا تلقائيًا.</p></div>}

    {!loading && !error && visibleJobs.length > 0 && <div className="client-post-production__list">
      {visibleJobs.map(job => {
        const meta = postProductionMeta(job.status); const stage = progressStage(job.status); const pickup = job.pickup_availability || {}; const hasPickup = Array.isArray(pickup.windows) && pickup.windows.length > 0;
        return <article key={job.id} tabIndex="-1" className={`client-production-card tone-${meta.tone}${Number(highlightJobId) === Number(job.id) ? ' is-highlighted' : ''}`} data-post-production-job={job.id}>
          <header><div className="client-production-card__icon"><Video aria-hidden="true" /></div><div><span>جلسة تصوير #{job.booking_id}</span><h3>{postProductionSessionLabel(job)}</h3></div><b>{meta.label}</b></header>
          <dl><div><dt><CalendarDays /> تاريخ الجلسة</dt><dd>{formatBookingDate(job.session_date)}</dd></div><div><dt><Clock3 /> وقت التصوير</dt><dd>{formatTime12(job.start_time, '--:--')} – {formatTime12(job.end_time, '--:--')}</dd></div><div><dt><Film /> المدة المصورة</dt><dd>{postProductionDuration(job.actual_seconds)}</dd></div></dl>
          <ol className="client-production-rail" aria-label={`تقدم الجلسة: ${meta.label}`}>{railSteps.map(([Icon, label], index) => <li key={label} className={stage >= index + 1 ? 'is-done' : ''} aria-current={stage === index + 1 ? 'step' : undefined}><i><Icon aria-hidden="true" /></i><span>{label}</span></li>)}</ol>

          <section className="client-delivery-area">
            {job.active_delivery_links.length > 0 && <><h4><FolderOpen /> روابط الفيديوهات</h4><div className="client-drive-links">{job.active_delivery_links.map(link => <article key={link.id || link.url} className="client-drive-delivery"><a href={link.url} target="_blank" rel="noopener noreferrer" title={`${link.title} — ${link.url}`}><span><strong>{link.title}</strong><small>{link.link_kind === 'video' ? 'فيديو على Google Drive' : 'فولدر على Google Drive'}</small>{link.available_until && <b>متاح حتى {dateTimeLabel(link.available_until)}</b>}</span><ExternalLink aria-hidden="true" /></a><p><Clock3 aria-hidden="true" />{VIDEO_DOWNLOAD_NOTICE}</p></article>)}</div></>}
            {!job.active_delivery_links.length && ['upload_completed', 'delivered'].includes(job.status) && <p className="client-delivery-note"><CloudUpload /> لا يوجد رابط نشط الآن. تُخفى روابط Google Drive تلقائيًا بعد مرور 48 ساعة على رفعها.</p>}
            {hasPickup && <><h4 className="client-pickup-title"><MapPin /> فترة الاستلام من مقر الشركة</h4><div className="client-pickup-windows">{pickup.windows.map((window, index) => <article key={`${window.date}-${window.start_time}-${index}`}><strong>{pickupDate(window.date)}</strong><span>{formatTime12(window.start_time, window.start_time)} – {formatTime12(window.end_time, window.end_time)}</span><small>{window.label}</small></article>)}</div><p className="client-pickup-disclaimer">هذه الفترة تخص هذه المهمة فقط وليست حجز استلام مؤكدًا{pickup.expires_at ? `، وتنتهي صلاحيتها ${dateTimeLabel(pickup.expires_at)}` : ''}.</p></>}
            {!job.active_delivery_links.length && !hasPickup && !['upload_completed', 'delivered'].includes(job.status) && <p className="client-delivery-note"><Film /> الفيديوهات حاليًا في مرحلة {meta.label}. سنرسل لك إشعارًا عند تغير الحالة أو إضافة تسليم جديد.</p>}
          </section>
        </article>;
      })}
    </div>}
  </section>;
}
