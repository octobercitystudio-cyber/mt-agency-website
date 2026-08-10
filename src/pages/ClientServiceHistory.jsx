import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive, Ban, CalendarDays, Camera, CheckCircle2, ChevronLeft, ChevronRight,
  Clock3, FolderCheck, History, LoaderCircle, PackageCheck, Search, WalletCards,
} from 'lucide-react';
import { dataClient } from '../dataClient';
import { formatBookingDate, formatEGP, formatPackageQuantity, formatTime12 } from '../lib/businessFormat';
import { isUnfulfilledServiceHistoryType, serviceHistoryEmptyMode } from '../lib/clientServiceHistory';
import './ClientServiceHistory.css';

const TYPE_META = {
  studio_session: { label: 'جلسة تصوير مكتملة', icon: Camera, tone: 'success' },
  ended_package: { label: 'باقة منتهية', icon: PackageCheck, tone: 'warning' },
  completed_project: { label: 'مشروع تم تسليمه', icon: FolderCheck, tone: 'info' },
  cancelled_booking: { label: 'موعد لم يتم', icon: Ban, tone: 'danger' },
  cancelled_project: { label: 'مشروع لم يتم', icon: Ban, tone: 'danger' },
};
const PROJECT_TYPES = { advertising: 'إنتاج إعلاني', reels: 'تصوير ريلز', website: 'موقع إلكتروني', software: 'برنامج أو تطبيق', podcast: 'بودكاست', social_media: 'إدارة سوشيال ميديا', event_coverage: 'تغطية فعالية', ai_video: 'فيديو ذكاء اصطناعي', custom: 'خدمة مخصصة' };
const FILTERS = [
  ['all', 'الكل'], ['studio_session', 'جلسات الاستديو'], ['ended_package', 'الباقات المنتهية'], ['completed_project', 'المشروعات المسلمة'], ['unfulfilled', 'طلبات لم تتم'],
];

const dateKey = (monthsBack) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setMonth(date.getMonth() - monthsBack);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const durationLabel = minutes => {
  const value = Math.max(0, Math.round(Number(minutes || 0)));
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  if (!hours) return `${rest.toLocaleString('ar-EG-u-nu-latn')} دقيقة`;
  return `${hours.toLocaleString('ar-EG-u-nu-latn')} ساعة${rest ? ` و${rest.toLocaleString('ar-EG-u-nu-latn')} دقيقة` : ''}`;
};
const monthLabel = value => {
  const date = new Date(`${String(value || '').slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? 'بدون تاريخ' : new Intl.DateTimeFormat('ar-EG-u-nu-latn', { month: 'long', year: 'numeric' }).format(date);
};

export default function ClientServiceHistory() {
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [period, setPeriod] = useState('year');
  const [sort, setSort] = useState('desc');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], summary: {}, pagination: { page: 1, total: 0, total_pages: 1 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => { setQuery(queryInput.trim()); setPage(1); }, 250);
    return () => window.clearTimeout(timer);
  }, [queryInput]);

  const loadHistory = useCallback(async () => {
    setLoading(true); setError('');
    const params = new URLSearchParams({ type, sort, page: String(page), page_size: '20' });
    if (query) params.set('query', query);
    if (period === 'quarter') params.set('from', dateKey(3));
    if (period === 'year') params.set('from', dateKey(12));
    const { data: response, error: requestError } = await dataClient.request(`/client/service-history?${params}`, { method: 'GET' });
    if (requestError) setError(requestError.message || 'تعذر تحميل سجل الخدمات.');
    else setData(response || { items: [], summary: {}, pagination: { page: 1, total: 0, total_pages: 1 } });
    setLoading(false);
  }, [page, period, query, sort, type]);

  // Remote archive state is synchronized when the selected query changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadHistory(); }, [loadHistory]);

  const groups = useMemo(() => (data.items || []).reduce((result, item) => {
    const label = monthLabel(item.date);
    const group = result.find(entry => entry.label === label);
    if (group) group.items.push(item); else result.push({ label, items: [item] });
    return result;
  }, []), [data.items]);

  const emptyMode = serviceHistoryEmptyMode({ historyTotal: data.summary?.history_total, filteredTotal: data.pagination?.total });
  return <section className="client-view client-history" aria-labelledby="client-history-title">
    <header className="client-history__heading">
      <div><span><History aria-hidden="true" /> أرشيف حسابك</span><h2 id="client-history-title">سجل الخدمات</h2><p>كل ما تم تنفيذه أو تسليمه لك في مكان واحد</p></div>
      <small><Archive aria-hidden="true" /> سجل للعرض فقط</small>
    </header>

    <section className="client-history__summary" aria-label="ملخص سجل الخدمات">
      <SummaryCard icon={Camera} value={data.summary?.completed_sessions} label="جلسة تصوير مكتملة" tone="success" />
      <SummaryCard icon={PackageCheck} value={data.summary?.ended_packages} label="باقة انتهت" tone="warning" />
      <SummaryCard icon={FolderCheck} value={data.summary?.completed_projects} label="مشروع تم تسليمه" tone="info" />
    </section>

    <section className="client-history__controls" aria-label="البحث وتصفية السجل">
      <label className="client-history__search"><span>ابحث في السجل</span><div><Search aria-hidden="true" /><input value={queryInput} onChange={event => setQueryInput(event.target.value)} placeholder="اسم الخدمة أو الباقة أو المشروع" /></div></label>
      <fieldset><legend>نوع السجل</legend><div className="client-history__chips">{FILTERS.map(([value, label]) => <button type="button" key={value} className={`${type === value ? 'active' : ''}${value === 'unfulfilled' ? ' secondary' : ''}`} aria-pressed={type === value} onClick={() => { setType(value); setPage(1); }}>{label}</button>)}</div></fieldset>
      <div className="client-history__selects">
        <label>الفترة<select value={period} onChange={event => { setPeriod(event.target.value); setPage(1); }}><option value="quarter">آخر 3 شهور</option><option value="year">آخر سنة</option><option value="all">كل الفترات</option></select></label>
        <label>الترتيب<select value={sort} onChange={event => { setSort(event.target.value); setPage(1); }}><option value="desc">الأحدث أولًا</option><option value="asc">الأقدم أولًا</option></select></label>
      </div>
    </section>

    {loading ? <HistoryState icon={LoaderCircle} title="جارٍ تجهيز سجل خدماتك" text="نجمع الخدمات المكتملة وملخصاتها الآمنة." spin />
      : error ? <HistoryState icon={Ban} title="تعذر تحميل سجل الخدمات" text={error} action="حاول مرة أخرى" onAction={loadHistory} danger />
        : groups.length ? <div className="client-history__timeline" aria-live="polite">{groups.map(group => <section className="client-history__month" key={group.label} aria-label={group.label}><header><span>{group.label}</span><i>{group.items.length.toLocaleString('ar-EG-u-nu-latn')}</i></header><div>{group.items.map(item => <HistoryEntry item={item} key={item.id} />)}</div></section>)}</div>
          : <HistoryState icon={emptyMode === 'filtered' ? Search : Archive} title={emptyMode === 'filtered' ? 'لا توجد نتائج مطابقة' : 'سجل الخدمات فارغ حاليًا'} text={emptyMode === 'filtered' ? 'جرّب تغيير نوع السجل أو الفترة أو كلمات البحث.' : 'ستظهر هنا الجلسات والخدمات بعد اكتمالها أو تسليمها.'} action={emptyMode === 'filtered' ? 'مسح عوامل التصفية' : null} onAction={emptyMode === 'filtered' ? () => { setQueryInput(''); setQuery(''); setType('all'); setPeriod('all'); setSort('desc'); setPage(1); } : null} />}

    {!loading && !error && Number(data.pagination?.total_pages || 1) > 1 && <nav className="client-history__pagination" aria-label="صفحات سجل الخدمات"><button type="button" disabled={page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))}><ChevronRight /> السابق</button><span>صفحة {page.toLocaleString('ar-EG-u-nu-latn')} من {Number(data.pagination.total_pages).toLocaleString('ar-EG-u-nu-latn')}</span><button type="button" disabled={page >= Number(data.pagination.total_pages)} onClick={() => setPage(value => value + 1)}>التالي <ChevronLeft /></button></nav>}
  </section>;
}

function SummaryCard({ icon: Icon, value = 0, label, tone }) {
  return <article className={`client-history-summary-card is-${tone}`}><span><Icon aria-hidden="true" /></span><div><strong>{Number(value || 0).toLocaleString('ar-EG-u-nu-latn')}</strong><small>{label}</small></div></article>;
}

function HistoryState({ icon: Icon, title, text, action, onAction, spin = false, danger = false }) {
  return <div className={`client-history-state${danger ? ' is-danger' : ''}`} role={danger ? 'alert' : 'status'}><span><Icon className={spin ? 'client-history-spin' : ''} aria-hidden="true" /></span><h3>{title}</h3><p>{text}</p>{action && <button type="button" onClick={onAction}>{action}</button>}</div>;
}

function HistoryEntry({ item }) {
  const meta = TYPE_META[item.type] || TYPE_META.completed_project;
  const Icon = meta.icon;
  const StatusIcon = isUnfulfilledServiceHistoryType(item.type) ? Ban : CheckCircle2;
  return <article className={`client-history-entry is-${meta.tone}`}>
    <span className="client-history-entry__stamp"><Icon aria-hidden="true" /></span>
    <div className="client-history-entry__main">
      <header><div><span className={`client-history-status is-${meta.tone}`}><StatusIcon aria-hidden="true" />{meta.label}</span><h3>{item.title}</h3><p>{item.subtitle}</p></div><time dateTime={item.date}><CalendarDays aria-hidden="true" />{formatBookingDate(item.date)}</time></header>
      <EntrySummary item={item} />
      <details><summary>عرض التفاصيل</summary><EntryDetails item={item} /></details>
    </div>
  </article>;
}

function EntrySummary({ item }) {
  const details = item.details || {};
  if (item.type === 'studio_session') return <div className="client-history-entry__summary"><span><Clock3 />المدة الفعلية <b>{durationLabel(details.actual_minutes)}</b></span><span><PackageCheck />المخصوم <b>{formatPackageQuantity(details.deducted_quantity, details.billing_unit)}</b></span></div>;
  if (item.type === 'ended_package') return <div className="client-history-entry__summary"><span><PackageCheck />المستخدم <b>{formatPackageQuantity(details.used_quantity, details.billing_unit)}</b></span><span><WalletCards />المتبقي المالي <b>{formatEGP(details.due_amount)}</b></span></div>;
  if (item.type === 'completed_project') return <div className="client-history-entry__summary"><span><FolderCheck />نوع الخدمة <b>{PROJECT_TYPES[details.service_type] || details.service_type || 'خدمة مخصصة'}</b></span><span><CheckCircle2 />المراحل المكتملة <b>{Number(details.completed_milestones?.length || 0).toLocaleString('ar-EG-u-nu-latn')}</b></span></div>;
  return <div className="client-history-entry__summary"><span><Ban />الحالة <b>لم يتم التنفيذ</b></span>{details.start_time && <span><Clock3 />الوقت <b>{formatTime12(details.start_time)} – {formatTime12(details.end_time)}</b></span>}</div>;
}

function EntryDetails({ item }) {
  const details = item.details || {};
  if (item.type === 'studio_session') return <div className="client-history-details"><Detail label="الباقة" value={details.package_name || 'جلسة مستقلة'} /><Detail label="وقت الموعد" value={`${formatTime12(details.start_time)} – ${formatTime12(details.end_time)}`} /><Detail label="الوقت الفعلي" value={durationLabel(details.actual_minutes)} /><Detail label="الوقت الزائد" value={durationLabel(details.excess_minutes)} /><Detail label="نتيجة التسوية" value={details.settlement_outcome} wide />{Number(details.amount_due) > 0 && <Detail label="المبلغ المستحق عن الزيادة" value={formatEGP(details.amount_due)} />}</div>;
  if (item.type === 'ended_package') return <div className="client-history-details"><Detail label="فترة الصلاحية" value={`${formatBookingDate(details.starts_at)} – ${formatBookingDate(details.expires_at)}`} wide /><Detail label="إجمالي الباقة" value={formatPackageQuantity(details.total_quantity, details.billing_unit)} /><Detail label="المستخدم" value={formatPackageQuantity(details.used_quantity, details.billing_unit)} /><Detail label="الرصيد النهائي" value={formatPackageQuantity(details.final_remaining, details.billing_unit)} /><Detail label="إجمالي السعر" value={formatEGP(details.total_price)} /><Detail label="المدفوع" value={formatEGP(details.paid_amount)} /><Detail label="المتبقي" value={formatEGP(details.due_amount)} /></div>;
  if (item.type === 'completed_project') return <div className="client-history-details"><Detail label="قيمة الاتفاق" value={formatEGP(details.agreement_amount)} /><Detail label="المدفوع" value={formatEGP(details.paid_amount)} /><Detail label="المتبقي" value={formatEGP(details.due_amount)} />{details.completed_milestones?.length > 0 && <div className="client-history-details__list"><strong>المراحل التي اكتملت</strong><ul>{details.completed_milestones.map((row, index) => <li key={`${row.title}-${index}`}><CheckCircle2 /> <span>{row.title}{row.client_note && <small>{row.client_note}</small>}</span></li>)}</ul></div>}{details.completed_items?.length > 0 && <div className="client-history-details__list"><strong>ما تم تسليمه</strong><ul>{details.completed_items.map((row, index) => <li key={`${row.description}-${index}`}><FolderCheck /> <span>{row.description}<small>{Number(row.quantity).toLocaleString('ar-EG-u-nu-latn')} {row.unit}</small></span></li>)}</ul></div>}</div>;
  return <div className="client-history-details"><Detail label="النوع" value={TYPE_META[item.type]?.label || 'طلب لم يتم'} /><Detail label="التاريخ" value={formatBookingDate(item.date)} />{details.package_name && <Detail label="الباقة" value={details.package_name} />}</div>;
}

function Detail({ label, value, wide = false }) { return <div className={wide ? 'is-wide' : ''}><span>{label}</span><strong>{value || '—'}</strong></div>; }
